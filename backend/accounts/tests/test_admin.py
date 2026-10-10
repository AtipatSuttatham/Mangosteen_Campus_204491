"""
test ของหน้าจัดการผู้ใช้ใน Django admin (accounts/admin.py)
"""

import pytest
from django.test import Client

from accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client() -> Client:
    """ตัวจำลองเบราว์เซอร์ที่เข้าสู่ระบบหน้า /admin/ ในฐานะ superuser แล้ว"""
    user = User.objects.create_superuser(
        email="root@example.com", password="x-strong-pass-1", first_name="ผู้", last_name="ดูแล"
    )
    client = Client()
    client.force_login(user)
    return client


def test_admin_login_with_email() -> None:
    """เข้าสู่ระบบหน้า /admin/ ด้วยอีเมล (พิมพ์ตัวพิมพ์ใหญ่ก็ได้)"""
    User.objects.create_superuser(email="root@example.com", password="x-strong-pass-1")

    response = Client().post(
        "/admin/login/?next=/admin/",
        {"username": "ROOT@example.com", "password": "x-strong-pass-1"},
    )

    assert response.status_code == 302
    assert response["Location"] == "/admin/"


def test_user_list_and_search_pages_load(admin_client: Client) -> None:
    """หน้ารายชื่อผู้ใช้ และการค้นหา เปิดได้"""
    assert admin_client.get("/admin/accounts/user/").status_code == 200
    assert admin_client.get("/admin/accounts/user/?q=root").status_code == 200


def test_user_add_and_change_pages_load(admin_client: Client) -> None:
    """หน้าเพิ่มผู้ใช้ และหน้าแก้ไขผู้ใช้ เปิดได้"""
    user = User.objects.get(email="root@example.com")

    assert admin_client.get("/admin/accounts/user/add/").status_code == 200
    assert admin_client.get(f"/admin/accounts/user/{user.pk}/change/").status_code == 200


def test_add_user_through_admin(admin_client: Client) -> None:
    """เพิ่มผู้ใช้ผ่านหน้า /admin/ → อีเมลเป็นตัวพิมพ์เล็ก, รหัสว่างเป็น NULL, บทบาทตามที่เลือก"""
    response = admin_client.post(
        "/admin/accounts/user/add/",
        {
            "email": "New.Teacher@Example.com",
            "student_or_staff_id": "",
            "first_name": "ผู้สอน",
            "last_name": "ใหม่",
            "role": "teacher",
            "password1": "a-strong-pass-123",
            "password2": "a-strong-pass-123",
        },
    )

    assert response.status_code == 302
    user = User.objects.get(email="new.teacher@example.com")
    assert user.role == User.Role.TEACHER
    assert user.student_or_staff_id is None
    assert user.check_password("a-strong-pass-123")


def test_add_user_with_duplicate_email_shows_error(admin_client: Client) -> None:
    """เพิ่มผู้ใช้ที่อีเมลซ้ำ (ต่างแค่ตัวพิมพ์) → ฟอร์มแจ้ง error ไม่บันทึก"""
    response = admin_client.post(
        "/admin/accounts/user/add/",
        {
            "email": "ROOT@example.com",
            "first_name": "ซ้ำ",
            "last_name": "ซ้ำ",
            "role": "student",
            "password1": "a-strong-pass-123",
            "password2": "a-strong-pass-123",
        },
    )

    assert response.status_code == 200
    assert response.context["adminform"].form.errors
    assert User.objects.count() == 1
