"""
test ของ "รายวิชาของฉัน" (GET /api/v1/courses/) และการสร้างรายวิชา (POST) — ขั้น 3.3
อ้างอิงพฤติกรรม: docs/api.md §8, CLAUDE.md "การตัดสินใจก้อน 3"
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import COURSES_URL, enroll, make_course, make_user
from accounts.models import User
from audit.models import AuditAction, AuditLog
from enrollment.models import Enrollment

pytestmark = pytest.mark.django_db

NEW_COURSE = {
    "academic_year": 2569,
    "semester": 1,
    "code": "204212",
    "name": "โครงสร้างข้อมูล",
    "description": "ลิสต์ สแตก คิว ต้นไม้",
}


# ---------------------------------------------------------------- GET รายวิชาของฉัน


def test_requires_login() -> None:
    """ยังไม่เข้าสู่ระบบ → 401"""
    assert APIClient().get(COURSES_URL).status_code == 401


def test_teacher_sees_only_own_courses_with_full_data(
    teacher_client: APIClient, teacher: User, other_teacher: User, student: User
) -> None:
    """ผู้สอนเห็นเฉพาะวิชาของตัวเอง ทุกสถานะ พร้อมรหัสเข้าร่วม / จำนวนผู้เรียน / ลบได้ไหม"""
    mine = make_course(teacher, is_published=True, join_code="K7Q2XM9A", join_code_enabled=True)
    make_course(teacher, code="204331", name="วิศวกรรมซอฟต์แวร์")
    make_course(other_teacher, code="204212", name="ของคนอื่น")
    enroll(mine, student)

    response = teacher_client.get(COURSES_URL)

    assert response.status_code == 200
    codes = [course["code"] for course in response.data]
    assert codes == ["204111", "204331"]
    first = response.data[0]
    assert first["join_code"] == "K7Q2XM9A"
    assert first["student_count"] == 1
    assert first["can_delete"] is False
    assert first["teacher"] == {
        "id": teacher.pk,
        "first_name": "กมล",
        "last_name": "ศรีวงศ์",
        "is_active": True,
    }
    assert response.data[1]["can_delete"] is True


def test_list_is_ordered_latest_term_first(teacher_client: APIClient, teacher: User) -> None:
    """เรียงภาคล่าสุดก่อน แล้วตามรหัสวิชา (หน้าจอจัดกลุ่มตามลำดับนี้)"""
    make_course(teacher, academic_year=2568, semester=2, code="204111")
    make_course(teacher, academic_year=2569, semester=1, code="204331")
    make_course(teacher, academic_year=2569, semester=1, code="204212")

    response = teacher_client.get(COURSES_URL)

    assert [(c["academic_year"], c["semester"], c["code"]) for c in response.data] == [
        (2569, 1, "204212"),
        (2569, 1, "204331"),
        (2568, 2, "204111"),
    ]


def test_student_sees_published_courses_they_are_enrolled_in(
    student_client: APIClient, teacher: User, student: User
) -> None:
    """
    ผู้เรียนเห็น: วิชาที่กำลังเรียน + เผยแพร่แล้ว (รวมวิชาที่ปิดแล้ว)
    ไม่เห็น: วิชาที่ยังไม่เผยแพร่, วิชาที่ถูกถอน, วิชาที่ไม่ได้ลง
    """
    visible = make_course(teacher, is_published=True)
    closed = make_course(teacher, code="204100", is_published=True, is_closed=True)
    draft = make_course(teacher, code="204331")
    dropped = make_course(teacher, code="204212", is_published=True)
    make_course(teacher, code="204999", is_published=True)
    for course in (visible, closed, draft):
        enroll(course, student)
    enroll(dropped, student, status=Enrollment.Status.DROPPED, dropped_at="2026-06-10T00:00Z")

    response = student_client.get(COURSES_URL)

    assert response.status_code == 200
    assert sorted(c["code"] for c in response.data) == ["204100", "204111"]


def test_student_list_hides_teacher_only_fields(
    student_client: APIClient, teacher: User, student: User
) -> None:
    """ผู้เรียนไม่เห็นรหัสเข้าร่วม / จำนวนผู้เรียน / สถานะเผยแพร่"""
    course = make_course(teacher, is_published=True, join_code="K7Q2XM9A", join_code_enabled=True)
    enroll(course, student)

    item = student_client.get(COURSES_URL).data[0]

    assert set(item) == {
        "id",
        "academic_year",
        "semester",
        "code",
        "name",
        "description",
        "teacher",
        "is_closed",
    }


def test_admin_uses_admin_list_instead(admin_client: APIClient) -> None:
    """ผู้ดูแลระบบไม่มี "รายวิชาของฉัน" → 403 (ใช้ /api/v1/admin/courses/)"""
    assert admin_client.get(COURSES_URL).status_code == 403


# ---------------------------------------------------------------- POST สร้างรายวิชา


def test_teacher_creates_course_for_themselves(teacher_client: APIClient, teacher: User) -> None:
    """ผู้สอนสร้างวิชา → ผู้สอน = ตัวเอง, ยังไม่เผยแพร่, ไม่เปิดรหัสเข้าร่วม"""
    response = teacher_client.post(COURSES_URL, NEW_COURSE, format="json")

    assert response.status_code == 201
    assert response.data["teacher"]["id"] == teacher.pk
    assert response.data["is_published"] is False
    assert response.data["join_code_enabled"] is False
    assert response.data["join_code"] is None
    assert response.data["student_count"] == 0
    assert response.data["can_delete"] is True
    course = Course.objects.get(pk=response.data["id"])
    assert course.created_by == teacher


def test_create_is_audited(teacher_client: APIClient, teacher: User) -> None:
    """สร้างวิชา → AuditLog create พร้อมค่าที่ตั้ง (ผู้สอนจดเป็นรหัสผู้ใช้)"""
    response = teacher_client.post(COURSES_URL, NEW_COURSE, format="json")

    log = AuditLog.objects.get()
    assert log.action == AuditAction.CREATE
    assert log.actor == teacher
    assert log.object_id == str(response.data["id"])
    assert log.changes["code"] == [None, "204212"]
    assert log.changes["teacher"] == [None, teacher.pk]
    assert log.changes["is_published"] == [None, False]


def test_description_is_optional(teacher_client: APIClient) -> None:
    """ไม่ส่งคำอธิบาย → สร้างได้ (เก็บเป็นข้อความว่าง)"""
    data = {key: value for key, value in NEW_COURSE.items() if key != "description"}

    response = teacher_client.post(COURSES_URL, data, format="json")

    assert response.status_code == 201
    assert response.data["description"] == ""


def test_code_and_name_are_trimmed(teacher_client: APIClient) -> None:
    """ตัดช่องว่างหัว-ท้ายของรหัสและชื่อวิชา"""
    data = {**NEW_COURSE, "code": " 204212 ", "name": "  โครงสร้างข้อมูล  "}

    response = teacher_client.post(COURSES_URL, data, format="json")

    assert response.data["code"] == "204212"
    assert response.data["name"] == "โครงสร้างข้อมูล"


def test_duplicate_code_in_same_term(teacher_client: APIClient, other_teacher: User) -> None:
    """รหัสซ้ำกับวิชาอื่นในภาคเดียวกัน (แม้คนละผู้สอน) → course_code_duplicate ที่ช่อง code"""
    make_course(other_teacher, code="204212")

    response = teacher_client.post(COURSES_URL, NEW_COURSE, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["fields"] == {"code": ["course_code_duplicate"]}
    assert not AuditLog.objects.exists()


def test_same_code_in_another_term_is_allowed(teacher_client: APIClient, teacher: User) -> None:
    """รหัสเดิมคนละภาค → สร้างได้"""
    make_course(teacher, code="204212", semester=2)

    assert teacher_client.post(COURSES_URL, NEW_COURSE, format="json").status_code == 201


@pytest.mark.parametrize(
    ("changes", "field", "code"),
    [
        ({"academic_year": 2026}, "academic_year", "min_value"),
        ({"academic_year": 2701}, "academic_year", "max_value"),
        ({"semester": 4}, "semester", "invalid_choice"),
        ({"code": "  "}, "code", "blank"),
        ({"name": ""}, "name", "blank"),
        ({"code": "x" * 21}, "code", "max_length"),
    ],
)
def test_invalid_fields(teacher_client: APIClient, changes: dict, field: str, code: str) -> None:
    """ข้อมูลผิดรายช่อง → 400 validation_error พร้อมรหัสของช่องนั้น"""
    response = teacher_client.post(COURSES_URL, {**NEW_COURSE, **changes}, format="json")

    assert response.status_code == 400
    assert response.data["fields"][field] == [code]


def test_missing_fields(teacher_client: APIClient) -> None:
    """ไม่ส่งช่องบังคับ → required"""
    response = teacher_client.post(COURSES_URL, {}, format="json")

    assert set(response.data["fields"]) == {"academic_year", "semester", "code", "name"}


def test_teacher_cannot_assign_another_teacher(
    teacher_client: APIClient, other_teacher: User
) -> None:
    """ผู้สอนส่งช่อง teacher → 403 (เปลี่ยนผู้สอนได้เฉพาะผู้ดูแลระบบ) และไม่สร้างวิชา"""
    data = {**NEW_COURSE, "teacher": other_teacher.pk}

    response = teacher_client.post(COURSES_URL, data, format="json")

    assert response.status_code == 403
    assert not Course.objects.exists()


def test_student_cannot_create(student_client: APIClient) -> None:
    """ผู้เรียนสร้างวิชาไม่ได้ → 403"""
    assert student_client.post(COURSES_URL, NEW_COURSE, format="json").status_code == 403


def test_admin_creates_course_for_a_teacher(
    admin_client: APIClient, admin: User, teacher: User
) -> None:
    """ผู้ดูแลระบบสร้างแทน → ผู้สอน = คนที่เลือก, ผู้สร้าง = ผู้ดูแลระบบ, AuditLog actor = ผู้ดูแลระบบ"""
    response = admin_client.post(COURSES_URL, {**NEW_COURSE, "teacher": teacher.pk}, format="json")

    assert response.status_code == 201
    assert response.data["teacher"]["id"] == teacher.pk
    course = Course.objects.get()
    assert course.created_by == admin
    assert AuditLog.objects.get().actor == admin


def test_admin_must_choose_a_teacher(admin_client: APIClient) -> None:
    """ผู้ดูแลระบบไม่เลือกผู้สอน → {"teacher": ["required"]}"""
    response = admin_client.post(COURSES_URL, NEW_COURSE, format="json")

    assert response.status_code == 400
    assert response.data["fields"] == {"teacher": ["required"]}


@pytest.mark.parametrize("kind", ["student", "admin", "suspended_teacher"])
def test_admin_must_choose_an_active_teacher(admin_client: APIClient, kind: str) -> None:
    """ผู้สอนที่เลือกต้องเป็นบัญชีผู้สอนที่ใช้งานได้ → อื่น ๆ ได้ teacher_not_assignable"""
    if kind == "student":
        chosen = make_user("s1@example.com", User.Role.STUDENT)
    elif kind == "admin":
        chosen = make_user("a2@example.com", User.Role.ADMIN)
    else:
        chosen = make_user("t9@example.com", User.Role.TEACHER, is_active=False)

    response = admin_client.post(COURSES_URL, {**NEW_COURSE, "teacher": chosen.pk}, format="json")

    assert response.status_code == 400
    assert response.data["fields"] == {"teacher": ["teacher_not_assignable"]}


def test_admin_unknown_teacher(admin_client: APIClient) -> None:
    """รหัสผู้สอนที่ไม่มีอยู่ → does_not_exist"""
    response = admin_client.post(COURSES_URL, {**NEW_COURSE, "teacher": 999999}, format="json")

    assert response.data["fields"] == {"teacher": ["does_not_exist"]}
