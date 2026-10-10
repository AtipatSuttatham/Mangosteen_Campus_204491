"""
test ของตาราง User และตัวช่วยสร้างผู้ใช้ (accounts/models.py)
"""

import pytest
from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction

from accounts.models import User

pytestmark = pytest.mark.django_db


def make_user(**overrides) -> User:
    """สร้างผู้ใช้ทดลอง 1 คน (ผู้เรียน) — แก้ค่าบางช่องได้ผ่าน overrides"""
    data = {
        "email": "someone@example.com",
        "password": "a-strong-pass-123",
        "first_name": "ทดลอง",
        "last_name": "ระบบ",
        "role": User.Role.STUDENT,
    }
    data.update(overrides)
    return User.objects.create_user(**data)


def test_create_user_lowercases_email_and_hashes_password() -> None:
    """สร้างผู้ใช้ → อีเมลเป็นตัวพิมพ์เล็ก, รหัสผ่านถูกเข้ารหัส (ไม่เก็บตรง ๆ), ค่าเริ่มต้นถูกต้อง"""
    user = make_user(email="  Some.One@Example.COM ")

    user.refresh_from_db()
    assert user.email == "some.one@example.com"
    assert user.password != "a-strong-pass-123"
    assert user.check_password("a-strong-pass-123")
    assert user.is_active is True
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.created_at is not None
    assert user.date_joined is not None


def test_create_user_requires_valid_role() -> None:
    """ไม่ระบุบทบาท หรือบทบาทไม่ถูกต้อง → สร้างไม่ได้"""
    with pytest.raises(ValueError):
        User.objects.create_user(email="a@example.com", password="x", first_name="a")
    with pytest.raises(ValueError):
        make_user(role="guest")


def test_create_user_requires_email() -> None:
    """ไม่มีอีเมล → สร้างไม่ได้"""
    with pytest.raises(ValueError):
        make_user(email="")


def test_duplicate_email_is_rejected_regardless_of_case() -> None:
    """อีเมลซ้ำ (แม้ต่างแค่ตัวพิมพ์ใหญ่/เล็ก) → ฐานข้อมูลไม่ยอมบันทึก"""
    make_user(email="dup@example.com")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_user(email="DUP@example.com")


def test_case_insensitive_constraint_blocks_writes_that_skip_save() -> None:
    """เขียนข้อมูลโดยไม่ผ่าน save() (เช่น update ทีละหลายแถว) → กฎในฐานข้อมูลยังกันอีเมลซ้ำได้"""
    make_user(email="first@example.com")
    second = make_user(email="second@example.com")

    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.filter(pk=second.pk).update(email="FIRST@example.com")


def test_duplicate_student_or_staff_id_is_rejected() -> None:
    """รหัสนักศึกษา/พนักงานซ้ำ → ฐานข้อมูลไม่ยอมบันทึก"""
    make_user(email="a@example.com", student_or_staff_id="690000001")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_user(email="b@example.com", student_or_staff_id="690000001")


def test_users_without_id_do_not_conflict() -> None:
    """หลายคนไม่มีรหัส (ว่าง / ช่องว่าง / None) → เก็บเป็น NULL และไม่ชนกัน"""
    first = make_user(email="a@example.com", student_or_staff_id="")
    second = make_user(email="b@example.com", student_or_staff_id="   ")
    third = make_user(email="c@example.com", student_or_staff_id=None)

    for user in (first, second, third):
        user.refresh_from_db()
        assert user.student_or_staff_id is None


def test_student_or_staff_id_is_trimmed() -> None:
    """รหัสที่มีช่องว่างหัว-ท้าย → ตัดออกก่อนบันทึก"""
    user = make_user(student_or_staff_id=" 690000001 ")

    user.refresh_from_db()
    assert user.student_or_staff_id == "690000001"


def test_create_superuser_is_admin_with_admin_site_access() -> None:
    """createsuperuser → บทบาท admin + เข้าหน้า /admin/ ได้"""
    user = User.objects.create_superuser(
        email="root@example.com", password="x-strong-pass-1", first_name="ผู้", last_name="ดูแล"
    )

    assert user.role == User.Role.ADMIN
    assert user.is_staff is True
    assert user.is_superuser is True


def test_create_superuser_rejects_non_admin_role() -> None:
    """superuser ที่บทบาทไม่ใช่ admin → สร้างไม่ได้"""
    with pytest.raises(ValueError):
        User.objects.create_superuser(
            email="root@example.com", password="x", role=User.Role.TEACHER
        )


def test_authenticate_by_email_ignores_case() -> None:
    """เข้าสู่ระบบด้วยอีเมล (แบบที่หน้า /admin/ ใช้) — พิมพ์ตัวพิมพ์ใหญ่มาก็ผ่าน"""
    user = make_user(email="login@example.com")

    assert authenticate(username="LOGIN@example.com", password="a-strong-pass-123") == user
    assert authenticate(username="login@example.com", password="wrong") is None


def test_suspended_user_cannot_authenticate() -> None:
    """บัญชีที่ถูกระงับ (is_active=False) → เข้าสู่ระบบไม่ได้แม้รหัสผ่านถูก"""
    make_user(email="off@example.com", is_active=False)

    assert authenticate(username="off@example.com", password="a-strong-pass-123") is None


def test_created_by_is_cleared_when_creator_is_deleted() -> None:
    """ผู้สร้างถูกลบ (ปกติไม่ลบ) → ช่อง created_by กลายเป็นว่าง บัญชีที่ถูกสร้างไม่หายตาม"""
    creator = make_user(email="admin@example.com", role=User.Role.ADMIN)
    created = make_user(email="new@example.com", created_by=creator)

    creator.delete()

    created.refresh_from_db()
    assert created.created_by is None


def test_names_and_str() -> None:
    """ชื่อเต็ม / ชื่อสั้น / ข้อความแทนผู้ใช้ (อีเมล)"""
    user = make_user(first_name="สมมติ", last_name="ทดลอง")

    assert user.get_full_name() == "สมมติ ทดลอง"
    assert user.get_short_name() == "สมมติ"
    assert str(user) == "someone@example.com"
