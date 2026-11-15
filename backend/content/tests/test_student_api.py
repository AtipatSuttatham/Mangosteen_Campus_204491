"""
test API ผู้เรียนดูเนื้อหา (ขั้น 4.4) — GET /api/v1/courses/{id}/modules/ เมื่อผู้เรียกเป็นผู้เรียน
- เห็นเฉพาะหน่วยที่เผยแพร่ + เนื้อหาที่เผยแพร่ ; หน่วยที่ยังไม่มีเนื้อหาเผยแพร่ยังแสดง (กฝ1)
- ลิงก์ดาวน์โหลดตาม allow_download (กฑ2) ; ไม่มีข้อมูลภายใน
- ต้องกำลังเรียน + วิชาเผยแพร่แล้ว (วิชาที่ปิดดูย้อนหลังได้) ไม่งั้น 404
"""

from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import enroll
from content.models import Content, Module
from content.tests.conftest import make_module, make_text, modules_url

pytestmark = pytest.mark.django_db


@pytest.fixture
def media_in_tmp(settings, tmp_path: Path) -> Path:
    """เก็บไฟล์ใน test ไว้ในโฟลเดอร์ชั่วคราว (ไม่ปน backend/media/)"""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def live_course(course: Course, student) -> Course:
    """วิชาที่เผยแพร่แล้ว + ผู้เรียนกำลังเรียน"""
    course.is_published = True
    course.save()
    enroll(course, student)
    return course


def make_file(module: Module, name: str = "สไลด์.pdf", **fields) -> Content:
    """เนื้อหาแบบไฟล์ที่มีไฟล์จริงในที่เก็บไฟล์ของ test"""
    content = Content(
        module=module,
        title=name,
        content_type="file",
        file_name=name,
        file_size=4,
        mime_type="application/pdf",
        **fields,
    )
    content.file_url.save(name, ContentFile(b"%PDF"), save=False)
    content.save()
    return content


def test_sees_only_published_modules_and_contents(
    student_client: APIClient, live_course: Course
) -> None:
    """หน่วย / เนื้อหาที่ยังไม่เผยแพร่ไม่แสดง ; เรียงตามลำดับ"""
    second = make_module(live_course, "ฟังก์ชัน", order=1, is_published=True)
    first = make_module(live_course, "ก้าวแรก", order=0, is_published=True)
    make_module(live_course, "ฉบับร่าง", order=2)
    make_text(first, "ข", order=1, is_published=True)
    make_text(first, "ก", order=0, is_published=True)
    make_text(first, "ร่าง", order=2)

    response = student_client.get(modules_url(live_course))

    assert response.status_code == 200
    assert [m["id"] for m in response.data] == [first.pk, second.pk]
    assert [c["title"] for c in response.data[0]["contents"]] == ["ก", "ข"]


def test_published_content_inside_unpublished_module_is_hidden(
    student_client: APIClient, live_course: Course
) -> None:
    """เนื้อหาเผยแพร่แล้ว แต่หน่วยยังไม่เผยแพร่ → ไม่เห็นทั้งหน่วย"""
    hidden = make_module(live_course, "ร่าง")
    make_text(hidden, "เผยแพร่แล้วแต่ซ่อน", is_published=True)

    response = student_client.get(modules_url(live_course))

    assert response.data == []


def test_published_module_without_contents_is_shown(
    student_client: APIClient, live_course: Course
) -> None:
    """หน่วยที่เผยแพร่แต่ยังไม่มีเนื้อหาเผยแพร่ → แสดงหน่วย เนื้อหาว่าง (กฝ1)"""
    module = make_module(live_course, "ฟังก์ชัน", description="เร็ว ๆ นี้", is_published=True)
    make_text(module, "ร่าง")

    response = student_client.get(modules_url(live_course))

    assert response.data == [
        {"id": module.pk, "title": "ฟังก์ชัน", "description": "เร็ว ๆ นี้", "contents": []}
    ]


