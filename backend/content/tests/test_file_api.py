"""
test API อัปโหลด / เปลี่ยนไฟล์ของผู้สอน (ขั้น 4.3 ข)
- อัปโหลด: ระบบตั้งชนิดเอง, หัวข้อจากชื่อไฟล์, ไฟล์ชื่อสุ่ม, ลิงก์ดู / ดาวน์โหลด
- ไม่ผ่าน: ชนิดต้องห้าม / เนื้อไฟล์ไม่ตรง / ว่าง / ไม่มีไฟล์ → ไม่มีแถว และไม่มีไฟล์ค้าง
- เก็บไฟล์ไม่ได้ (กน1) → 503 ; บันทึกแถวไม่สำเร็จ → ไฟล์ที่เพิ่งเก็บถูกลบทิ้ง
- เปลี่ยนไฟล์: ชนิดเดิม, หัวข้อคงเดิม (กธ1), ไฟล์เก่าถูกลบหลังบันทึกเสร็จ
"""

from pathlib import Path
from unittest import mock

import pytest
from django.db import IntegrityError
from rest_framework.test import APIClient

from academics.models import Course
from content.models import Content
from content.services import download_url
from content.tests.conftest import contents_url, make_module, make_text, modules_url
from content.tests.samples import VALID_SAMPLES, upload

pytestmark = pytest.mark.django_db


@pytest.fixture
def media_in_tmp(settings, tmp_path: Path) -> Path:
    """เก็บไฟล์ที่อัปโหลดใน test ไว้ในโฟลเดอร์ชั่วคราว (ไม่ปน backend/media/)"""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


def stored_files(root: Path) -> list[Path]:
    """ไฟล์ทั้งหมดที่อยู่ในที่เก็บไฟล์ของ test"""
    return [path for path in root.rglob("*") if path.is_file()]


def upload_url(course: Course, module) -> str:
    return modules_url(course, f"{module.pk}/contents/file/")


def post_file(client: APIClient, url: str, name: str, data: bytes | None = None, **fields):
    return client.post(url, {"file": upload(name, data), **fields}, format="multipart")


# ---------- อัปโหลดสำเร็จ ----------


@pytest.mark.parametrize(
    "name", ["สไลด์.pdf", "แผนภาพ-for-loop.png", "สรุป.mp3", "if-elif-else.mp4", "รายงาน.docx"]
)
def test_upload_detects_kind_and_uses_file_name_as_title(
    teacher_client: APIClient, course: Course, media_in_tmp: Path, name: str
) -> None:
    """ไม่ต้องเลือกชนิด / ไม่ต้องกรอกหัวข้อ — ระบบตั้งให้จากไฟล์"""
    _, kind, mime = VALID_SAMPLES[name]
    module = make_module(course)

    response = post_file(teacher_client, upload_url(course, module), name)

    assert response.status_code == 201
    data = response.data
    assert (data["content_type"], data["mime_type"]) == (kind, mime)
    assert data["title"] == name.rsplit(".", 1)[0]
    assert data["file_name"] == name
    assert data["is_published"] is False
    assert data["allow_download"] is True
    assert data["file_link"].startswith("/media/content/")
    assert data["download_link"] == data["file_link"]  # ที่เก็บในเครื่อง: ลิงก์เดียวกัน (ดู test ด้านล่าง)
    content = Content.objects.get()
    assert name.rsplit(".", 1)[0] not in content.file_url.name  # ชื่อบนที่เก็บไฟล์เป็นชื่อสุ่ม
    assert (media_in_tmp / content.file_url.name).exists()


