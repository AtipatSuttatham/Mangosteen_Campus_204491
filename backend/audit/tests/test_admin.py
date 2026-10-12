"""
test ของหน้าบันทึกการใช้งานใน Django admin (audit/admin.py) — ดูได้อย่างเดียว
"""

import pytest
from django.test import Client

from accounts.models import User
from audit.models import AuditAction, AuditLog
from audit.services import log_action

pytestmark = pytest.mark.django_db


@pytest.fixture
def superuser() -> User:
    """นักพัฒนาที่เข้าหน้า /admin/ ได้"""
    return User.objects.create_superuser(email="root@example.com", password="x-strong-pass-1")


@pytest.fixture
def admin_client(superuser: User) -> Client:
    """ตัวจำลองเบราว์เซอร์ที่เข้าสู่ระบบหน้า /admin/ แล้ว"""
    client = Client()
    client.force_login(superuser)
    return client


@pytest.fixture
def log(superuser: User) -> AuditLog:
    """บันทึกตัวอย่าง 1 แถว (มีภาษาไทยใน changes)"""
    target = User.objects.create_user(
        email="student@example.com", password="x-strong-pass-1", role=User.Role.STUDENT
    )
    return log_action(
        actor=superuser,
        action=AuditAction.UPDATE,
        target=target,
        changes={"first_name": ["สมใจ", "สมหญิง"]},
    )


def test_list_and_search_pages_load(admin_client: Client, log: AuditLog) -> None:
    """หน้ารายการ, ค้นหา และกรองตามการกระทำ เปิดได้"""
    assert admin_client.get("/admin/audit/auditlog/").status_code == 200
    assert admin_client.get("/admin/audit/auditlog/?q=student").status_code == 200
    assert admin_client.get("/admin/audit/auditlog/?action__exact=update").status_code == 200


def test_detail_page_is_read_only_and_shows_thai(admin_client: Client, log: AuditLog) -> None:
    """หน้ารายละเอียดเปิดได้ ไม่มีปุ่มบันทึก และ changes แสดงภาษาไทยอ่านได้"""
    response = admin_client.get(f"/admin/audit/auditlog/{log.pk}/change/")

    assert response.status_code == 200
    content = response.content.decode()
    assert "สมหญิง" in content
    assert 'name="_save"' not in content


def test_cannot_add_edit_or_delete(admin_client: Client, log: AuditLog) -> None:
    """เพิ่ม / แก้ไข / ลบ ผ่านหน้า /admin/ ไม่ได้ (403) และบันทึกยังอยู่ครบ"""
    assert admin_client.get("/admin/audit/auditlog/add/").status_code == 403
    assert admin_client.get(f"/admin/audit/auditlog/{log.pk}/delete/").status_code == 403

    response = admin_client.post(
        f"/admin/audit/auditlog/{log.pk}/change/", {"object_repr": "แก้หลักฐาน"}
    )
    assert response.status_code == 403

    log.refresh_from_db()
    assert log.object_repr != "แก้หลักฐาน"
    assert AuditLog.objects.count() == 1
