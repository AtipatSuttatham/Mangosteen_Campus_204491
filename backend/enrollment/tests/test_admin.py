"""
test ของหน้าการลงทะเบียนใน Django admin (enrollment/admin.py) — ดูได้อย่างเดียว
"""

import pytest
from django.test import Client

from academics.models import Course
from accounts.models import User
from enrollment.models import Enrollment

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client() -> Client:
    """ตัวจำลองเบราว์เซอร์ที่เข้าสู่ระบบหน้า /admin/ แล้ว (นักพัฒนา)"""
    superuser = User.objects.create_superuser(email="root@example.com", password="x-strong-pass-1")
    client = Client()
    client.force_login(superuser)
    return client


@pytest.fixture
def enrollment() -> Enrollment:
    """ผู้เรียนสมมติ 1 คนในรายวิชาสมมติ"""
    teacher = User.objects.create_user(
        email="teacher@example.com", password="x-strong-pass-1", role=User.Role.TEACHER
    )
    student = User.objects.create_user(
        email="student@example.com",
        password="x-strong-pass-1",
        role=User.Role.STUDENT,
        student_or_staff_id="670510118",
    )
    course = Course.objects.create(
        academic_year=2569, semester=1, code="204111", name="Python พื้นฐาน", teacher=teacher
    )
    return Enrollment.objects.create(course=course, student=student)


def test_list_search_and_detail_pages_load(admin_client: Client, enrollment: Enrollment) -> None:
    """หน้ารายการ ค้นหา กรอง และรายละเอียดเปิดได้ ; รายละเอียดไม่มีปุ่มบันทึก"""
    assert admin_client.get("/admin/enrollment/enrollment/").status_code == 200
    assert admin_client.get("/admin/enrollment/enrollment/?q=670510118").status_code == 200
    assert admin_client.get("/admin/enrollment/enrollment/?status__exact=active").status_code == 200

    response = admin_client.get(f"/admin/enrollment/enrollment/{enrollment.pk}/change/")
    assert response.status_code == 200
    assert 'name="_save"' not in response.content.decode()


def test_cannot_add_edit_or_delete(admin_client: Client, enrollment: Enrollment) -> None:
    """เพิ่ม / แก้ไข / ลบ ผ่านหน้า /admin/ ไม่ได้ (403) — ต้องผ่าน API ที่จด AuditLog"""
    base = "/admin/enrollment/enrollment/"
    assert admin_client.get(f"{base}add/").status_code == 403
    assert admin_client.get(f"{base}{enrollment.pk}/delete/").status_code == 403

    response = admin_client.post(f"{base}{enrollment.pk}/change/", {"status": "dropped"})
    assert response.status_code == 403

    enrollment.refresh_from_db()
    assert enrollment.status == Enrollment.Status.ACTIVE
