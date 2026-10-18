"""
test ของรายชื่อผู้เรียนในวิชา (แท็บผู้เรียน) และการค้นหาผู้เรียนเพื่อเพิ่ม — ขั้น 3.4
อ้างอิงพฤติกรรม: docs/api.md §9, CLAUDE.md "การตัดสินใจก้อน 3"
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import client_for, enroll, make_course, make_user
from accounts.models import User
from enrollment.models import Enrollment
from enrollment.tests.conftest import enrollments_url

pytestmark = pytest.mark.django_db

DROPPED_AT = "2026-06-10T00:00Z"


def make_student(sid: str, first: str, last: str, **extra) -> User:
    """ผู้เรียนสมมติที่มีรหัสนักศึกษา"""
    return make_user(
        f"s{sid}@example.com",
        User.Role.STUDENT,
        first_name=first,
        last_name=last,
        student_or_staff_id=sid,
        **extra,
    )


@pytest.fixture
def roster(course: Course, teacher: User, admin: User) -> dict[str, Enrollment]:
    """
    ผู้เรียน 4 คนในวิชา: 2 คนเข้าร่วมด้วยรหัส / ผู้สอนเพิ่ม / ผู้ดูแลระบบเพิ่ม (คนหนึ่งบัญชีถูกระงับ)
    + 1 คนถูกถอน
    """
    return {
        "b": enroll(course, make_student("670510222", "พิมพ์รดา", "ศรีสุข")),
        "a": enroll(course, make_student("670510111", "ธนพล", "ใจดี"), enrolled_by=teacher),
        "c": enroll(
            course, make_student("670510333", "วิชัย", "ทองมา", is_active=False), enrolled_by=admin
        ),
        "d": enroll(
            course,
            make_student("670510444", "อรวรรณ", "แสงทอง"),
            status=Enrollment.Status.DROPPED,
            dropped_at=DROPPED_AT,
        ),
    }


# ---------------------------------------------------------------- รายชื่อผู้เรียน


@pytest.mark.usefixtures("roster")
def test_roster_lists_active_students_sorted_by_id(
    teacher_client: APIClient, course: Course
) -> None:
    """ค่าเริ่มต้น = กำลังเรียน เรียงตามรหัสนักศึกษา + ตัวเลขของทั้งสองสถานะ"""
    response = teacher_client.get(enrollments_url(course))

    assert response.status_code == 200
    ids = [row["student"]["student_or_staff_id"] for row in response.data["results"]]
    assert ids == ["670510111", "670510222", "670510333"]
    assert response.data["count"] == 3
    assert response.data["counts"] == {"active": 3, "dropped": 1}


@pytest.mark.usefixtures("roster")
def test_row_shows_method_and_suspended_flag(teacher_client: APIClient, course: Course) -> None:
    """วิธีเข้าร่วมดูจากผู้เพิ่ม ; บัญชีถูกระงับยังแสดงพร้อม is_active = false"""
    rows = {
        row["student"]["student_or_staff_id"]: row
        for row in teacher_client.get(enrollments_url(course)).data["results"]
    }

    assert rows["670510111"]["method"] == "teacher"
    assert rows["670510222"]["method"] == "join_code"
    assert rows["670510333"]["method"] == "admin"
    assert rows["670510333"]["student"]["is_active"] is False
    assert rows["670510111"]["dropped_at"] is None


@pytest.mark.usefixtures("roster")
def test_roster_dropped_tab(teacher_client: APIClient, course: Course) -> None:
    """ตัวกรอง "ถูกถอน" แสดงเฉพาะคนที่ถูกถอนพร้อมเวลาถอน"""
    response = teacher_client.get(f"{enrollments_url(course)}?status=dropped")

    results = response.data["results"]
    assert [row["student"]["first_name"] for row in results] == ["อรวรรณ"]
    assert results[0]["status"] == "dropped"
    assert results[0]["dropped_at"] is not None


@pytest.mark.usefixtures("roster")
@pytest.mark.parametrize(
    ("search", "expected"),
    [("ธนพล ใจดี", ["ธนพล"]), ("0510222", ["พิมพ์รดา"]), ("S670510333@", ["วิชัย"])],
)
def test_roster_search(
    teacher_client: APIClient, course: Course, search: str, expected: list[str]
) -> None:
    """ค้นหาชื่อเต็ม / รหัส / อีเมล (ไม่สนตัวพิมพ์) ; ตัวเลขบนปุ่มกรองไม่เปลี่ยนตามคำค้น"""
    response = teacher_client.get(enrollments_url(course), {"search": search})

    assert [row["student"]["first_name"] for row in response.data["results"]] == expected
    assert response.data["counts"] == {"active": 3, "dropped": 1}


def test_roster_is_paginated(teacher_client: APIClient, course: Course) -> None:
    """หน้าละ 20 คน"""
    for number in range(21):
        enroll(course, make_student(f"6705109{number:02d}", "ผู้เรียน", f"{number}"))

    first = teacher_client.get(enrollments_url(course))
    second = teacher_client.get(enrollments_url(course), {"page": 2})

    assert len(first.data["results"]) == 20
    assert len(second.data["results"]) == 1


def test_invalid_status_filter(teacher_client: APIClient, course: Course) -> None:
    response = teacher_client.get(enrollments_url(course), {"status": "pending"})

    assert response.status_code == 400
    assert response.data["fields"] == {"status": ["invalid_choice"]}


def test_admin_sees_roster(admin_client: APIClient, course: Course) -> None:
    assert admin_client.get(enrollments_url(course)).status_code == 200


def test_closed_course_roster_is_readable(teacher_client: APIClient, teacher: User) -> None:
    """วิชาที่ปิดแล้วยังดูรายชื่อได้"""
    closed = make_course(teacher, code="204100", is_closed=True)

    assert teacher_client.get(enrollments_url(closed)).status_code == 200


def test_other_teacher_and_student_get_404(
    other_teacher: User, student_client: APIClient, student: User, course: Course
) -> None:
    """ผู้สอนคนอื่น / ผู้เรียน (แม้อยู่ในวิชา) → 404"""
    enroll(course, student)

    assert client_for(other_teacher).get(enrollments_url(course)).status_code == 404
    assert student_client.get(enrollments_url(course)).status_code == 404


# ---------------------------------------------------------------- ค้นหาผู้เรียนเพื่อเพิ่ม


@pytest.mark.usefixtures("roster")
def test_candidates_show_status_in_course(teacher_client: APIClient, course: Course) -> None:
    """ผลค้นหาบอกสถานะกับวิชานี้: ยังไม่อยู่ = null, อยู่แล้ว = active, เคยถูกถอน = dropped"""
    make_student("670510555", "สมศักดิ์", "มีสุข")

    response = teacher_client.get(enrollments_url(course, "candidates/"), {"search": "6705"})

    assert response.status_code == 200
    by_id = {row["student_or_staff_id"]: row["enrollment_status"] for row in response.data}
    # วิชัย (670510333) บัญชีถูกระงับ → ไม่อยู่ในผลค้นหา
    assert by_id == {
        "670510111": "active",
        "670510222": "active",
        "670510444": "dropped",
        "670510555": None,
    }


def test_candidates_only_active_students(teacher_client: APIClient, course: Course) -> None:
    """ผู้สอน / ผู้ดูแลระบบ / ผู้เรียนที่ถูกระงับ ไม่อยู่ในผลค้นหา"""
    make_user("teacher2@example.com", User.Role.TEACHER, first_name="สมชาย")
    make_user("admin2@example.com", User.Role.ADMIN, first_name="สมชาย")
    make_student("670510666", "สมชาย", "ถูกระงับ", is_active=False)
    make_student("670510777", "สมชาย", "ใช้งานได้")

    response = teacher_client.get(enrollments_url(course, "candidates/"), {"search": "สมชาย"})

    assert [row["last_name"] for row in response.data] == ["ใช้งานได้"]


def test_candidates_limited_to_ten(teacher_client: APIClient, course: Course) -> None:
    for number in range(12):
        make_student(f"6705108{number:02d}", "ผู้เรียน", f"{number}")

    response = teacher_client.get(enrollments_url(course, "candidates/"), {"search": "ผู้เรียน"})

    assert len(response.data) == 10


@pytest.mark.parametrize("search", ["", "ส"])
def test_candidates_need_two_characters(
    teacher_client: APIClient, course: Course, search: str
) -> None:
    """คำค้นว่าง / 1 ตัวอักษร → 400"""
    response = teacher_client.get(enrollments_url(course, "candidates/"), {"search": search})

    assert response.status_code == 400
    assert "search" in response.data["fields"]


def test_candidates_need_course_access(other_teacher: User, course: Course) -> None:
    response = client_for(other_teacher).get(
        enrollments_url(course, "candidates/"), {"search": "สม"}
    )

    assert response.status_code == 404
