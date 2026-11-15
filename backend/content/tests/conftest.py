"""
ของใช้ร่วมของ test API เนื้อหารายวิชา (ขั้น 4.3)
ใช้ผู้ใช้สมมติ / ตัวสร้างวิชาชุดเดียวกับ test API รายวิชา (academics/tests/conftest.py) — import fixture
มาที่นี่ให้ pytest มองเห็นในโฟลเดอร์นี้ด้วย ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
(test_models.py / test_admin.py มี fixture ชื่อซ้ำของตัวเอง — pytest ใช้ของในไฟล์นั้นก่อน)
"""

from academics.models import Course
from academics.tests.conftest import (  # noqa: F401 — fixture ที่ pytest ค้นหาจากชื่อ
    admin,
    admin_client,
    client_for,
    course,
    make_course,
    other_teacher,
    student,
    student_client,
    teacher,
    teacher_client,
)
from content.models import Content, Module


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
