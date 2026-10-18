"""
test ของการถอนผู้เรียน (POST /api/v1/courses/{id}/enrollments/{enrollment_id}/drop/) — ขั้น 3.4
อ้างอิงพฤติกรรม: docs/api.md §9, docs/database-guide.md W4
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import client_for, enroll, make_course
from accounts.models import User
from audit.models import AuditAction, AuditLog
from enrollment.models import Enrollment
from enrollment.tests.conftest import enrollments_url

pytestmark = pytest.mark.django_db


def drop_url(enrollment: Enrollment) -> str:
    return enrollments_url(enrollment.course, f"{enrollment.pk}/drop/")


def test_drop_student(
    teacher_client: APIClient, teacher: User, course: Course, student: User
) -> None:
    """ถอน → ถูกถอน + เวลาถอน, ระเบียนยังอยู่, AuditLog unenroll"""
    enrollment = enroll(course, student)

    response = teacher_client.post(drop_url(enrollment))

    assert response.status_code == 200
    assert response.data["status"] == "dropped"
    assert response.data["dropped_at"] is not None
    enrollment.refresh_from_db()
    assert enrollment.status == Enrollment.Status.DROPPED
    log = AuditLog.objects.get()
    assert (log.action, log.actor, log.changes) == (
        AuditAction.UNENROLL,
        teacher,
        {"status": ["active", "dropped"]},
    )


def test_drop_twice_is_not_audited_again(
    teacher_client: APIClient, course: Course, student: User
) -> None:
    enrollment = enroll(course, student)
    teacher_client.post(drop_url(enrollment))

    response = teacher_client.post(drop_url(enrollment))

    assert response.status_code == 200
    assert AuditLog.objects.count() == 1


def test_dropped_student_loses_access(
    teacher_client: APIClient, student_client: APIClient, teacher: User, student: User
) -> None:
    """ถอนแล้ว ผู้เรียนเปิดวิชาไม่ได้ และวิชาหายจาก "รายวิชาของฉัน" """
    course = make_course(teacher, is_published=True)
    enrollment = enroll(course, student)

    teacher_client.post(drop_url(enrollment))

    assert student_client.get(f"/api/v1/courses/{course.pk}/").status_code == 404
    assert student_client.get("/api/v1/courses/").data == []


def test_drop_then_add_back_keeps_same_record(
    teacher_client: APIClient, course: Course, student: User
) -> None:
    """ถอนแล้วเพิ่มกลับ → ระเบียนเดิม (id เดิม)"""
    enrollment = enroll(course, student)
    teacher_client.post(drop_url(enrollment))

    teacher_client.post(enrollments_url(course), {"identifiers": ["670510118"]}, format="json")

    assert Enrollment.objects.get().pk == enrollment.pk
    assert Enrollment.objects.get().status == Enrollment.Status.ACTIVE


def test_closed_course_cannot_drop(teacher_client: APIClient, teacher: User, student: User) -> None:
    """วิชาที่ปิดแล้ว → 409 course_closed"""
    closed = make_course(teacher, code="204100", is_published=True, is_closed=True)
    enrollment = enroll(closed, student)

    response = teacher_client.post(drop_url(enrollment))

    assert response.status_code == 409
    assert response.data["code"] == "course_closed"


def test_enrollment_of_another_course_is_404(
    teacher_client: APIClient, teacher: User, course: Course, student: User
) -> None:
    """ระเบียนของวิชาอื่น (แม้เป็นวิชาของตัวเอง) ผ่านที่อยู่ของวิชานี้ไม่ได้ → 404"""
    other = make_course(teacher, code="204212")
    enrollment = enroll(other, student)

    response = teacher_client.post(enrollments_url(course, f"{enrollment.pk}/drop/"))

    assert response.status_code == 404
    enrollment.refresh_from_db()
    assert enrollment.status == Enrollment.Status.ACTIVE


def test_other_teacher_and_student_cannot_drop(
    other_teacher: User, student_client: APIClient, course: Course, student: User
) -> None:
    enrollment = enroll(course, student)

    assert client_for(other_teacher).post(drop_url(enrollment)).status_code == 404
    assert student_client.post(drop_url(enrollment)).status_code == 404


def test_admin_drops_on_behalf(
    admin_client: APIClient, admin: User, course: Course, student: User
) -> None:
    enrollment = enroll(course, student)

    assert admin_client.post(drop_url(enrollment)).status_code == 200
    assert AuditLog.objects.get().actor == admin
