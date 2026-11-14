"""
test ของหน้าหน่วยการเรียน / เนื้อหาใน Django admin (content/admin.py) — ดูได้อย่างเดียว
"""

import pytest
from django.test import Client

from academics.models import Course
from accounts.models import User
from content.models import Content, Module

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client() -> Client:
    """ตัวจำลองเบราว์เซอร์ที่เข้าสู่ระบบหน้า /admin/ แล้ว (นักพัฒนา)"""
    superuser = User.objects.create_superuser(email="root@example.com", password="x-strong-pass-1")
    client = Client()
    client.force_login(superuser)
    return client


@pytest.fixture
def content() -> Content:
    """รายวิชา → หน่วย → เนื้อหาแบบลิงก์ 1 ชิ้น"""
    teacher = User.objects.create_user(
        email="teacher@example.com", password="x-strong-pass-1", role=User.Role.TEACHER
    )
    course = Course.objects.create(
        academic_year=2569, semester=1, code="204111", name="Python พื้นฐาน", teacher=teacher
    )
    module = Module.objects.create(course=course, title="โครงสร้างควบคุมทิศทาง")
    return Content.objects.create(
        module=module,
        title="เอกสาร Python ฉบับทางการ",
        content_type="link",
        external_url="https://docs.python.org/",
    )


@pytest.mark.parametrize("model", ["module", "content"])
def test_list_search_and_detail_pages_load(
    admin_client: Client, content: Content, model: str
) -> None:
    """หน้ารายการ ค้นหา และรายละเอียดเปิดได้ ; รายละเอียดไม่มีปุ่มบันทึก"""
    obj = content if model == "content" else content.module
    assert admin_client.get(f"/admin/content/{model}/").status_code == 200
    assert admin_client.get(f"/admin/content/{model}/?q=204111").status_code == 200

    response = admin_client.get(f"/admin/content/{model}/{obj.pk}/change/")
    assert response.status_code == 200
    assert obj.title in response.content.decode()
    assert 'name="_save"' not in response.content.decode()


@pytest.mark.parametrize("model", ["module", "content"])
def test_cannot_add_edit_or_delete(admin_client: Client, content: Content, model: str) -> None:
    """เพิ่ม / แก้ไข / ลบ ผ่านหน้า /admin/ ไม่ได้ (403) — ต้องผ่าน API ที่จด AuditLog"""
    obj = content if model == "content" else content.module
    assert admin_client.get(f"/admin/content/{model}/add/").status_code == 403
    assert admin_client.get(f"/admin/content/{model}/{obj.pk}/delete/").status_code == 403
    response = admin_client.post(f"/admin/content/{model}/{obj.pk}/change/", {"title": "แก้"})
    assert response.status_code == 403

    obj.refresh_from_db()
    assert obj.title != "แก้"
