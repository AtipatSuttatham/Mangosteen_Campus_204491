"""
test ของรายวิชา 1 วิชา: ดู (GET) / แก้ (PATCH) / ลบ (DELETE) /api/v1/courses/{id}/ — ขั้น 3.3
อ้างอิงพฤติกรรม: docs/api.md §8, CLAUDE.md "การตัดสินใจก้อน 3"
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import client_for, course_url, enroll, make_course, make_user
from accounts.models import User
from audit.models import AuditAction, AuditLog
from enrollment.models import Enrollment

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------- GET


def test_owner_sees_full_course(teacher_client: APIClient, course: Course) -> None:
    """ผู้สอนเจ้าของเห็นข้อมูลเต็ม"""
    response = teacher_client.get(course_url(course))

    assert response.status_code == 200
    assert response.data["code"] == "204111"
    assert "join_code" in response.data
    assert response.data["can_delete"] is True


def test_admin_sees_any_course(admin_client: APIClient, course: Course) -> None:
    """ผู้ดูแลระบบเห็นทุกวิชา (ทำแทนผู้สอน)"""
    assert admin_client.get(course_url(course)).status_code == 200


def test_other_teacher_gets_404(other_teacher: User, course: Course) -> None:
    """ผู้สอนคนอื่น → 404 (ไม่บอกว่ามีวิชานี้อยู่)"""
    response = client_for(other_teacher).get(course_url(course))

    assert response.status_code == 404
    assert response.data["code"] == "not_found"


def test_unknown_course_gets_404(teacher_client: APIClient) -> None:
    assert teacher_client.get("/api/v1/courses/999999/").status_code == 404


def test_enrolled_student_sees_course_header(
    student_client: APIClient, student: User, teacher: User
) -> None:
    """ผู้เรียนที่กำลังเรียน + วิชาเผยแพร่แล้ว → เห็นหัวรายวิชา (ไม่มีรหัสเข้าร่วม)"""
    course = make_course(teacher, is_published=True, join_code="K7Q2XM9A", join_code_enabled=True)
    enroll(course, student)

    response = student_client.get(course_url(course))

    assert response.status_code == 200
    assert response.data["name"] == "Python พื้นฐาน"
    assert "join_code" not in response.data
    assert response.data["teacher"]["first_name"] == "กมล"


def test_student_still_sees_closed_course(
    student_client: APIClient, student: User, teacher: User
) -> None:
    """วิชาที่ปิดแล้ว: ผู้เรียนยังดูย้อนหลังได้"""
    course = make_course(teacher, is_published=True, is_closed=True)
    enroll(course, student)

    response = student_client.get(course_url(course))

    assert response.status_code == 200
    assert response.data["is_closed"] is True


@pytest.mark.parametrize("case", ["not_enrolled", "unpublished", "dropped"])
def test_student_without_access_gets_404(
    student_client: APIClient, student: User, teacher: User, case: str
) -> None:
    """ไม่ได้ลง / วิชายังไม่เผยแพร่ / ถูกถอนแล้ว → 404"""
    course = make_course(teacher, is_published=case != "unpublished")
    if case == "unpublished":
        enroll(course, student)
    elif case == "dropped":
        enroll(course, student, status=Enrollment.Status.DROPPED, dropped_at="2026-06-10T00:00Z")

    assert student_client.get(course_url(course)).status_code == 404


# ---------------------------------------------------------------- PATCH


def test_owner_edits_course(teacher_client: APIClient, course: Course, teacher: User) -> None:
    """แก้ชื่อ / คำอธิบาย → 200 ค่าใหม่ + AuditLog เฉพาะช่องที่เปลี่ยน"""
    response = teacher_client.patch(
        course_url(course),
        {"name": "Python เบื้องต้น", "description": "ตัวแปร เงื่อนไข", "code": "204111"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["name"] == "Python เบื้องต้น"
    log = AuditLog.objects.get()
    assert log.action == AuditAction.UPDATE
    assert log.actor == teacher
    assert log.changes == {
        "name": ["Python พื้นฐาน", "Python เบื้องต้น"],
        "description": ["", "ตัวแปร เงื่อนไข"],
    }


def test_edit_without_changes_is_not_audited(teacher_client: APIClient, course: Course) -> None:
    """ส่งค่าเดิม → 200 แต่ไม่จด"""
    response = teacher_client.patch(course_url(course), {"name": "Python พื้นฐาน"}, format="json")

    assert response.status_code == 200
    assert not AuditLog.objects.exists()


def test_edit_to_duplicate_code(teacher_client: APIClient, course: Course, teacher: User) -> None:
    """แก้รหัส / ภาคให้ชนกับวิชาอื่นในภาคเดียวกัน → course_code_duplicate"""
    make_course(teacher, code="204212")
    make_course(teacher, code="204111", semester=2)

    by_code = teacher_client.patch(course_url(course), {"code": "204212"}, format="json")
    by_term = teacher_client.patch(course_url(course), {"semester": 2}, format="json")

    assert by_code.data["fields"] == {"code": ["course_code_duplicate"]}
    assert by_term.data["fields"] == {"code": ["course_code_duplicate"]}


def test_edit_keeps_own_code(teacher_client: APIClient, course: Course) -> None:
    """แก้ช่องอื่นโดยรหัสเดิม → ไม่นับว่าซ้ำกับตัวเอง"""
    response = teacher_client.patch(course_url(course), {"academic_year": 2570}, format="json")

    assert response.status_code == 200
    assert response.data["academic_year"] == 2570


def test_teacher_cannot_change_teacher(
    teacher_client: APIClient, course: Course, other_teacher: User
) -> None:
    """ผู้สอนเปลี่ยนผู้สอนไม่ได้ → 403 และวิชาไม่เปลี่ยน"""
    response = teacher_client.patch(
        course_url(course), {"teacher": other_teacher.pk}, format="json"
    )

    assert response.status_code == 403
    course.refresh_from_db()
    assert course.teacher_id != other_teacher.pk


def test_teacher_field_on_foreign_course_is_404(other_teacher: User, course: Course) -> None:
    """ส่ง teacher มากับวิชาที่ไม่ใช่ของตัวเอง → 404 (ไม่บอกว่ามีวิชานี้)"""
    response = client_for(other_teacher).patch(
        course_url(course), {"teacher": other_teacher.pk}, format="json"
    )

    assert response.status_code == 404


def test_admin_changes_teacher(
    admin_client: APIClient, admin: User, course: Course, teacher: User, other_teacher: User
) -> None:
    """ผู้ดูแลระบบเปลี่ยนผู้สอน → AuditLog update {teacher: [เดิม, ใหม่]} โดย actor = ผู้ดูแลระบบ"""
    response = admin_client.patch(course_url(course), {"teacher": other_teacher.pk}, format="json")

    assert response.status_code == 200
    assert response.data["teacher"]["id"] == other_teacher.pk
    log = AuditLog.objects.get()
    assert log.actor == admin
    assert log.changes == {"teacher": [teacher.pk, other_teacher.pk]}


def test_admin_cannot_assign_suspended_teacher(admin_client: APIClient, course: Course) -> None:
    """เปลี่ยนเป็นผู้สอนที่ถูกระงับไม่ได้"""
    suspended = make_user("t9@example.com", User.Role.TEACHER, is_active=False)

    response = admin_client.patch(course_url(course), {"teacher": suspended.pk}, format="json")

    assert response.data["fields"] == {"teacher": ["teacher_not_assignable"]}


def test_previous_teacher_loses_access(
    admin_client: APIClient, course: Course, teacher_client: APIClient, other_teacher: User
) -> None:
    """เปลี่ยนผู้สอนแล้ว ผู้สอนเดิมเปิดวิชานี้ไม่ได้อีก"""
    admin_client.patch(course_url(course), {"teacher": other_teacher.pk}, format="json")

    assert teacher_client.get(course_url(course)).status_code == 404


def test_closed_course_cannot_be_edited(teacher_client: APIClient, teacher: User) -> None:
    """วิชาที่ปิดแล้ว → 409 course_closed"""
    course = make_course(teacher, is_published=True, is_closed=True)

    response = teacher_client.patch(course_url(course), {"name": "แก้"}, format="json")

    assert response.status_code == 409
    assert response.data["code"] == "course_closed"


def test_admin_changes_teacher_of_closed_course(
    admin_client: APIClient, teacher: User, other_teacher: User
) -> None:
    """วิชาที่ปิดแล้ว: ผู้ดูแลระบบเปลี่ยนผู้สอนได้ แต่แก้ช่องอื่นไม่ได้"""
    course = make_course(teacher, is_published=True, is_closed=True)

    only_teacher = admin_client.patch(
        course_url(course), {"teacher": other_teacher.pk}, format="json"
    )
    with_name = admin_client.patch(
        course_url(course), {"teacher": teacher.pk, "name": "แก้"}, format="json"
    )

    assert only_teacher.status_code == 200
    assert with_name.status_code == 409


def test_demoted_teacher_loses_access(teacher: User, course: Course) -> None:
    """ผู้สอนที่ถูกเปลี่ยนบทบาทเป็นผู้เรียน จัดการวิชาเดิมไม่ได้ทันที"""
    teacher.role = User.Role.STUDENT
    teacher.save()

    assert (
        client_for(teacher).patch(course_url(course), {"name": "x"}, format="json").status_code
        == 404
    )


def test_student_cannot_edit(student_client: APIClient, student: User, teacher: User) -> None:
    """ผู้เรียน (แม้อยู่ในวิชา) แก้ไม่ได้ → 404"""
    course = make_course(teacher, is_published=True)
    enroll(course, student)

    assert student_client.patch(course_url(course), {"name": "x"}, format="json").status_code == 404


# ---------------------------------------------------------------- DELETE


def test_delete_draft_course(teacher_client: APIClient, course: Course, teacher: User) -> None:
    """วิชายังไม่เผยแพร่ ไม่เคยมีผู้เรียน → 204 ลบจริง + AuditLog delete พร้อมค่าก่อนลบ"""
    pk = course.pk

    response = teacher_client.delete(course_url(course))

    assert response.status_code == 204
    assert not Course.objects.filter(pk=pk).exists()
    log = AuditLog.objects.get()
    assert log.action == AuditAction.DELETE
    assert log.object_id == str(pk)
    assert log.object_repr == "204111 Python พื้นฐาน (2569/1)"
    assert log.changes["code"] == ["204111", None]
    assert log.changes["teacher"] == [teacher.pk, None]


@pytest.mark.parametrize("case", ["published", "has_student", "had_student"])
def test_course_not_deletable(
    teacher_client: APIClient, teacher: User, student: User, case: str
) -> None:
    """เผยแพร่แล้ว / มีผู้เรียน / เคยมีผู้เรียน (ถูกถอนแล้ว) → 409 course_not_deletable"""
    course = make_course(teacher, is_published=case == "published")
    if case == "has_student":
        enroll(course, student)
    elif case == "had_student":
        enroll(course, student, status=Enrollment.Status.DROPPED, dropped_at="2026-06-10T00:00Z")

    response = teacher_client.delete(course_url(course))

    assert response.status_code == 409
    assert response.data["code"] == "course_not_deletable"
    assert Course.objects.filter(pk=course.pk).exists()
    assert not AuditLog.objects.exists()


def test_closed_course_cannot_be_deleted(teacher_client: APIClient, teacher: User) -> None:
    """วิชาที่ปิดแล้ว → 409 course_closed"""
    course = make_course(teacher, is_closed=True)

    assert teacher_client.delete(course_url(course)).data["code"] == "course_closed"


def test_other_teacher_cannot_delete(other_teacher: User, course: Course) -> None:
    """ผู้สอนคนอื่น → 404"""
    assert client_for(other_teacher).delete(course_url(course)).status_code == 404
    assert Course.objects.filter(pk=course.pk).exists()


def test_admin_deletes_on_behalf(admin_client: APIClient, admin: User, course: Course) -> None:
    """ผู้ดูแลระบบลบแทนได้ → actor = ผู้ดูแลระบบ"""
    assert admin_client.delete(course_url(course)).status_code == 204
    assert AuditLog.objects.get().actor == admin
