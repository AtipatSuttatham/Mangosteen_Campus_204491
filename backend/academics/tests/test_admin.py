"""
test ของหน้ารายวิชาใน Django admin (academics/admin.py) — ดูได้อย่างเดียว
"""

import pytest
from django.test import Client

from academics.models import Course
from accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client() -> Client:
    """ตัวจำลองเบราว์เซอร์ที่เข้าสู่ระบบหน้า /admin/ แล้ว (นักพัฒนา)"""
    superuser = User.objects.create_superuser(email="root@example.com", password="x-strong-pass-1")
    client = Client()
    client.force_login(superuser)
    return client


@pytest.fixture
def course() -> Course:
    """รายวิชาสมมติ 1 วิชา"""
    teacher = User.objects.create_user(
        email="teacher@example.com", password="x-strong-pass-1", role=User.Role.TEACHER
    )
    return Course.objects.create(
        academic_year=2569, semester=1, code="204111", name="Python พื้นฐาน", teacher=teacher
    )


def test_list_search_and_detail_pages_load(admin_client: Client, course: Course) -> None:
    """หน้ารายการ ค้นหา กรอง และรายละเอียดเปิดได้ ; รายละเอียดไม่มีปุ่มบันทึก"""
    assert admin_client.get("/admin/academics/course/").status_code == 200
    assert admin_client.get("/admin/academics/course/?q=204111").status_code == 200
    assert admin_client.get("/admin/academics/course/?is_closed__exact=0").status_code == 200

    response = admin_client.get(f"/admin/academics/course/{course.pk}/change/")
    assert response.status_code == 200
    content = response.content.decode()
    assert "Python พื้นฐาน" in content
    assert 'name="_save"' not in content


def test_cannot_add_edit_or_delete(admin_client: Client, course: Course) -> None:
    """เพิ่ม / แก้ไข / ลบ ผ่านหน้า /admin/ ไม่ได้ (403) — ต้องผ่าน API ที่จด AuditLog"""
    assert admin_client.get("/admin/academics/course/add/").status_code == 403
    assert admin_client.get(f"/admin/academics/course/{course.pk}/delete/").status_code == 403

    response = admin_client.post(f"/admin/academics/course/{course.pk}/change/", {"name": "แก้"})
    assert response.status_code == 403

    course.refresh_from_db()
    assert course.name == "Python พื้นฐาน"
