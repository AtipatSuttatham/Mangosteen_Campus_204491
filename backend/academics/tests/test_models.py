"""
test ของตาราง Course (academics/models.py) — ค่าเริ่มต้น และกฎที่ฐานข้อมูลบังคับเอง
"""

import pytest
from django.db import DataError, IntegrityError, transaction
from django.db.models import ProtectedError

from academics.join_codes import generate_join_code
from academics.models import Course
from accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def teacher() -> User:
    """ผู้สอนสมมติ"""
    return User.objects.create_user(
        email="teacher@example.com",
        password="x-strong-pass-1",
        role=User.Role.TEACHER,
        first_name="กมล",
        last_name="ศรีวงศ์",
    )


def make_course(teacher: User, **fields) -> Course:
    """สร้างรายวิชาตัวอย่าง (ค่าที่ไม่ส่งมาใช้ค่าตั้งต้นของ 204111 ภาค 1/2569)"""
    values = {
        "academic_year": 2569,
        "semester": Course.Semester.FIRST,
        "code": "204111",
        "name": "Python พื้นฐาน",
        "teacher": teacher,
    }
    values.update(fields)
    return Course.objects.create(**values)


def assert_rejected(**fields) -> None:
    """
    ฐานข้อมูลต้องไม่ยอมบันทึก (atomic กันไม่ให้ transaction ของ test เสีย)
    IntegrityError = ผิดกฎ constraint ; DataError = ยาวเกินช่อง (เช่น รหัสเข้าร่วม 9 ตัว)
    """
    with pytest.raises((IntegrityError, DataError)), transaction.atomic():
        Course.objects.create(**fields)


def test_new_course_defaults(teacher: User) -> None:
    """วิชาใหม่: ยังไม่เผยแพร่, ยังไม่ปิด, ยังไม่เปิดรหัสเข้าร่วม, ไม่มีรหัส"""
    course = make_course(teacher)

    assert course.is_published is False
    assert course.is_closed is False
    assert course.join_code_enabled is False
    assert course.join_code is None
    assert course.description == ""
    assert course.created_by is None
    assert course.created_at is not None


def test_str_shows_code_name_and_term(teacher: User) -> None:
    """ข้อความแสดงรายวิชา (ใช้ใน /admin/ และ AuditLog)"""
    assert str(make_course(teacher)) == "204111 Python พื้นฐาน (2569/1)"


def test_code_is_unique_within_a_term(teacher: User) -> None:
    """รหัสวิชาซ้ำในปี + ภาคเดียวกันไม่ได้"""
    make_course(teacher)

    assert_rejected(academic_year=2569, semester=1, code="204111", name="ซ้ำ", teacher=teacher)


def test_same_code_allowed_in_another_term(teacher: User) -> None:
    """รหัสเดิมเปิดคนละภาค / คนละปีได้ (เตรียมวิชาภาคหน้าได้)"""
    make_course(teacher)
    make_course(teacher, semester=Course.Semester.SECOND)
    make_course(teacher, academic_year=2570)

    assert Course.objects.filter(code="204111").count() == 3


@pytest.mark.parametrize("semester", [0, 4])
def test_semester_must_be_1_to_3(teacher: User, semester: int) -> None:
    """ภาคเรียนมีแค่ 1, 2, 3"""
    assert_rejected(academic_year=2569, semester=semester, code="1", name="x", teacher=teacher)


@pytest.mark.parametrize("year", [2026, 269, 2499, 2701])
def test_academic_year_must_be_buddhist_era(teacher: User, year: int) -> None:
    """ปีการศึกษาต้องอยู่ในช่วง 2500–2700 (กันพิมพ์ ค.ศ. หรือพิมพ์ขาด)"""
    assert_rejected(academic_year=year, semester=1, code="1", name="x", teacher=teacher)


@pytest.mark.parametrize("year", [2500, 2700])
def test_academic_year_bounds_are_allowed(teacher: User, year: int) -> None:
    """ค่าขอบของช่วงยังบันทึกได้"""
    assert make_course(teacher, academic_year=year).academic_year == year


def test_join_code_required_when_enabled(teacher: User) -> None:
    """เปิดใช้รหัสเข้าร่วมโดยไม่มีรหัสไม่ได้"""
    assert_rejected(
        academic_year=2569,
        semester=1,
        code="204111",
        name="x",
        teacher=teacher,
        join_code_enabled=True,
    )


def test_enabled_with_generated_code_is_saved(teacher: User) -> None:
    """รหัสจากตัวสุ่มผ่านการตรวจรูปแบบของฐานข้อมูล"""
    course = make_course(teacher, join_code=generate_join_code(), join_code_enabled=True)

    course.refresh_from_db()
    assert course.join_code_enabled is True
    assert len(course.join_code or "") == 8


@pytest.mark.parametrize("code", ["k7q2xm9a", "K7Q2XM9", "K7Q2XM9AA", "K7Q2XM0A", "OOOOOOOO", ""])
def test_join_code_format_is_checked(teacher: User, code: str) -> None:
    """รหัสตัวเล็ก / ยาวผิด / มีตัวสับสน / ข้อความว่าง → ฐานข้อมูลไม่รับ"""
    assert_rejected(
        academic_year=2569, semester=1, code="204111", name="x", teacher=teacher, join_code=code
    )


def test_join_code_is_unique_across_courses(teacher: User) -> None:
    """รหัสเข้าร่วมซ้ำกับวิชาอื่นไม่ได้ แม้คนละภาค"""
    make_course(teacher, join_code="K7Q2XM9A")

    assert_rejected(
        academic_year=2570,
        semester=1,
        code="204212",
        name="x",
        teacher=teacher,
        join_code="K7Q2XM9A",
    )


def test_many_courses_without_join_code(teacher: User) -> None:
    """หลายวิชาที่ยังไม่มีรหัส (NULL) อยู่ร่วมกันได้"""
    make_course(teacher)
    make_course(teacher, code="204212")

    assert Course.objects.filter(join_code__isnull=True).count() == 2


def test_teacher_with_courses_cannot_be_deleted(teacher: User) -> None:
    """ลบบัญชีผู้สอนที่มีวิชาไม่ได้ (PROTECT) — ระบบใช้การระงับบัญชีแทน"""
    make_course(teacher)

    with pytest.raises(ProtectedError):
        teacher.delete()


def test_creator_removed_keeps_course(teacher: User) -> None:
    """บัญชีผู้สร้าง (เช่น ผู้ดูแลระบบที่สร้างแทน) ถูกลบ → วิชายังอยู่ ช่องผู้สร้างว่าง"""
    admin = User.objects.create_user(
        email="admin@example.com", password="x-strong-pass-1", role=User.Role.ADMIN
    )
    course = make_course(teacher, created_by=admin)

    admin.delete()

    course.refresh_from_db()
    assert course.created_by is None


def test_courses_are_ordered_latest_term_first(teacher: User) -> None:
    """เรียงภาคล่าสุดก่อน แล้วตามรหัสวิชา (ตรงกับหน้า "รายวิชาของฉัน")"""
    make_course(teacher, academic_year=2568, semester=2, code="204111")
    make_course(teacher, academic_year=2569, semester=1, code="204331")
    make_course(teacher, academic_year=2569, semester=1, code="204212")

    order = [(c.academic_year, c.semester, c.code) for c in Course.objects.all()]
    assert order == [(2569, 1, "204212"), (2569, 1, "204331"), (2568, 2, "204111")]
