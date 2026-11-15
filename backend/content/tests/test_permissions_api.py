"""
test สิทธิ์ของ API เนื้อหารายวิชา (ขั้น 4.3 ก)
- ผู้สอนเจ้าของ: ดู + แก้
- ผู้ดูแลระบบ: ดูได้ แก้ได้ 403 content_read_only (กง1)
- ผู้สอนวิชาอื่น / ผู้เรียน (แม้กำลังเรียน): 404 ; ยังไม่เข้าสู่ระบบ: 401
- วิชาที่ปิดแล้ว: ผู้สอนแก้ได้ 409 course_closed (ดูยังได้)
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import enroll
from content.models import Module
from content.tests.conftest import (
    client_for,
    contents_url,
    make_course,
    make_module,
    make_text,
    modules_url,
)

pytestmark = pytest.mark.django_db


def write_requests(course: Course) -> list[tuple[str, str, dict]]:
    """คำขอแก้ไขทุกแบบ (วิธี, ที่อยู่, ข้อมูล) — ใช้ตรวจสิทธิ์ครบทุกที่อยู่"""
    module = make_module(course)
    content = make_text(module)
    return [
        ("post", modules_url(course), {"title": "ใหม่"}),
        ("patch", modules_url(course, f"{module.pk}/"), {"title": "แก้"}),
        ("post", modules_url(course, f"{module.pk}/publish/"), {}),
        ("post", modules_url(course, f"{module.pk}/unpublish/"), {}),
        ("post", modules_url(course, f"{module.pk}/move/"), {"direction": "up"}),
        ("post", modules_url(course, f"{module.pk}/contents/text/"), {"title": "ก"}),
        ("post", modules_url(course, f"{module.pk}/contents/link/"), {"url": "https://e.com/"}),
        ("patch", contents_url(course, f"{content.pk}/"), {"title": "แก้"}),
        ("post", contents_url(course, f"{content.pk}/publish/"), {}),
        ("post", contents_url(course, f"{content.pk}/move/"), {"direction": "up"}),
        ("delete", contents_url(course, f"{content.pk}/"), {}),
        ("delete", modules_url(course, f"{module.pk}/"), {}),
    ]


def test_admin_can_view_but_not_change(admin_client: APIClient, course: Course) -> None:
    """ผู้ดูแลระบบดูรายการได้ ; ทุกคำขอแก้ได้ 403 content_read_only และข้อมูลไม่เปลี่ยน"""
    make_module(course, "ดูได้")
    assert admin_client.get(modules_url(course)).status_code == 200

    for method, url, data in write_requests(course):
        response = getattr(admin_client, method)(url, data, format="json")
        assert response.status_code == 403, (method, url)
        assert response.data["code"] == "content_read_only"
    assert Module.objects.count() == 2
    assert not Module.objects.filter(title__in=["ใหม่", "แก้"]).exists()


def test_other_teacher_and_student_get_not_found(
    other_teacher, student, student_client: APIClient, course: Course
) -> None:
    """ผู้สอนวิชาอื่น และผู้เรียน (แม้กำลังเรียนวิชาเผยแพร่แล้ว) → 404 ทั้งดูและแก้"""
    course.is_published = True
    course.save()
    enroll(course, student)
    other_client = client_for(other_teacher)

    for client in (other_client, student_client):
        assert client.get(modules_url(course)).status_code == 404
        for method, url, data in write_requests(course):
            response = getattr(client, method)(url, data, format="json")
            assert response.status_code == 404, (method, url)


def test_anonymous_gets_401(course: Course) -> None:
    assert APIClient().get(modules_url(course)).status_code == 401


def test_closed_course_is_read_only(teacher_client: APIClient, course: Course) -> None:
    """วิชาที่ปิดแล้ว: ผู้สอนยังดูได้ แต่ทุกคำขอแก้ได้ 409 course_closed"""
    course.is_closed = True
    course.save()
    assert teacher_client.get(modules_url(course)).status_code == 200

    for method, url, data in write_requests(course):
        response = getattr(teacher_client, method)(url, data, format="json")
        assert response.status_code == 409, (method, url)
        assert response.data["code"] == "course_closed"


def test_ids_from_other_course_are_not_found(
    teacher_client: APIClient, teacher, course: Course
) -> None:
    """ส่งรหัสหน่วย / เนื้อหาของวิชาอื่นผ่านที่อยู่ของวิชานี้ → 404 (กันแก้ข้ามวิชา)"""
    other = make_course(teacher, code="204112")
    foreign_module = make_module(other)
    foreign_content = make_text(foreign_module)

    assert (
        teacher_client.patch(
            modules_url(course, f"{foreign_module.pk}/"), {"title": "x"}
        ).status_code
        == 404
    )
    assert teacher_client.delete(contents_url(course, f"{foreign_content.pk}/")).status_code == 404
    assert Module.objects.filter(pk=foreign_module.pk).exists()
