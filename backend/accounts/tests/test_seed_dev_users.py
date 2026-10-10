"""
test ของคำสั่งสร้างบัญชีทดลอง  manage.py seed_dev_users
"""

from io import StringIO

import pytest
from django.contrib.auth import authenticate
from django.core.management import CommandError, call_command
from django.test import override_settings

from accounts.models import User

pytestmark = pytest.mark.django_db


def run_seed(*args: str) -> str:
    """รันคำสั่งในโหมดพัฒนา (DEBUG=True) แล้วคืนข้อความที่แสดงบนหน้าจอ"""
    out = StringIO()
    with override_settings(DEBUG=True):
        call_command("seed_dev_users", *args, stdout=out)
    return out.getvalue()


def password_of(output: str, email: str) -> str:
    """ดึงรหัสผ่านของบัญชีนั้นจากข้อความที่คำสั่งแสดง"""
    line = next(line for line in output.splitlines() if email in line)
    return line.split("รหัสผ่าน:")[1].strip()


def test_seed_creates_one_account_per_role() -> None:
    """สร้างครบ 3 บทบาท + ผู้สอน/ผู้เรียนบันทึกว่าผู้ดูแลระบบทดลองเป็นผู้สร้าง"""
    run_seed()

    admin = User.objects.get(email="admin@example.com")
    teacher = User.objects.get(email="teacher@example.com")
    student = User.objects.get(email="student@example.com")
    assert (admin.role, teacher.role, student.role) == ("admin", "teacher", "student")
    assert admin.is_staff is True
    assert teacher.is_staff is False and student.is_staff is False
    assert admin.created_by is None
    assert teacher.created_by == admin and student.created_by == admin


def test_seed_uses_only_fake_example_domain() -> None:
    """บัญชีทดลองทุกบัญชีใช้โดเมน example.com (ข้อมูลสมมติ)"""
    run_seed()

    assert all(
        email.endswith("@example.com") for email in User.objects.values_list("email", flat=True)
    )


def test_seed_shows_working_random_passwords() -> None:
    """รหัสผ่านที่แสดงบนหน้าจอใช้เข้าสู่ระบบได้จริง และแต่ละบัญชีไม่ซ้ำกัน"""
    output = run_seed()

    passwords = {
        email: password_of(output, email) for email in ("admin@example.com", "student@example.com")
    }
    assert passwords["admin@example.com"] != passwords["student@example.com"]
    for email, password in passwords.items():
        assert authenticate(username=email, password=password) is not None


def test_seed_is_idempotent_and_keeps_passwords() -> None:
    """รันซ้ำ → ไม่สร้างบัญชีซ้ำ และไม่เปลี่ยนรหัสผ่านเดิม"""
    first = run_seed()
    second = run_seed()

    assert User.objects.count() == 3
    assert "มีอยู่แล้ว" in password_of(second, "student@example.com")
    old_password = password_of(first, "student@example.com")
    assert authenticate(username="student@example.com", password=old_password) is not None


def test_seed_reset_passwords_issues_new_passwords() -> None:
    """--reset-passwords → รหัสเดิมใช้ไม่ได้ รหัสใหม่ใช้ได้"""
    old_password = password_of(run_seed(), "teacher@example.com")
    new_password = password_of(run_seed("--reset-passwords"), "teacher@example.com")

    assert User.objects.count() == 3
    assert authenticate(username="teacher@example.com", password=old_password) is None
    assert authenticate(username="teacher@example.com", password=new_password) is not None


def test_seed_refuses_outside_development() -> None:
    """DEBUG=False (เว็บจริง) → ปฏิเสธ และไม่สร้างบัญชีใดเลย"""
    with override_settings(DEBUG=False), pytest.raises(CommandError):
        call_command("seed_dev_users", stdout=StringIO())

    assert User.objects.count() == 0
