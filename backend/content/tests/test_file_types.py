"""
test ตัวตรวจไฟล์ (content/file_types.py — กถ1) — ไม่ใช้ฐานข้อมูล
ทุกชนิดที่รับผ่าน ; นามสกุลต้องห้าม / ไฟล์ว่าง / ใหญ่เกิน / เปลี่ยนนามสกุลหลอก ไม่ผ่าน
"""

import pytest

from common.exceptions import ApiError
from content.file_types import clean_file_name, inspect_upload, title_from_name
from content.tests.samples import VALID_SAMPLES, office_zip, upload

EXE = b"MZ\x90\x00" + b"\x00" * 64


def error_code(file) -> str:
    with pytest.raises(ApiError) as caught:
        inspect_upload(file)
    return caught.value.get_codes()


@pytest.mark.parametrize("name", list(VALID_SAMPLES))
def test_accepts_every_allowed_type(name: str) -> None:
    """ทุกนามสกุลที่รับ (กข1) + เนื้อไฟล์ตรง → ได้ชนิดและ MIME ที่ถูกต้อง"""
    data, kind, mime = VALID_SAMPLES[name]
    info = inspect_upload(upload(name))

    assert (info.kind, info.mime, info.size) == (kind, mime, len(data))
    assert info.name == name


@pytest.mark.parametrize(
    "name",
    ["setup.exe", "หน้าเว็บ.html", "ไอคอน.svg", "สคริปต์.js", "เก่า.doc", "ไม่มีนามสกุล", "a.pdf.exe"],
)
def test_rejects_types_not_allowed(name: str) -> None:
    assert error_code(upload(name, b"anything")) == "content_file_type_not_allowed"


@pytest.mark.parametrize(
    ("name", "data"),
    [
        ("ใบงาน3.pdf", EXE),  # ไฟล์โปรแกรมที่เปลี่ยนชื่อเป็น .pdf
        ("ภาพ.png", b"\xff\xd8\xff\xe0" + b"0" * 64),  # JPEG ที่ตั้งชื่อเป็น .png
        ("คลิป.mp4", b"\x1a\x45\xdf\xa3" + b"0" * 64),  # WebM ที่ตั้งชื่อเป็น .mp4
        ("รายงาน.docx", b"PK\x03\x04 not really a zip"),  # zip เสีย
        ("รายงาน.docx", office_zip("ppt/")),  # PowerPoint ที่ตั้งชื่อเป็น .docx
        ("โค้ด.py", EXE),  # ไฟล์โปรแกรม (มีไบต์ศูนย์) ที่ตั้งชื่อเป็น .py
        ("ข้อมูล.zip", b"%PDF-1.7 not a zip"),
    ],
)
def test_rejects_content_that_does_not_match(name: str, data: bytes) -> None:
    """เนื้อไฟล์ไม่ตรงกับนามสกุล (เปลี่ยนชื่อหลอก) → content_file_mismatch"""
    assert error_code(upload(name, data)) == "content_file_mismatch"


def test_rejects_empty_file() -> None:
    assert error_code(upload("ว่าง.pdf", b"")) == "content_file_empty"


def test_size_limits_differ_for_video(settings) -> None:
    """เอกสาร / รูป / เสียงใช้เพดาน CONTENT_MAX_BYTES ; วิดีโอใช้ CONTENT_VIDEO_MAX_BYTES"""
    settings.CONTENT_MAX_BYTES = 70
    settings.CONTENT_VIDEO_MAX_BYTES = 200
    pdf = b"%PDF-1.7\n" + b"0" * 80  # 89 ไบต์: เกินเพดานเอกสาร
    video = b"\x00\x00\x00\x18ftypisom" + b"0" * 80  # 92 ไบต์: ยังไม่เกินเพดานวิดีโอ

    with pytest.raises(ApiError) as caught:
        inspect_upload(upload("ใหญ่.pdf", pdf))
    assert caught.value.get_codes() == "content_file_too_large"
    assert inspect_upload(upload("คลิป.mp4", video)).kind == "video"


def test_file_name_and_title() -> None:
    """ชื่อเดิมตัดโฟลเดอร์ทิ้ง ; หัวข้อตั้งต้น = ชื่อไฟล์ตัดนามสกุล"""
    assert clean_file_name("C:\\Users\\kamon\\บทที่3-ลูป.pdf") == "บทที่3-ลูป.pdf"
    assert clean_file_name("") == "file"
    long_name = "ก" * 300 + ".pdf"
    assert len(clean_file_name(long_name)) == 255
    assert clean_file_name(long_name).endswith(".pdf")
    assert title_from_name("บทที่3-ลูป.pdf") == "บทที่3-ลูป"
    assert title_from_name("archive.tar.gz") == "archive.tar"
