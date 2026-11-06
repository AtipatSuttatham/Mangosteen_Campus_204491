"""
test ของการตรวจรายการก่อนเพิ่มผู้เรียน (POST /api/v1/courses/{id}/enrollments/preview/) — ขั้น 3.6
อ้างอิงพฤติกรรม: docs/api.md §9, CLAUDE.md "การตัดสินใจก้อน 3" (ตรวจรายการก่อนเพิ่ม)
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import client_for, enroll, make_user
from accounts.models import User
from audit.models import AuditLog
from enrollment.models import Enrollment
from enrollment.tests.conftest import enrollments_url

pytestmark = pytest.mark.django_db


def make_student(sid: str, **extra) -> User:
    """ผู้เรียนสมมติ อีเมล s<รหัส>@example.com"""
    return make_user(f"s{sid}@example.com", User.Role.STUDENT, student_or_staff_id=sid, **extra)


def drop_student(course: Course, student: User) -> Enrollment:
    """ผู้เรียนที่เคยถูกถอนจากวิชา"""
    enrollment = enroll(course, student)
    enrollment.status = Enrollment.Status.DROPPED
    enrollment.dropped_at = enrollment.enrolled_at
    enrollment.save()
    return enrollment


def preview(client: APIClient, course: Course, *identifiers: str):
    """ส่งรายการตรวจก่อนเพิ่ม"""
    return client.post(
        enrollments_url(course, "preview/"), {"identifiers": list(identifiers)}, format="json"
    )


def test_each_result_in_pasted_order(teacher_client: APIClient, course: Course) -> None:
    """แต่ละรายการบอกผลเมื่อกดเพิ่ม เรียงตามลำดับที่วาง"""
    new = make_student("670510111")
    enroll(course, make_student("670510222"))
    drop_student(course, make_student("670510333"))
    make_student("670510444", is_active=False)
    make_user("t2@example.com", User.Role.TEACHER, student_or_staff_id="T0002")

    response = preview(
        teacher_client,
        course,
        "670510111",
        "670510222",
        "670510333",
        "670510444",
        "T0002",
        "670519999",
    )

    assert response.status_code == 200
    assert [(row["identifier"], row["result"]) for row in response.data["rows"]] == [
        ("670510111", "add"),
        ("670510222", "already"),
        ("670510333", "reactivate"),
        ("670510444", "suspended"),
        ("T0002", "not_student"),
        ("670519999", "not_found"),
    ]
    assert response.data["rows"][0]["student"]["id"] == new.pk
    assert response.data["rows"][0]["student"]["email"] == "s670510111@example.com"
    assert response.data["duplicates"] == 0


def test_rows_that_cannot_be_added_show_no_account(
    teacher_client: APIClient, course: Course
) -> None:
    """เพิ่มไม่ได้ → ไม่ส่งข้อมูลบัญชี แม้บัญชีมีอยู่จริง (ไม่แสดงข้อมูลเกินจำเป็น)"""
    make_student("670510444", is_active=False)
    make_user("t2@example.com", User.Role.TEACHER, student_or_staff_id="T0002")

    rows = preview(teacher_client, course, "670510444", "T0002").data["rows"]

    assert [row["student"] for row in rows] == [None, None]


def test_duplicates_are_counted_once(teacher_client: APIClient, course: Course) -> None:
    """รหัสซ้ำ / อีเมลคนละตัวพิมพ์ / คนเดียวกันมาทั้งรหัสและอีเมล → 1 แถว ; บรรทัดว่างไม่นับ"""
    make_student("670510111")

    response = preview(
        teacher_client,
        course,
        "670510111",
        "670510111",
        "S670510111@example.com",
        "s670510111@EXAMPLE.com",
        "   ",
    )

    assert [row["identifier"] for row in response.data["rows"]] == ["670510111"]
    assert response.data["duplicates"] == 3


def test_preview_saves_nothing(teacher_client: APIClient, course: Course) -> None:
    """ตรวจรายการไม่เพิ่มใคร ไม่เพิ่มกลับ และไม่จด AuditLog"""
    make_student("670510111")
    enrollment = drop_student(course, make_student("670510333"))
    logs_before = AuditLog.objects.count()

    preview(teacher_client, course, "670510111", "670510333")

    assert Enrollment.objects.filter(course=course).count() == 1
    enrollment.refresh_from_db()
    assert enrollment.status == Enrollment.Status.DROPPED
    assert AuditLog.objects.count() == logs_before


def test_preview_matches_real_add(teacher_client: APIClient, course: Course) -> None:
    """ผลตรวจตรงกับผลการเพิ่มจริง"""
    make_student("670510111")
    drop_student(course, make_student("670510333"))
    identifiers = ["670510111", "670510333", "670519999"]

    results = [row["result"] for row in preview(teacher_client, course, *identifiers).data["rows"]]
    added = teacher_client.post(
        enrollments_url(course), {"identifiers": identifiers}, format="json"
    ).data

    assert results == ["add", "reactivate", "not_found"]
    assert len(added["added"]) == 1
    assert len(added["reactivated"]) == 1
    assert added["failed"] == [{"identifier": "670519999", "reason": "not_found"}]


def test_list_limits_match_add(teacher_client: APIClient, course: Course) -> None:
    """เกิน 500 รายการ / ว่างทั้งหมด → 400 เหมือนการเพิ่ม"""
    too_many = preview(teacher_client, course, *[str(n) for n in range(501)])
    blank = preview(teacher_client, course, "  ", "")

    assert too_many.status_code == 400
    assert too_many.data["fields"]["identifiers"] == ["max_length"]
    assert blank.status_code == 400
    assert blank.data["fields"]["identifiers"] == ["blank"]


def test_closed_course_is_rejected(teacher_client: APIClient, course: Course) -> None:
    """วิชาที่ปิดแล้วเพิ่มผู้เรียนไม่ได้ จึงตรวจรายการไม่ได้ด้วย"""
    course.is_closed = True
    course.save(update_fields=["is_closed"])

    response = preview(teacher_client, course, "670510111")

    assert response.status_code == 409
    assert response.data["code"] == "course_closed"


def test_admin_can_preview(admin_client: APIClient, course: Course) -> None:
    """ผู้ดูแลระบบตรวจแทนผู้สอนได้"""
    make_student("670510111")

    assert preview(admin_client, course, "670510111").status_code == 200


def test_other_people_get_404(
    other_teacher: User, student_client: APIClient, course: Course
) -> None:
    """ผู้สอนคนอื่น / ผู้เรียน → 404 (ไม่บอกว่ามีวิชานี้)"""
    assert preview(client_for(other_teacher), course, "670510111").status_code == 404
    assert preview(student_client, course, "670510111").status_code == 404
