"""
ตัวตรวจไฟล์ที่ผู้สอนอัปโหลดเป็นเนื้อหา (ขั้น 4.3 ข — กถ1: เขียนเอง ไม่ติดตั้งแพ็กเกจเพิ่ม)
อ้างอิง: CLAUDE.md "การตัดสินใจก้อน 4" (กข1) และ docs/api.md §10

ตรวจ 3 ชั้นตามลำดับ แล้วบอกว่าไฟล์เป็นชนิดอะไร (ผู้สอนไม่ต้องเลือกชนิดเอง):
1. นามสกุลอยู่ในรายการที่รับ (ไม่รับ .html / .svg / .exe ฯลฯ)        → content_file_type_not_allowed
2. ไม่ว่าง และไม่ใหญ่เกิน (20 MB / วิดีโอ 100 MB — settings.py)          → content_file_empty / _too_large
3. **เนื้อไฟล์จริงตรงกับนามสกุล** ดูจากไบต์แรก ๆ (magic bytes)         → content_file_mismatch
   กันการเปลี่ยนชื่อไฟล์ เช่น ไฟล์โปรแกรม .exe ที่ตั้งชื่อเป็น .pdf

อ่านแค่ไบต์แรก ๆ (ไม่อ่านทั้งไฟล์เข้าหน่วยความจำ — เครื่องฟรีมี RAM 512 MB) ;
.docx / .pptx / .xlsx / .zip เปิดดูรายชื่อไฟล์ข้างใน zip โดยไม่แตกไฟล์
"""

import zipfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import PurePosixPath

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

from common.exceptions import ApiError

# จำนวนไบต์ต้นไฟล์ที่อ่านมาตรวจ (พอสำหรับทุกชนิด + ตรวจว่าไฟล์ข้อความไม่มีไบต์ศูนย์)
HEAD_BYTES = 8192


def _is_pdf(head: bytes) -> bool:
    return head.startswith(b"%PDF-")


def _is_jpeg(head: bytes) -> bool:
    return head.startswith(b"\xff\xd8\xff")


def _is_png(head: bytes) -> bool:
    return head.startswith(b"\x89PNG\r\n\x1a\n")


def _is_gif(head: bytes) -> bool:
    return head.startswith((b"GIF87a", b"GIF89a"))


def _is_webp(head: bytes) -> bool:
    return head.startswith(b"RIFF") and head[8:12] == b"WEBP"


def _is_mp3(head: bytes) -> bool:
    # มีป้ายข้อมูล ID3 นำหน้า หรือขึ้นต้นด้วยรหัสเริ่มเฟรมเสียง (11 บิตแรกเป็น 1)
    return head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0)


def _is_iso_media(head: bytes) -> bool:
    # MP4 / M4A: กล่องแรกของไฟล์ชื่อ "ftyp" (ไบต์ที่ 4–7)
    return head[4:8] == b"ftyp"


def _is_webm(head: bytes) -> bool:
    return head.startswith(b"\x1a\x45\xdf\xa3")


def _is_text(head: bytes) -> bool:
    # ไฟล์ข้อความ / โค้ดต้องไม่มีไบต์ศูนย์ (ไฟล์โปรแกรม / รูป / zip มีแทบทุกไฟล์)
    # หมายเหตุ: ข้อความแบบ UTF-16 มีไบต์ศูนย์ จึงไม่รับ — .txt / .py ทั่วไปเป็น UTF-8
    return b"\x00" not in head


# ตัวตรวจที่ต้องเปิดไฟล์ทั้งไฟล์ (zip) — รับไฟล์ ไม่ใช่แค่ไบต์ต้นไฟล์
def _zip_names(file: UploadedFile) -> list[str] | None:
    """รายชื่อไฟล์ใน zip (อ่านจากสารบัญท้ายไฟล์ ไม่แตกไฟล์) ; ไม่ใช่ zip = None"""
    file.seek(0)
    try:
        with zipfile.ZipFile(file) as archive:
            return archive.namelist()
    except (zipfile.BadZipFile, OSError, ValueError):
        return None
    finally:
        file.seek(0)


def _office(folder: str) -> Callable[[UploadedFile], bool]:
    """ไฟล์ Office แบบใหม่ = zip ที่มี [Content_Types].xml + โฟลเดอร์ของโปรแกรมนั้น (word/ ppt/ xl/)"""

    def check(file: UploadedFile) -> bool:
        names = _zip_names(file)
        return (
            bool(names)
            and "[Content_Types].xml" in names
            and any(name.startswith(folder) for name in names)
        )

    return check


def _plain_zip(file: UploadedFile) -> bool:
    return _zip_names(file) is not None


@dataclass(frozen=True)
class FileRule:
    """กติกาของนามสกุล 1 แบบ: ชนิดเนื้อหา, ชนิดไฟล์ (MIME) ที่บันทึก, ตัวตรวจเนื้อไฟล์"""

    kind: str
    mime: str
    head_check: Callable[[bytes], bool] | None = None
    file_check: Callable[[UploadedFile], bool] | None = None


