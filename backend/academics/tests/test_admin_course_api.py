"""
test ของรายการรายวิชาสำหรับผู้ดูแลระบบ (GET /api/v1/admin/courses/ และ …/terms/) — ขั้น 3.3
อ้างอิงพฤติกรรม: docs/api.md §8, CLAUDE.md "การตัดสินใจก้อน 3" (หน้าจัดการรายวิชา)
"""

import pytest
from rest_framework.test import APIClient

from academics.tests.conftest import (
    ADMIN_COURSES_URL,
    client_for,
    enroll,
    make_course,
    make_user,
)
from accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalog(teacher: User, other_teacher: User, student: User) -> None:
    """
    รายวิชาตัวอย่าง 5 วิชา:
    2569/1: 204111 (เผยแพร่, ผู้เรียน 1), 204212 (เผยแพร่, ผู้สอนอีกคน), 204331 (ยังไม่เผยแพร่)
    2568/2: 204111 (ปิดแล้ว), 204100 (ปิดแล้ว, ผู้สอนอีกคน)
    """
    python = make_course(teacher, is_published=True)
    enroll(python, student)
    make_course(other_teacher, code="204212", name="โครงสร้างข้อมูล", is_published=True)
    make_course(teacher, code="204331", name="วิศวกรรมซอฟต์แวร์")
    make_course(teacher, academic_year=2568, semester=2, is_published=True, is_closed=True)
    make_course(
        other_teacher,
        academic_year=2568,
        semester=2,
        code="204100",
        name="เทคโนโลยีสารสนเทศ",
        is_published=True,
        is_closed=True,
    )


def codes(response) -> list[tuple[int, int, str]]:
    """(ปี, ภาค, รหัส) ของทุกแถวในหน้านี้ ตามลำดับ"""
    return [(c["academic_year"], c["semester"], c["code"]) for c in response.data["results"]]


@pytest.mark.usefixtures("catalog")
def test_lists_all_courses_paginated(admin_client: APIClient) -> None:
    """ทุกวิชาทั้งระบบ เรียงภาคล่าสุดก่อน แล้วตามรหัส ; รูปแบบแบ่งหน้ามาตรฐาน"""
    response = admin_client.get(ADMIN_COURSES_URL)

    assert response.status_code == 200
    assert response.data["count"] == 5
    assert codes(response) == [
        (2569, 1, "204111"),
        (2569, 1, "204212"),
        (2569, 1, "204331"),
        (2568, 2, "204100"),
        (2568, 2, "204111"),
    ]
    first = response.data["results"][0]
    assert first["student_count"] == 1
    assert first["teacher"]["first_name"] == "กมล"


@pytest.mark.usefixtures("catalog")
@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("search=2042", ["204212"]),
        ("search=python", ["204111", "204111"]),
        ("term=2568-2", ["204100", "204111"]),
        ("status=draft", ["204331"]),
        ("status=published", ["204111", "204212"]),
        ("status=closed", ["204100", "204111"]),
        ("term=2569-1&status=published&search=โครง", ["204212"]),
    ],
)
def test_filters(admin_client: APIClient, query: str, expected: list[str]) -> None:
    """ค้นหารหัส/ชื่อ (ไม่สนตัวพิมพ์), กรองภาคเรียน, กรองสถานะ, ใช้หลายตัวกรองพร้อมกัน"""
    response = admin_client.get(f"{ADMIN_COURSES_URL}?{query}")

    assert [code for _, _, code in codes(response)] == expected


@pytest.mark.usefixtures("catalog")
def test_filter_by_teacher(admin_client: APIClient, other_teacher: User) -> None:
    response = admin_client.get(f"{ADMIN_COURSES_URL}?teacher={other_teacher.pk}")

    assert [code for _, _, code in codes(response)] == ["204212", "204100"]


@pytest.mark.parametrize("query", ["term=2569", "term=2569-4", "status=open", "teacher=abc"])
def test_invalid_filters(admin_client: APIClient, query: str) -> None:
    """ตัวกรองผิดรูปแบบ → 400 validation_error"""
    response = admin_client.get(f"{ADMIN_COURSES_URL}?{query}")

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"


def test_page_beyond_last_is_404(admin_client: APIClient) -> None:
    assert admin_client.get(f"{ADMIN_COURSES_URL}?page=5").status_code == 404


@pytest.mark.usefixtures("catalog")
def test_suspended_teacher_is_flagged(admin_client: APIClient, other_teacher: User) -> None:
    """บัญชีผู้สอนถูกระงับ → teacher.is_active = false (หน้าจอแสดงข้อความแดง)"""
    other_teacher.is_active = False
    other_teacher.save()

    response = admin_client.get(f"{ADMIN_COURSES_URL}?search=204212")

    assert response.data["results"][0]["teacher"]["is_active"] is False


@pytest.mark.parametrize("role", [User.Role.TEACHER, User.Role.STUDENT])
def test_admin_only(role: str) -> None:
    """ผู้สอน / ผู้เรียน → 403"""
    user = make_user(f"{role}9@example.com", role)

    assert client_for(user).get(ADMIN_COURSES_URL).status_code == 403
    assert client_for(user).get(f"{ADMIN_COURSES_URL}terms/").status_code == 403


@pytest.mark.usefixtures("catalog")
def test_terms_for_filter(admin_client: APIClient) -> None:
    """ภาคเรียนที่มีรายวิชาอยู่ ไม่ซ้ำ เรียงล่าสุดก่อน"""
    response = admin_client.get(f"{ADMIN_COURSES_URL}terms/")

    assert response.status_code == 200
    assert response.data == [
        {"academic_year": 2569, "semester": 1},
        {"academic_year": 2568, "semester": 2},
    ]
