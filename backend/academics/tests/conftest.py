"""
ของใช้ร่วมกันของ test API รายวิชา (ขั้น 3.3) — pytest โหลดไฟล์นี้ให้ทุก test ในโฟลเดอร์นี้อัตโนมัติ
ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from accounts.models import User
from accounts.tokens import issue_refresh_token
from enrollment.models import Enrollment

COURSES_URL = "/api/v1/courses/"
ADMIN_COURSES_URL = "/api/v1/admin/courses/"
PASSWORD = "a-strong-pass-123"


def make_user(email: str, role: str, **extra) -> User:
    """สร้างบัญชีทดลอง"""
    extra.setdefault("first_name", "ทดลอง")
    extra.setdefault("last_name", "ระบบ")
    return User.objects.create_user(email=email, password=PASSWORD, role=role, **extra)


def client_for(user: User) -> APIClient:
    """เครื่องที่เข้าสู่ระบบเป็นผู้ใช้คนนี้ (แนบ access token จริง)"""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_refresh_token(user).access_token}")
    return client


def make_course(teacher: User, **fields) -> Course:
    """สร้างรายวิชาตัวอย่าง (ค่าที่ไม่ส่งมาใช้ 204111 Python พื้นฐาน ภาค 1/2569)"""
    values = {
        "academic_year": 2569,
        "semester": 1,
        "code": "204111",
        "name": "Python พื้นฐาน",
        "teacher": teacher,
    }
    values.update(fields)
    return Course.objects.create(**values)


def enroll(course: Course, student: User, **fields) -> Enrollment:
    """ใส่ผู้เรียนเข้ารายวิชาตรง ๆ (API การลงทะเบียนมาในขั้น 3.4)"""
    return Enrollment.objects.create(course=course, student=student, **fields)


def course_url(course: Course, action: str = "") -> str:
    """ที่อยู่ของวิชา 1 วิชา (+ ปุ่มย่อย เช่น "publish/")"""
    return f"{COURSES_URL}{course.pk}/{action}"


@pytest.fixture
def admin() -> User:
    return make_user("admin@example.com", User.Role.ADMIN, first_name="สุดา", last_name="แก้วมณี")


@pytest.fixture
def teacher() -> User:
    return make_user("kamon@example.com", User.Role.TEACHER, first_name="กมล", last_name="ศรีวงศ์")


@pytest.fixture
def other_teacher() -> User:
    return make_user("worawut@example.com", User.Role.TEACHER, first_name="วรวุฒิ", last_name="ทองดี")


@pytest.fixture
def student() -> User:
    return make_user(
        "s670510118@example.com",
        User.Role.STUDENT,
        first_name="ธนพล",
        last_name="ใจดี",
        student_or_staff_id="670510118",
    )


@pytest.fixture
def admin_client(admin: User) -> APIClient:
    return client_for(admin)


@pytest.fixture
def teacher_client(teacher: User) -> APIClient:
    return client_for(teacher)


@pytest.fixture
def student_client(student: User) -> APIClient:
    return client_for(student)


@pytest.fixture
def course(teacher: User) -> Course:
    """วิชาของ teacher (ยังไม่เผยแพร่)"""
    return make_course(teacher)