_DOC = "application/vnd.openxmlformats-officedocument"
# นามสกุลที่รับทั้งหมด (กข1) — ตัวพิมพ์เล็กเสมอ
RULES: dict[str, FileRule] = {
    # เอกสาร
    ".pdf": FileRule("file", "application/pdf", head_check=_is_pdf),
    ".docx": FileRule("file", f"{_DOC}.wordprocessingml.document", file_check=_office("word/")),
    ".pptx": FileRule("file", f"{_DOC}.presentationml.presentation", file_check=_office("ppt/")),
    ".xlsx": FileRule("file", f"{_DOC}.spreadsheetml.sheet", file_check=_office("xl/")),
    ".txt": FileRule("file", "text/plain", head_check=_is_text),
    ".py": FileRule("file", "text/x-python", head_check=_is_text),
    ".zip": FileRule("file", "application/zip", file_check=_plain_zip),
    # รูปภาพ
    ".jpg": FileRule("image", "image/jpeg", head_check=_is_jpeg),
    ".jpeg": FileRule("image", "image/jpeg", head_check=_is_jpeg),
    ".png": FileRule("image", "image/png", head_check=_is_png),
    ".gif": FileRule("image", "image/gif", head_check=_is_gif),
    ".webp": FileRule("image", "image/webp", head_check=_is_webp),
    # เสียง
    ".mp3": FileRule("audio", "audio/mpeg", head_check=_is_mp3),
    ".m4a": FileRule("audio", "audio/mp4", head_check=_is_iso_media),
    # วิดีโอ
    ".mp4": FileRule("video", "video/mp4", head_check=_is_iso_media),
    ".webm": FileRule("video", "video/webm", head_check=_is_webm),
}


# ชนิดไฟล์ (MIME) ที่เบราว์เซอร์ "เปิดดู" ได้เอง — กดลิงก์เปิดดูแล้วแสดงในเบราว์เซอร์ ไม่ดาวน์โหลด
# ชนิดอื่น (Word / PowerPoint / Excel / zip / .py) เบราว์เซอร์ดาวน์โหลดทันทีเมื่อเปิด
# → สวิตช์ "ปิดดาวน์โหลด" ใช้ได้เฉพาะชนิดในกลุ่มนี้ (ผู้ใช้เลือกแบบ กพ1 หลังตรวจขั้น 4.4)
_PREVIEWABLE_PREFIXES = ("image/", "audio/", "video/")
_PREVIEWABLE_EXACT = {"application/pdf", "text/plain"}


def can_preview_in_browser(mime: str) -> bool:
    """เบราว์เซอร์เปิดดูไฟล์ชนิดนี้ได้เองไหม (PDF, รูป, เสียง, วิดีโอ, .txt)"""
    return mime in _PREVIEWABLE_EXACT or mime.startswith(_PREVIEWABLE_PREFIXES)


@dataclass(frozen=True)
class FileInfo:
    """ผลตรวจไฟล์ที่ผ่าน: ชนิดเนื้อหา, ชนิดไฟล์, ขนาด, ชื่อเดิม, หัวข้อตั้งต้น (ชื่อไฟล์ตัดนามสกุล)"""

    kind: str
    mime: str
    size: int
    name: str
    title: str


def max_bytes_for(kind: str) -> int:
    """ขนาดสูงสุดของชนิดนี้ (วิดีโอ 100 MB ; อื่น ๆ 20 MB)"""
    return settings.CONTENT_VIDEO_MAX_BYTES if kind == "video" else settings.CONTENT_MAX_BYTES


def clean_file_name(raw: str) -> str:
    """ชื่อไฟล์เดิมแบบไม่มีโฟลเดอร์ (บางเบราว์เซอร์ส่ง C:\\…\\a.pdf) ยาวไม่เกิน 255 ตัว (คงนามสกุลไว้)"""
    name = PurePosixPath(raw.replace("\\", "/")).name.strip() or "file"
    if len(name) > 255:
        suffix = PurePosixPath(name).suffix[:20]
        name = name[: 255 - len(suffix)] + suffix
    return name


def title_from_name(name: str) -> str:
    """หัวข้อตั้งต้น = ชื่อไฟล์ตัดนามสกุล เช่น "บทที่3-ลูป.pdf" → "บทที่3-ลูป" (≤ 200 ตัว)"""
    stem = PurePosixPath(name).stem.strip() or name
    return stem[:200]


def inspect_upload(file: UploadedFile) -> FileInfo:
    """ตรวจไฟล์ 3 ชั้น แล้วคืนชนิด / ข้อมูลไฟล์ ; ไม่ผ่าน → ApiError พร้อมรหัสที่หน้าจอแปลเป็นภาษาไทย"""
    name = clean_file_name(file.name or "")
    extension = PurePosixPath(name).suffix.lower()
    rule = RULES.get(extension)
    if rule is None:
        raise ApiError(
            "content_file_type_not_allowed",
            f"File type '{extension or '(none)'}' is not allowed.",
        )

    size = file.size or 0
    if size == 0:
        raise ApiError("content_file_empty", "The uploaded file is empty.")
    limit = max_bytes_for(rule.kind)
    if size > limit:
        raise ApiError(
            "content_file_too_large",
            f"File is larger than {limit} bytes.",
            extra={"max_bytes": limit},
        )

    file.seek(0)
    head = file.read(HEAD_BYTES)
    file.seek(0)
    matches = rule.head_check(head) if rule.head_check else rule.file_check(file)
    if not matches:
        raise ApiError(
            "content_file_mismatch",
            f"The file content does not match the '{extension}' extension.",
        )

    return FileInfo(
        kind=rule.kind, mime=rule.mime, size=size, name=name, title=title_from_name(name)
    )