def test_download_link_follows_allow_download(
    student_client: APIClient, live_course: Course, media_in_tmp: Path
) -> None:
    """ปิดดาวน์โหลด → ไม่มีลิงก์ดาวน์โหลด แต่ยังเปิดดูได้ ; เปิด → มีทั้งสอง (กฑ2)"""
    module = make_module(live_course, is_published=True)
    make_file(module, "เปิด.pdf", order=0, is_published=True)
    make_file(module, "ปิด.pdf", order=1, is_published=True, allow_download=False)

    contents = student_client.get(modules_url(live_course)).data[0]["contents"]

    allowed, blocked = contents
    assert allowed["file_link"] and allowed["download_link"]
    assert blocked["file_link"]
    assert blocked["download_link"] is None
    assert blocked["allow_download"] is False


def test_response_has_no_internal_fields(student_client: APIClient, live_course: Course) -> None:
    """ผู้เรียนไม่ได้สถานะเผยแพร่ / ลำดับ / เวลา / หน่วยที่อยู่"""
    module = make_module(live_course, is_published=True)
    make_text(module, is_published=True)

    data = student_client.get(modules_url(live_course)).data[0]

    assert set(data) == {"id", "title", "description", "contents"}
    assert set(data["contents"][0]) == {
        "id",
        "title",
        "content_type",
        "body",
        "file_name",
        "file_size",
        "mime_type",
        "file_link",
        "download_link",
        "external_url",
        "youtube_id",
        "allow_download",
    }


def test_youtube_video_has_id(student_client: APIClient, live_course: Course) -> None:
    module = make_module(live_course, is_published=True)
    Content.objects.create(
        module=module,
        title="วิดีโอ",
        content_type="video",
        external_url="https://www.youtube.com/watch?v=Zp5MuPOtsSY",
        is_published=True,
    )

    content = student_client.get(modules_url(live_course)).data[0]["contents"][0]

    assert content["youtube_id"] == "Zp5MuPOtsSY"
    assert content["download_link"] is None


def test_not_enrolled_dropped_or_unpublished_course_is_not_found(
    student, student_client: APIClient, course: Course
) -> None:
    """ไม่ได้เรียน / ถูกถอน / วิชายังไม่เผยแพร่ → 404 (ไม่บอกว่ามีวิชานี้)"""
    make_module(course, is_published=True)
    assert student_client.get(modules_url(course)).status_code == 404  # วิชายังไม่เผยแพร่ + ไม่ได้เรียน

    course.is_published = True
    course.save()
    assert student_client.get(modules_url(course)).status_code == 404  # ไม่ได้เรียน

    enroll(course, student, status="dropped", dropped_at=timezone.now())
    assert student_client.get(modules_url(course)).status_code == 404  # ถูกถอน

    course.is_published = False
    course.save()
    course.enrollments.update(status="active", dropped_at=None)
    assert student_client.get(modules_url(course)).status_code == 404  # กำลังเรียน แต่วิชาถูกยกเลิกเผยแพร่


def test_closed_course_is_still_readable(student_client: APIClient, live_course: Course) -> None:
    """วิชาที่ปิดแล้ว ผู้เรียนยังดูเนื้อหาย้อนหลังได้"""
    make_text(make_module(live_course, is_published=True), is_published=True)
    live_course.is_closed = True
    live_course.save()

    response = student_client.get(modules_url(live_course))

    assert response.status_code == 200
    assert len(response.data[0]["contents"]) == 1


def test_teacher_still_gets_full_view(teacher_client: APIClient, live_course: Course) -> None:
    """ผู้สอนยังได้ทุกสถานะ + ข้อมูลภายใน (ไม่กระทบขั้น 4.3)"""
    make_text(make_module(live_course, "ร่าง"), "ร่าง")

    data = teacher_client.get(modules_url(live_course)).data

    assert len(data) == 1
    assert data[0]["is_published"] is False
    assert data[0]["contents"][0]["is_published"] is False


def test_query_count_does_not_grow_with_modules(
    student_client: APIClient, live_course: Course, django_assert_max_num_queries
) -> None:
    """จำนวนคำสั่งฐานข้อมูลคงที่ ไม่ว่ามีกี่หน่วย (กันหน้าช้าเมื่อเนื้อหาเยอะ)"""
    for number in range(8):
        module = make_module(live_course, f"หน่วย {number}", order=number, is_published=True)
        make_text(module, is_published=True)
        make_text(module, is_published=True)

    with django_assert_max_num_queries(8):
        response = student_client.get(modules_url(live_course))

    assert len(response.data) == 8