def test_upload_keeps_given_title_and_body(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    module = make_module(course)
    make_text(module, order=4)

    response = post_file(
        teacher_client,
        upload_url(course, module),
        "สไลด์.pdf",
        title="สไลด์: while และ for loop",
        body="อ่านก่อนเรียน",
    )

    assert response.data["title"] == "สไลด์: while และ for loop"
    assert response.data["body"] == "อ่านก่อนเรียน"
    assert response.data["order"] == 5


def test_download_url_asks_s3_storage_for_attachment() -> None:
    """ที่เก็บไฟล์แบบ S3 / B2 (ตอน deploy) ได้คำสั่งให้ดาวน์โหลดพร้อมชื่อเดิม (เข้ารหัสภาษาไทยแล้ว)"""
    content = Content(file_name="บทที่ 3.pdf")
    content.file_url.name = "content/1/abc.pdf"
    fake_storage = mock.Mock()
    fake_storage.url.return_value = "https://b2.example/abc.pdf?signed"
    content.file_url.storage = fake_storage  # แทนที่เก็บไฟล์ของแถวนี้ด้วยตัวจำลองแบบ S3
    assert download_url(content) == "https://b2.example/abc.pdf?signed"
    _, kwargs = fake_storage.url.call_args
    disposition = kwargs["parameters"]["ResponseContentDisposition"]
    assert disposition.startswith("attachment; filename*=UTF-8''")
    assert "%E0%B8%9A" in disposition  # "บ" ถูกเข้ารหัส


# ---------- อัปโหลดไม่ผ่าน ----------


@pytest.mark.parametrize(
    ("name", "data", "code"),
    [
        ("setup.exe", b"MZ" + b"\x00" * 64, "content_file_type_not_allowed"),
        ("หน้า.html", b"<script>alert(1)</script>", "content_file_type_not_allowed"),
        ("ใบงาน3.pdf", b"MZ" + b"\x00" * 64, "content_file_mismatch"),
        ("ว่าง.pdf", b"", "content_file_empty"),
    ],
)
def test_rejected_upload_leaves_nothing(
    teacher_client: APIClient,
    course: Course,
    media_in_tmp: Path,
    name: str,
    data: bytes,
    code: str,
) -> None:
    module = make_module(course)

    response = post_file(teacher_client, upload_url(course, module), name, data)

    assert response.status_code == 400
    assert response.data["code"] == code
    assert not Content.objects.exists()
    assert stored_files(media_in_tmp) == []


def test_too_large_reports_limit(
    teacher_client: APIClient, course: Course, media_in_tmp: Path, settings
) -> None:
    settings.CONTENT_MAX_BYTES = 40
    module = make_module(course)

    response = post_file(teacher_client, upload_url(course, module), "สไลด์.pdf")

    assert response.status_code == 400
    assert response.data["code"] == "content_file_too_large"
    assert response.data["max_bytes"] == 40


def test_missing_file_is_validation_error(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course)

    response = teacher_client.post(upload_url(course, module), {"title": "x"}, format="multipart")

    assert response.status_code == 400
    assert response.data["fields"]["file"] == ["required"]


def test_storage_failure_returns_503(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """เก็บไฟล์ไม่ได้ (เช่น B2 เต็ม — กน1) → 503 file_upload_failed และไม่มีแถว"""
    module = make_module(course)
    with mock.patch(
        "django.core.files.storage.FileSystemStorage.save", side_effect=OSError("disk full")
    ):
        response = post_file(teacher_client, upload_url(course, module), "สไลด์.pdf")

    assert response.status_code == 503
    assert response.data["code"] == "file_upload_failed"
    assert not Content.objects.exists()


def test_failed_row_save_removes_stored_file(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """เก็บไฟล์แล้วแต่บันทึกแถวไม่สำเร็จ → ไฟล์ที่เพิ่งเก็บถูกลบทิ้ง (ไม่มีไฟล์ค้าง)"""
    module = make_module(course)
    client = teacher_client
    client.raise_request_exception = False
    with mock.patch.object(Content, "save", side_effect=IntegrityError("boom")):
        response = post_file(client, upload_url(course, module), "สไลด์.pdf")

    assert response.status_code == 500
    assert not Content.objects.exists()
    assert stored_files(media_in_tmp) == []


def test_admin_cannot_upload(admin_client: APIClient, course: Course, media_in_tmp: Path) -> None:
    module = make_module(course)

    response = post_file(admin_client, upload_url(course, module), "สไลด์.pdf")

    assert response.status_code == 403
    assert response.data["code"] == "content_read_only"
    assert stored_files(media_in_tmp) == []


# ---------- เปลี่ยนไฟล์ ----------


def uploaded_content(client: APIClient, course: Course, name: str, **fields) -> dict:
    module = make_module(course)
    response = post_file(client, upload_url(course, module), name, **fields)
    assert response.status_code == 201
    return response.data


def test_replace_keeps_title_and_removes_old_file(
    teacher_client: APIClient,
    course: Course,
    media_in_tmp: Path,
    django_capture_on_commit_callbacks,
) -> None:
    """เปลี่ยนเป็นไฟล์ชนิดเดียวกัน (PDF → Word = เอกสาร) ; หัวข้อเดิมคงไว้ (กธ1) ; ไฟล์เก่าหาย"""
    original = uploaded_content(teacher_client, course, "สไลด์.pdf", title="สไลด์: while")
    old_path = media_in_tmp / Content.objects.get().file_url.name

    with django_capture_on_commit_callbacks(execute=True):
        response = post_file(
            teacher_client, contents_url(course, f"{original['id']}/file/"), "รายงาน.docx"
        )

    assert response.status_code == 200
    assert response.data["title"] == "สไลด์: while"
    assert response.data["file_name"] == "รายงาน.docx"
    assert response.data["mime_type"].endswith("wordprocessingml.document")
    assert not old_path.exists()
    assert len(stored_files(media_in_tmp)) == 1


def test_replace_with_other_kind_is_rejected(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """เอกสาร → วิดีโอ = 409 content_kind_mismatch ; ไฟล์เดิมยังอยู่ ไฟล์ใหม่ไม่ค้าง"""
    original = uploaded_content(teacher_client, course, "สไลด์.pdf")

    response = post_file(
        teacher_client, contents_url(course, f"{original['id']}/file/"), "if-elif-else.mp4"
    )

    assert response.status_code == 409
    assert response.data["code"] == "content_kind_mismatch"
    assert Content.objects.get().file_name == "สไลด์.pdf"
    assert len(stored_files(media_in_tmp)) == 1


def test_replace_on_content_without_file_is_rejected(
    teacher_client: APIClient, course: Course, media_in_tmp: Path
) -> None:
    """ข้อความ / ลิงก์ / วิดีโอ YouTube ไม่มีไฟล์ให้เปลี่ยน → 409"""
    text = make_text(make_module(course))

    response = post_file(teacher_client, contents_url(course, f"{text.pk}/file/"), "โจทย์.txt")

    assert response.status_code == 409
    assert response.data["code"] == "content_kind_mismatch"
    assert stored_files(media_in_tmp) == []


def test_delete_uploaded_content_removes_file(
    teacher_client: APIClient,
    course: Course,
    media_in_tmp: Path,
    django_capture_on_commit_callbacks,
) -> None:
    original = uploaded_content(teacher_client, course, "แผนภาพ-for-loop.png")

    with django_capture_on_commit_callbacks(execute=True):
        response = teacher_client.delete(contents_url(course, f"{original['id']}/"))

    assert response.status_code == 204
    assert stored_files(media_in_tmp) == []
