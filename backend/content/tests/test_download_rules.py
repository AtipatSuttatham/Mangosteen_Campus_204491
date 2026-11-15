"""
test กฎสวิตช์ "ปิดดาวน์โหลด" (ผู้ใช้เลือกแบบ กพ1 หลังตรวจขั้น 4.4)
ปิดได้เฉพาะไฟล์ที่เบราว์เซอร์เปิดดูได้ (PDF / รูป / เสียง / วิดีโอ / .txt)
Word / PowerPoint / Excel / zip / .py เปิดแล้วดาวน์โหลดทันที → ดาวน์โหลดได้เสมอ
"""

from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import enroll
from content.file_types import can_preview_in_browser
from content.models import Content, Module
from content.tests.conftest import contents_url, make_module, make_text, modules_url
from content.tests.samples import upload

pytestmark = pytest.mark.django_db

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.fixture
def media_in_tmp(settings, tmp_path: Path) -> Path:
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


def make_file(module: Module, name: str, mime: str, kind: str = "file", **fields) -> Content:
    """เนื้อหาแบบไฟล์ (ไฟล์จริงในที่เก็บของ test) ที่ระบุชนิด MIME เอง"""
    content = Content(
        module=module,
        title=name,
        content_type=kind,
        file_name=name,
        file_size=4,
        mime_type=mime,
        **fields,
    )
    content.file_url.save(name, ContentFile(b"data"), save=False)
    content.save()
    return content


@pytest.mark.parametrize(
    ("mime", "expected"),
    [
        ("application/pdf", True),
        ("image/png", True),
        ("audio/mpeg", True),
        ("video/mp4", True),
        ("text/plain", True),
        (DOCX, False),
        ("application/zip", False),
        ("text/x-python", False),
    ],
)
def test_previewable_types(mime: str, expected: bool) -> None:
    assert can_preview_in_browser(mime) is expected


def test_teacher_sees_whether_switch_applies(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """หน้าต่างแก้ไขแสดงสวิตช์ตาม can_disable_download"""
    module = make_module(course)
    make_file(module, "สไลด์.pdf", "application/pdf", order=0)
    make_file(module, "รายงาน.docx", DOCX, order=1)
    make_text(module, order=2)

    contents = teacher_client.get(modules_url(course)).data[0]["contents"]

    assert [c["can_disable_download"] for c in contents] == [True, False, False]


def test_switch_is_ignored_for_files_that_cannot_be_locked(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """ส่งปิดดาวน์โหลดให้ Word → 200 แต่ค่ายังเปิด (ไม่ error) ; PDF → ปิดได้"""
    module = make_module(course)
    pdf = make_file(module, "สไลด์.pdf", "application/pdf")
    docx = make_file(module, "รายงาน.docx", DOCX)

    pdf_response = teacher_client.patch(
        contents_url(course, f"{pdf.pk}/"), {"allow_download": False}
    )
    docx_response = teacher_client.patch(
        contents_url(course, f"{docx.pk}/"), {"allow_download": False}
    )

    assert pdf_response.data["allow_download"] is False
    assert docx_response.status_code == 200
    assert docx_response.data["allow_download"] is True
    docx.refresh_from_db()
    assert docx.allow_download is True


def test_stale_disabled_value_still_lets_students_download(
    student, student_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """ค่า "ปิด" ที่ค้างอยู่ในไฟล์ชนิดที่ปิดไม่ได้ ถือว่าเปิด — ผู้เรียนได้ลิงก์ดาวน์โหลด"""
    course.is_published = True
    course.save()
    enroll(course, student)
    module = make_module(course, is_published=True)
    make_file(module, "รายงาน.docx", DOCX, is_published=True, allow_download=False)

    content = student_client.get(modules_url(course)).data[0]["contents"][0]

    assert content["allow_download"] is True
    assert content["download_link"]


def test_replacing_with_unlockable_type_reenables_download(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """PDF ที่ปิดดาวน์โหลด → เปลี่ยนเป็น Word (เอกสารเหมือนกัน) → กลับเป็นดาวน์โหลดได้"""
    module = make_module(course)
    pdf = make_file(module, "สไลด์.pdf", "application/pdf", allow_download=False)

    response = teacher_client.post(
        contents_url(course, f"{pdf.pk}/file/"),
        {"file": upload("รายงาน.docx")},
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["allow_download"] is True
    assert response.data["can_disable_download"] is False
    pdf.refresh_from_db()
    assert pdf.allow_download is True
