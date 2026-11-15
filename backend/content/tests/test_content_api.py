"""
test API เนื้อหาของผู้สอน (ขั้น 4.3 ก) — ข้อความ / ลิงก์ / แก้ / ย้ายหน่วย / ลบ / เลื่อน / เผยแพร่
(อัปโหลด / เปลี่ยนไฟล์มาในขั้น 4.3 ข)
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from audit.models import AuditAction, AuditLog
from content.models import Content
from content.tests.conftest import contents_url, make_course, make_module, make_text, modules_url

pytestmark = pytest.mark.django_db

YOUTUBE = "https://youtu.be/Zp5MuPOtsSY?si=track"


def create_url(course: Course, module, kind: str) -> str:
    return modules_url(course, f"{module.pk}/contents/{kind}/")


# ---------- เพิ่ม ----------


def test_create_text_appends_unpublished(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course)
    make_text(module, order=2)

    response = teacher_client.post(
        create_url(course, module, "text"), {"title": "สรุป", "body": "# เงื่อนไข"}
    )

    assert response.status_code == 201
    assert response.data["content_type"] == "text"
    assert response.data["order"] == 3
    assert response.data["is_published"] is False
    assert response.data["body"] == "# เงื่อนไข"
    assert response.data["file_link"] is None


def test_create_text_requires_title(teacher_client: APIClient, course: Course) -> None:
    """ข้อความต้องมีหัวข้อ (ไม่มีชื่อไฟล์ให้ใช้แทน)"""
    module = make_module(course)

    response = teacher_client.post(create_url(course, module, "text"), {"title": " ", "body": "x"})

    assert response.status_code == 400
    assert response.data["fields"]["title"] == ["blank"]


def test_create_youtube_link_becomes_video(teacher_client: APIClient, course: Course) -> None:
    """ลิงก์ YouTube → ชนิด video + ลิงก์มาตรฐาน + หัวข้อตั้งให้ + รหัสวิดีโอ (กฎ1)"""
    module = make_module(course)

    response = teacher_client.post(create_url(course, module, "link"), {"url": YOUTUBE})

    assert response.status_code == 201
    assert response.data["content_type"] == "video"
    assert response.data["external_url"] == "https://www.youtube.com/watch?v=Zp5MuPOtsSY"
    assert response.data["youtube_id"] == "Zp5MuPOtsSY"
    assert response.data["title"] == "วิดีโอจาก YouTube"


def test_create_other_link_uses_site_name(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course)

    response = teacher_client.post(
        create_url(course, module, "link"),
        {"url": "https://docs.python.org/3/tutorial/", "title": ""},
    )

    assert response.status_code == 201
    assert response.data["content_type"] == "link"
    assert response.data["title"] == "docs.python.org"
    assert response.data["youtube_id"] is None


def test_create_link_keeps_given_title(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course)

    response = teacher_client.post(
        create_url(course, module, "link"), {"url": YOUTUBE, "title": "if, elif, else"}
    )

    assert response.data["title"] == "if, elif, else"


@pytest.mark.parametrize("url", ["javascript:alert(1)", "ftp://example.com/x", "not a url", ""])
def test_create_link_rejects_non_http(teacher_client: APIClient, course: Course, url: str) -> None:
    """รับเฉพาะลิงก์ http / https (กัน javascript: และลิงก์ผิดรูปแบบ)"""
    module = make_module(course)

    response = teacher_client.post(create_url(course, module, "link"), {"url": url})

    assert response.status_code == 400
    assert response.data["fields"]["url"] in (["invalid"], ["blank"])
    assert not Content.objects.exists()


# ---------- แก้ / ย้าย ----------


def test_update_fields(teacher_client: APIClient, course: Course) -> None:
    """แก้หัวข้อ / เนื้อความ ; ข้อความไม่มีไฟล์ → สวิตช์ดาวน์โหลดถูกข้าม (กพ1 — ไม่ error)"""
    content = make_text(make_module(course), "เดิม", body="เดิม")

    response = teacher_client.patch(
        contents_url(course, f"{content.pk}/"),
        {"title": "ใหม่", "body": "ใหม่", "allow_download": False},
    )

    assert response.status_code == 200
    content.refresh_from_db()
    assert (content.title, content.body, content.allow_download) == ("ใหม่", "ใหม่", True)


def test_update_rejects_blank_title(teacher_client: APIClient, course: Course) -> None:
    content = make_text(make_module(course), "เดิม")

    # ส่งแบบ JSON ตามที่หน้าเว็บส่งจริง (แบบฟอร์ม multipart: DRF ข้ามช่องไม่บังคับที่ว่าง แทนการแจ้ง blank)
    response = teacher_client.patch(
        contents_url(course, f"{content.pk}/"), {"title": ""}, format="json"
    )

    assert response.status_code == 400
    assert response.data["fields"]["title"] == ["blank"]


def test_move_to_other_module_appends(teacher_client: APIClient, course: Course) -> None:
    """ย้ายหน่วย → ไปต่อท้ายหน่วยใหม่"""
    source = make_module(course, "ต้นทาง")
    target = make_module(course, "ปลายทาง")
    make_text(target, order=0)
    make_text(target, order=1)
    content = make_text(source)

    response = teacher_client.patch(contents_url(course, f"{content.pk}/"), {"module": target.pk})

    assert response.status_code == 200
    assert response.data["module"] == target.pk
    assert response.data["order"] == 2


def test_cannot_move_into_other_course(teacher_client: APIClient, teacher, course: Course) -> None:
    """ย้ายไปหน่วยของวิชาอื่น (แม้เป็นวิชาของตัวเอง) → 404 และเนื้อหาไม่ย้าย"""
    other_course = make_course(teacher, code="204112")
    foreign = make_module(other_course)
    content = make_text(make_module(course))

    response = teacher_client.patch(contents_url(course, f"{content.pk}/"), {"module": foreign.pk})

    assert response.status_code == 404
    content.refresh_from_db()
    assert content.module.course == course


def test_update_link_keeps_kind(teacher_client: APIClient, course: Course) -> None:
    """แก้ลิงก์ได้ถ้าชนิดเดิม ; YouTube → ลิงก์ทั่วไป / ข้อความ → ลิงก์ = 409 content_kind_mismatch"""
    module = make_module(course)
    video = teacher_client.post(create_url(course, module, "link"), {"url": YOUTUBE}).data
    text = make_text(module)

    ok = teacher_client.patch(
        contents_url(course, f"{video['id']}/"),
        {"url": "https://www.youtube.com/shorts/abcdefghijk"},
    )
    changed_kind = teacher_client.patch(
        contents_url(course, f"{video['id']}/"), {"url": "https://docs.python.org/"}
    )
    text_to_link = teacher_client.patch(
        contents_url(course, f"{text.pk}/"), {"url": "https://docs.python.org/"}
    )

    assert ok.status_code == 200
    assert ok.data["youtube_id"] == "abcdefghijk"
    assert changed_kind.status_code == 409
    assert changed_kind.data["code"] == "content_kind_mismatch"
    assert text_to_link.status_code == 409


# ---------- ลบ / เลื่อน / เผยแพร่ ----------


def test_delete_logs_with_course_code(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course)
    content = make_text(module, "สรุป")

    response = teacher_client.delete(contents_url(course, f"{content.pk}/"))

    assert response.status_code == 204
    assert not Content.objects.exists()
    log = AuditLog.objects.get()
    assert log.action == AuditAction.DELETE
    assert log.object_repr == "สรุป (204111)"
    assert log.changes == {
        "title": ["สรุป", None],
        "content_type": ["text", None],
        "module": [module.pk, None],
    }


def test_move_within_module(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course)
    first = make_text(module, "ก", order=0)
    make_text(module, "ข", order=1)

    response = teacher_client.post(contents_url(course, f"{first.pk}/move/"), {"direction": "down"})

    assert response.status_code == 200
    assert response.data["order"] == 1
    assert list(module.contents.values_list("title", flat=True)) == ["ข", "ก"]


def test_publish_and_unpublish(teacher_client: APIClient, course: Course) -> None:
    content = make_text(make_module(course))

    published = teacher_client.post(contents_url(course, f"{content.pk}/publish/"))
    unpublished = teacher_client.post(contents_url(course, f"{content.pk}/unpublish/"))

    assert published.data["is_published"] is True
    assert unpublished.data["is_published"] is False
