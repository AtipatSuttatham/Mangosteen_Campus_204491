"""
test ของตาราง Enrollment (enrollment/models.py) — ค่าเริ่มต้น และกฎที่ฐานข้อมูลบังคับเอง
"""

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from academics.models import Course
from accounts.models import User
from enrollment.models import Enrollment

pytestmark = pytest.mark.django_db


@pytest.fixture
def teacher() -> User:
    """ผู้สอนสมมติ"""
    return User.objects.create_user(
        email="teacher@example.com", password="x-strong-pass-1", role=User.Role.TEACHER
    )


@pytest.fixture
def student() -> User:
    """ผู้เรียนสมมติ"""
    return User.objects.create_user(
        email="s670510118@example.com",
        password="x-strong-pass-1",
        role=User.Role.STUDENT,
        student_or_staff_id="670510118",
    )


@pytest.fixture
def course(teacher: User) -> Course:
    """รายวิชาสมมติ 204111 ภาค 1/2569"""
    return Course.objects.create(
        academic_year=2569, semester=1, code="204111", name="Python พื้นฐาน", teacher=teacher
    )


def assert_rejected(**fields) -> None:
    """ฐานข้อมูลต้องไม่ยอมบันทึก (atomic กันไม่ให้ transaction ของ test เสีย)"""
    with pytest.raises(IntegrityError), transaction.atomic():
        Enrollment.objects.create(**fields)


def test_new_enrollment_defaults(course: Course, student: User) -> None:
    """ระเบียนใหม่: กำลังเรียน, มีเวลาเข้าร่วม, ไม่มีเวลาถอน, ไม่มีผู้เพิ่ม (= เข้าร่วมด้วยรหัส)"""
    enrollment = Enrollment.objects.create(course=course, student=student)

    assert enrollment.status == Enrollment.Status.ACTIVE
    assert enrollment.enrolled_at is not None
    assert enrollment.dropped_at is None
    assert enrollment.enrolled_by is None


def test_str_shows_student_course_and_status(course: Course, student: User) -> None:
    """ข้อความแสดงระเบียน (ใช้ใน /admin/ และ AuditLog)"""
    enrollment = Enrollment.objects.create(course=course, student=student)

    assert str(enrollment) == "s670510118@example.com → 204111 (กำลังเรียน)"


def test_one_record_per_student_per_course(course: Course, student: User) -> None:
    """ผู้เรียนคนเดิมลงวิชาเดิมซ้ำไม่ได้ (เพิ่มกลับต้องใช้ระเบียนเดิม)"""
    Enrollment.objects.create(course=course, student=student)

    assert_rejected(course=course, student=student)


def test_same_student_in_many_courses(course: Course, student: User, teacher: User) -> None:
    """ผู้เรียน 1 คนอยู่ได้หลายวิชา"""
    other = Course.objects.create(
        academic_year=2569, semester=1, code="204212", name="โครงสร้างข้อมูล", teacher=teacher
    )
    Enrollment.objects.create(course=course, student=student)
    Enrollment.objects.create(course=other, student=student)

    assert student.enrollments.count() == 2


def test_drop_then_reactivate_same_record(course: Course, student: User) -> None:
    """ถอน → มีเวลาถอน ; เพิ่มกลับ → ระเบียนเดิมกลับเป็นกำลังเรียน (id เดิม)"""
    enrollment = Enrollment.objects.create(course=course, student=student)

    enrollment.status = Enrollment.Status.DROPPED
    enrollment.dropped_at = timezone.now()
    enrollment.save()
    enrollment.status = Enrollment.Status.ACTIVE
    enrollment.dropped_at = None
    enrollment.save()

    assert Enrollment.objects.get().pk == enrollment.pk
    assert Enrollment.objects.get().status == Enrollment.Status.ACTIVE


def test_dropped_requires_dropped_at(course: Course, student: User) -> None:
    """ถูกถอนแต่ไม่มีเวลาถอน → ไม่รับ"""
    assert_rejected(course=course, student=student, status=Enrollment.Status.DROPPED)


def test_active_must_not_have_dropped_at(course: Course, student: User) -> None:
    """กำลังเรียนแต่มีเวลาถอนค้างอยู่ → ไม่รับ"""
    assert_rejected(course=course, student=student, dropped_at=timezone.now())


def test_status_must_be_known(course: Course, student: User) -> None:
    """สถานะอื่นนอกจาก active / dropped → ไม่รับ"""
    assert_rejected(course=course, student=student, status="pending")


def test_student_with_enrollment_cannot_be_deleted(course: Course, student: User) -> None:
    """ลบบัญชีผู้เรียนที่เคยลงทะเบียนไม่ได้ (PROTECT — ทางเชื่อมเข้าสู่คะแนน)"""
    Enrollment.objects.create(course=course, student=student)

    with pytest.raises(ProtectedError):
        student.delete()


def test_deleting_course_removes_its_enrollments(course: Course, student: User) -> None:
    """ลบรายวิชา → ระเบียนของวิชานั้นหายตาม (CASCADE ; API อนุญาตลบเฉพาะวิชาที่ไม่เคยมีผู้เรียน)"""
    Enrollment.objects.create(course=course, student=student)

    course.delete()

    assert Enrollment.objects.count() == 0


def test_removed_adder_keeps_enrollment(course: Course, student: User) -> None:
    """บัญชีผู้เพิ่มถูกลบ → ระเบียนยังอยู่ ช่องผู้เพิ่มว่าง"""
    adder = User.objects.create_user(
        email="admin@example.com", password="x-strong-pass-1", role=User.Role.ADMIN
    )
    enrollment = Enrollment.objects.create(course=course, student=student, enrolled_by=adder)

    adder.delete()

    enrollment.refresh_from_db()
    assert enrollment.enrolled_by is None


def test_status_indexes_exist() -> None:
    """มี index สำหรับค้นตามผู้เรียน + สถานะ และวิชา + สถานะ (docs/database.md §11)"""
    names = {index.name for index in Enrollment._meta.indexes}

    assert names == {"enrollment_student_status_idx", "enrollment_course_status_idx"}
