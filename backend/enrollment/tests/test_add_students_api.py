"""
test ของการเพิ่มผู้เรียนเข้าวิชา 1–500 คน (POST /api/v1/courses/{id}/enrollments/) — ขั้น 3.4
อ้างอิงพฤติกรรม: docs/api.md §9, CLAUDE.md "การตัดสินใจก้อน 3" (เพิ่มคนที่ถูกไปก่อน แล้วรายงานที่เหลือ)
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import client_for, enroll, make_course, make_user
from accounts.models import User
from audit.models import AuditAction, AuditLog
from enrollment.models import Enrollment
from enrollment.tests.conftest import enrollments_url

pytestmark = pytest.mark.django_db


def make_student(sid: str, **extra) -> User:
    """ผู้เรียนสมมติ อีเมล s<รหัส>@example.com"""
    return make_user(f"s{sid}@example.com", User.Role.STUDENT, student_or_staff_id=sid, **extra)


def add(client: APIClient, course: Course, *identifiers: str):
    """ส่งรายการเพิ่มผู้เรียน"""
    return client.post(enrollments_url(course), {"identifiers": list(identifiers)}, format="json")


def test_add_by_id_and_email(teacher_client: APIClient, teacher: User, course: Course) -> None:
    """เพิ่มด้วยรหัสนักศึกษาและอีเมล (ไม่สนตัวพิมพ์) → กำลังเรียน, ผู้เพิ่ม = ผู้สอน"""
    first = make_student("670510111")
    second = make_student("670510222")

    response = add(teacher_client, course, "670510111", "  S670510222@Example.com ")

    assert response.status_code == 200
    assert [row["identifier"] for row in response.data["added"]] == [
        "670510111",
        "s670510222@example.com",
    ]
    assert response.data["added"][0]["student"]["id"] == first.pk
    enrollment = Enrollment.objects.get(student=second)
    assert enrollment.status == Enrollment.Status.ACTIVE
    assert enrollment.enrolled_by == teacher


def test_each_added_student_is_audited(
    teacher_client: APIClient, teacher: User, course: Course
) -> None:
    """AuditLog enroll 1 รายการต่อคน"""
    make_student("670510111")
    make_student("670510222")

    add(teacher_client, course, "670510111", "670510222")

    logs = AuditLog.objects.filter(action=AuditAction.ENROLL)
    assert logs.count() == 2
    assert {log.actor for log in logs} == {teacher}
    assert logs.first().changes == {"status": [None, "active"]}


def test_failures_are_reported_in_pasted_order(teacher_client: APIClient, course: Course) -> None:
    """ไม่พบ / ไม่ใช่ผู้เรียน / ถูกระงับ → อยู่ใน failed ตามลำดับที่วาง ; คนที่ถูกยังถูกเพิ่ม"""
    make_student("670510111")
    make_user("t1024@example.com", User.Role.TEACHER, student_or_staff_id="T1024")
    make_student("660510412", is_active=False)

    response = add(teacher_client, course, "670519999", "670510111", "T1024", "660510412")

    assert response.data["failed"] == [
        {"identifier": "670519999", "reason": "not_found"},
        {"identifier": "T1024", "reason": "not_student"},
        {"identifier": "660510412", "reason": "suspended"},
    ]
    assert len(response.data["added"]) == 1
    assert Enrollment.objects.count() == 1


def test_already_enrolled_is_not_added_again(
    teacher_client: APIClient, course: Course, student: User
) -> None:
    """อยู่ในวิชาอยู่แล้ว → already, ไม่จดซ้ำ"""
    enroll(course, student)

    response = add(teacher_client, course, "670510118")

    assert [row["identifier"] for row in response.data["already"]] == ["670510118"]
    assert response.data["added"] == []
    assert not AuditLog.objects.exists()


def test_dropped_student_is_reactivated(
    teacher_client: APIClient, teacher: User, course: Course, student: User
) -> None:
    """เคยถูกถอน → ระเบียนเดิมกลับเป็นกำลังเรียน: เวลาเข้าร่วมใหม่, ล้างเวลาถอน, ผู้เพิ่ม = คนที่กด"""
    old = enroll(course, student, status=Enrollment.Status.DROPPED, dropped_at="2026-06-10T00:00Z")

    response = add(teacher_client, course, "670510118")

    assert [row["identifier"] for row in response.data["reactivated"]] == ["670510118"]
    old.refresh_from_db()
    assert old.status == Enrollment.Status.ACTIVE
    assert old.dropped_at is None
    assert old.enrolled_by == teacher
    assert Enrollment.objects.count() == 1
    assert AuditLog.objects.get().changes == {"status": ["dropped", "active"]}


def test_blank_and_duplicate_lines(teacher_client: APIClient, course: Course) -> None:
    """บรรทัดว่างข้าม ; ซ้ำนับครั้งเดียว ; คนเดียวกันมาทั้งรหัสและอีเมล → เพิ่มครั้งเดียว"""
    make_student("670510111")

    response = add(
        teacher_client, course, "", "670510111", "  ", "670510111", "s670510111@example.com"
    )

    assert len(response.data["added"]) == 1
    assert response.data["failed"] == []
    assert Enrollment.objects.count() == 1


def test_empty_list_is_rejected(teacher_client: APIClient, course: Course) -> None:
    """รายการว่าง / มีแต่บรรทัดว่าง → 400"""
    empty = add(teacher_client, course)
    blanks = add(teacher_client, course, "", "  ")

    assert empty.data["fields"] == {"identifiers": ["min_length"]}
    assert blanks.data["fields"] == {"identifiers": ["blank"]}


def test_more_than_500_lines_is_rejected(teacher_client: APIClient, course: Course) -> None:
    """เกิน 500 บรรทัด → 400 max_length และไม่เพิ่มใครเลย"""
    make_student("670510111")

    response = add(teacher_client, course, "670510111", *[f"x{n}" for n in range(500)])

    assert response.status_code == 400
    assert response.data["fields"] == {"identifiers": ["max_length"]}
    assert not Enrollment.objects.exists()


def test_exactly_500_lines_is_accepted(teacher_client: APIClient, course: Course) -> None:
    """500 บรรทัดพอดี → รับ (คนที่ไม่พบอยู่ใน failed)"""
    response = add(teacher_client, course, *[f"x{n}" for n in range(500)])

    assert response.status_code == 200
    assert len(response.data["failed"]) == 500


def test_closed_course_cannot_add(teacher_client: APIClient, teacher: User) -> None:
    """วิชาที่ปิดแล้ว → 409 course_closed"""
    make_student("670510111")
    closed = make_course(teacher, code="204100", is_published=True, is_closed=True)

    response = add(teacher_client, closed, "670510111")

    assert response.status_code == 409
    assert response.data["code"] == "course_closed"
    assert not Enrollment.objects.exists()


def test_unpublished_course_can_add(teacher_client: APIClient, course: Course) -> None:
    """วิชาที่ยังไม่เผยแพร่เพิ่มรายชื่อได้ (เตรียมก่อนเปิด)"""
    make_student("670510111")

    assert not course.is_published
    assert len(add(teacher_client, course, "670510111").data["added"]) == 1


def test_admin_adds_on_behalf(admin_client: APIClient, admin: User, course: Course) -> None:
    """ผู้ดูแลระบบเพิ่มแทนได้ → ผู้เพิ่ม / actor = ผู้ดูแลระบบ"""
    make_student("670510111")

    add(admin_client, course, "670510111")

    assert Enrollment.objects.get().enrolled_by == admin
    assert AuditLog.objects.get().actor == admin


def test_other_teacher_and_student_cannot_add(
    other_teacher: User, student_client: APIClient, course: Course
) -> None:
    """ผู้สอนคนอื่น / ผู้เรียน → 404"""
    make_student("670510111")

    assert add(client_for(other_teacher), course, "670510111").status_code == 404
    assert add(student_client, course, "670510111").status_code == 404
    assert not Enrollment.objects.exists()


def test_added_students_appear_in_course_count(teacher_client: APIClient, course: Course) -> None:
    """หลังเพิ่ม จำนวนผู้เรียนของวิชา (student_count) อัปเดตทันที"""
    make_student("670510111")
    make_student("670510222")
    add(teacher_client, course, "670510111", "670510222")

    response = teacher_client.get(f"/api/v1/courses/{course.pk}/")

    assert response.data["student_count"] == 2
    assert response.data["can_delete"] is False
