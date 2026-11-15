"""
ไฟล์ตัวอย่างสำหรับ test การอัปโหลด (ขั้น 4.3 ข) — สร้างจากไบต์สมมติ ไม่ใช่ไฟล์จริงของใคร
แต่ละชนิดมีแค่ "ลายเซ็น" ต้นไฟล์ที่ตัวตรวจ (content/file_types.py) ใช้ดู + ไบต์เติมให้ไม่ว่าง
"""

import io
import zipfile

from django.core.files.uploadedfile import SimpleUploadedFile

PADDING = b"0" * 64


def office_zip(folder: str) -> bytes:
    """zip ที่หน้าตาเหมือนไฟล์ Office แบบใหม่ ([Content_Types].xml + โฟลเดอร์ของโปรแกรม)"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr(f"{folder}document.xml", "<doc/>")
    return buffer.getvalue()


def plain_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("ตัวอย่าง.py", "print('hello')")
    return buffer.getvalue()


# ชื่อไฟล์ → (ไบต์, ชนิดเนื้อหาที่คาดหวัง, MIME ที่คาดหวัง)
VALID_SAMPLES: dict[str, tuple[bytes, str, str]] = {
    "สไลด์.pdf": (b"%PDF-1.7\n" + PADDING, "file", "application/pdf"),
    "รายงาน.docx": (
        office_zip("word/"),
        "file",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    "บรรยาย.pptx": (
        office_zip("ppt/"),
        "file",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ),
    "คะแนน.xlsx": (
        office_zip("xl/"),
        "file",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    "โจทย์.txt": ("ข้อ 1 จงเขียนโปรแกรม".encode(), "file", "text/plain"),
    "break_continue.py": (b"for i in range(3):\n    print(i)\n", "file", "text/x-python"),
    "โค้ดทั้งหมด.zip": (plain_zip(), "file", "application/zip"),
    "ภาพ.JPG": (b"\xff\xd8\xff\xe0" + PADDING, "image", "image/jpeg"),
    "ภาพ.jpeg": (b"\xff\xd8\xff\xdb" + PADDING, "image", "image/jpeg"),
    "แผนภาพ-for-loop.png": (b"\x89PNG\r\n\x1a\n" + PADDING, "image", "image/png"),
    "ภาพเคลื่อนไหว.gif": (b"GIF89a" + PADDING, "image", "image/gif"),
    "ภาพ.webp": (b"RIFF\x24\x00\x00\x00WEBPVP8 " + PADDING, "image", "image/webp"),
    "สรุป.mp3": (b"ID3\x04\x00" + PADDING, "audio", "audio/mpeg"),
    "สรุปไม่มีป้าย.mp3": (b"\xff\xfb\x90\x64" + PADDING, "audio", "audio/mpeg"),
    "สรุป-while-กับ-for.m4a": (b"\x00\x00\x00\x20ftypM4A " + PADDING, "audio", "audio/mp4"),
    "if-elif-else.mp4": (b"\x00\x00\x00\x18ftypisom" + PADDING, "video", "video/mp4"),
    "คลิป.webm": (b"\x1a\x45\xdf\xa3" + PADDING, "video", "video/webm"),
}


def upload(name: str, data: bytes | None = None) -> SimpleUploadedFile:
    """ไฟล์ที่ "อัปโหลด" มาใน test — ไม่ส่ง data ใช้ไบต์ตัวอย่างของชื่อนั้น"""
    if data is None:
        data = VALID_SAMPLES[name][0]
    return SimpleUploadedFile(name, data, content_type="application/octet-stream")
