"""
ของใช้ร่วมของ test API การลงทะเบียน (ขั้น 3.4)
ใช้ผู้ใช้สมมติ / ตัวสร้างวิชาชุดเดียวกับ test API รายวิชา (academics/tests/conftest.py) — import fixture
มาที่นี่ให้ pytest มองเห็นในโฟลเดอร์นี้ด้วย ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
"""

from academics.models import Course
from academics.tests.conftest import (  # noqa: F401 — fixture ที่ pytest ค้นหาจากชื่อ
    admin,
    admin_client,
    course,
    other_teacher,
    student,
    student_client,
    teacher,
    teacher_client,
)


def enrollments_url(target: Course, action: str = "") -> str:
    """ที่อยู่รายชื่อผู้เรียนของวิชา (+ ส่วนต่อท้าย เช่น "candidates/")"""
    return f"/api/v1/courses/{target.pk}/enrollments/{action}"
