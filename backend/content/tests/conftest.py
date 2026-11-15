"""
ของใช้ร่วมของ test API เนื้อหารายวิชา (ขั้น 4.3)
ใช้ผู้ใช้สมมติ / ตัวสร้างวิชาชุดเดียวกับ test API รายวิชา (academics/tests/conftest.py) — import fixture
มาที่นี่ให้ pytest มองเห็นในโฟลเดอร์นี้ด้วย ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
(test_models.py / test_admin.py มี fixture ชื่อซ้ำของตัวเอง — pytest ใช้ของในไฟล์นั้นก่อน)
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import (  # noqa: F401 — fixture ที่ pytest ค้นหาจากชื่อ
    admin,
    course,
    make_course,
    other_teacher,
    student,
    teacher,
)
from academics.tests.conftest import client_for as base_client_for
from accounts.models import User
from content.models import Content, Module


def client_for(user: User) -> APIClient:
    """
    เครื่องที่เข้าสู่ระบบเป็นผู้ใช้คนนี้ — ส่ง JSON เป็นค่าเริ่มต้น
    (ที่อยู่ของเนื้อหารับเฉพาะ JSON ; อัปโหลดไฟล์ส่ง format="multipart" เอง)
    """
    client = base_client_for(user)
    client.default_format = "json"
    return client


@pytest.fixture
def admin_client(admin: User) -> APIClient:  # noqa: F811 — ชื่อพารามิเตอร์ = fixture
    return client_for(admin)


@pytest.fixture
def teacher_client(teacher: User) -> APIClient:  # noqa: F811 — ชื่อพารามิเตอร์ = fixture
    return client_for(teacher)


@pytest.fixture
def student_client(student: User) -> APIClient:  # noqa: F811 — ชื่อพารามิเตอร์ = fixture
    return client_for(student)


def modules_url(target: Course, action: str = "") -> str:
    """ที่อยู่หน่วยการเรียนของวิชา (+ ส่วนต่อท้าย เช่น "5/publish/")"""
    return f"/api/v1/courses/{target.pk}/modules/{action}"


def contents_url(target: Course, action: str = "") -> str:
    """ที่อยู่เนื้อหาของวิชา (+ ส่วนต่อท้าย เช่น "9/move/")"""
    return f"/api/v1/courses/{target.pk}/contents/{action}"


def make_module(target: Course, title: str = "หน่วย", **fields) -> Module:
    """สร้างหน่วยตรง ๆ ในฐานข้อมูล (ไม่ผ่าน API)"""
    return Module.objects.create(course=target, title=title, **fields)


def make_text(module: Module, title: str = "ข้อความ", **fields) -> Content:
    """สร้างเนื้อหาแบบข้อความตรง ๆ ในฐานข้อมูล"""
    return Content.objects.create(module=module, title=title, content_type="text", **fields)
