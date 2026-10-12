"""
test ของตาราง AuditLog + ฟังก์ชันเขียนบันทึก (audit/models.py, audit/services.py)
"""

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType

from accounts.models import User
from audit.models import AuditAction, AuditLog, AuditLogImmutableError
from audit.services import (
    MASK,
    created_changes,
    diff_changes,
    field_values,
    log_action,
    mask_sensitive,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_user() -> User:
    """ผู้ดูแลระบบสมมติ (ผู้กระทำ)"""
    return User.objects.create_user(
        email="admin@example.com", password="x-strong-pass-1", role=User.Role.ADMIN
    )


@pytest.fixture
def student() -> User:
    """ผู้เรียนสมมติ (ระเบียนที่ถูกกระทำ)"""
    return User.objects.create_user(
        email="student@example.com",
        password="x-strong-pass-1",
        first_name="สมใจ",
        last_name="รักเรียน",
        student_or_staff_id="690000001",
        role=User.Role.STUDENT,
    )


# --- ตัวช่วยคำนวณ changes ---


def test_field_values_reads_plain_fk_and_file_fields(admin_user: User, student: User) -> None:
    """อ่านค่าช่องธรรมดา / FK (เป็นรหัส) / ไฟล์ (เป็นตำแหน่ง หรือ None ถ้าไม่มี)"""
    student.created_by = admin_user
    values = field_values(student, ["first_name", "role", "is_active", "created_by", "avatar_url"])

    assert values == {
        "first_name": "สมใจ",
        "role": "student",
        "is_active": True,
        "created_by": admin_user.pk,
        "avatar_url": None,
    }


def test_diff_changes_keeps_only_changed_fields() -> None:
    """แก้ไข → เก็บเฉพาะช่องที่ค่าเปลี่ยน"""
    before = {"first_name": "สมใจ", "role": "student", "is_active": True}
    after = {"first_name": "สมใจ", "role": "teacher", "is_active": False}

    assert diff_changes(before, after) == {
        "role": ["student", "teacher"],
        "is_active": [True, False],
    }


def test_diff_changes_empty_when_nothing_changed() -> None:
    """ไม่มีอะไรเปลี่ยน → dict ว่าง"""
    assert diff_changes({"role": "student"}, {"role": "student"}) == {}


def test_created_changes_skips_empty_values() -> None:
    """สร้าง → {"field": [None, ค่า]} และข้ามช่องที่ไม่ได้ตั้งค่า"""
    values = {"email": "a@example.com", "student_or_staff_id": None, "first_name": ""}

    assert created_changes(values) == {"email": [None, "a@example.com"]}


def test_mask_sensitive_hides_password_without_touching_input() -> None:
    """ช่อง password ถูกปิดเป็น *** และ dict ต้นฉบับไม่ถูกแก้"""
    original = {"password": ["old-secret", "new-secret"], "role": ["student", "teacher"]}

    masked = mask_sensitive(original)

    assert masked == {"password": [MASK, MASK], "role": ["student", "teacher"]}
    assert original["password"] == ["old-secret", "new-secret"]


# --- log_action ---


def test_log_action_records_target_and_changes(admin_user: User, student: User) -> None:
    """บันทึกผู้กระทำ การกระทำ ชนิดตาราง รหัสระเบียน ข้อความแสดงระเบียน และสิ่งที่เปลี่ยน"""
    log = log_action(
        actor=admin_user,
        action=AuditAction.UPDATE,
        target=student,
        changes={"is_active": [True, False]},
    )

    log.refresh_from_db()
    assert log.actor == admin_user
    assert log.action == "update"
    assert log.content_type == ContentType.objects.get_for_model(User)
    assert log.object_id == str(student.pk)
    assert log.object_repr == str(student)
    assert log.changes == {"is_active": [True, False]}
    assert log.created_at is not None


def test_log_action_never_stores_password(admin_user: User, student: User) -> None:
    """ส่งรหัสผ่านจริงมาก็ถูกเก็บเป็น *** เสมอ (ค้นในฐานข้อมูลแล้วไม่เจอรหัสจริง)"""
    log_action(
        actor=admin_user,
        action=AuditAction.UPDATE,
        target=student,
        changes={"password": ["x-strong-pass-1", "new-temp-pass-9"]},
    )

    log = AuditLog.objects.get()
    assert log.changes == {"password": [MASK, MASK]}
    assert not AuditLog.objects.filter(changes__icontains="new-temp-pass-9").exists()


def test_log_action_custom_repr_is_truncated(admin_user: User, student: User) -> None:
    """ส่งข้อความแสดงระเบียนเองได้ และถูกตัดให้ไม่เกิน 200 ตัว"""
    log = log_action(
        actor=admin_user, action=AuditAction.CREATE, target=student, object_repr="ก" * 250
    )

    assert log.object_repr == "ก" * 200


def test_log_action_without_target_or_changes(admin_user: User) -> None:
    """เหตุการณ์ที่ไม่ผูกกับระเบียนและไม่เปลี่ยนข้อมูล → ชนิดตาราง/รหัส/changes เป็น null"""
    log = log_action(
        actor=admin_user, action=AuditAction.IMPERSONATE_END, object_repr="สิ้นสุดจำลองมุมมอง"
    )

    assert log.content_type is None
    assert log.object_id is None
    assert log.changes is None


def test_log_action_empty_changes_stored_as_null(admin_user: User, student: User) -> None:
    """changes ว่าง → เก็บเป็น null (ไม่มีการเปลี่ยนข้อมูล)"""
    log = log_action(actor=admin_user, action=AuditAction.UPDATE, target=student, changes={})

    assert log.changes is None


def test_log_action_anonymous_actor_becomes_system(student: User) -> None:
    """ผู้ใช้ที่ไม่ได้เข้าสู่ระบบ / None → บันทึกเป็น "ระบบ" (actor = null)"""
    first = log_action(actor=AnonymousUser(), action=AuditAction.CREATE, target=student)
    second = log_action(actor=None, action=AuditAction.CREATE, target=student)

    assert first.actor is None
    assert second.actor is None


def test_log_action_accepts_plain_string_action(admin_user: User, student: User) -> None:
    """ส่งการกระทำเป็นข้อความธรรมดาได้ ถ้าอยู่ใน 9 ค่า"""
    log = log_action(actor=admin_user, action="grade", target=student)

    assert log.action == AuditAction.GRADE


def test_log_action_rejects_unknown_action(admin_user: User, student: User) -> None:
    """การกระทำที่ไม่รู้จัก (เช่น พิมพ์ผิด) → ValueError และไม่มีบันทึกเกิดขึ้น"""
    with pytest.raises(ValueError):
        log_action(actor=admin_user, action="suspend", target=student)

    assert not AuditLog.objects.exists()


# --- ตาราง AuditLog ---


def test_audit_log_cannot_be_edited_or_deleted(admin_user: User, student: User) -> None:
    """บันทึกเป็นหลักฐาน: แก้แล้ว save ไม่ได้ และลบทีละแถวไม่ได้"""
    log = log_action(actor=admin_user, action=AuditAction.CREATE, target=student)

    log.object_repr = "แก้ไขหลักฐาน"
    with pytest.raises(AuditLogImmutableError):
        log.save()
    with pytest.raises(AuditLogImmutableError):
        log.delete()

    log.refresh_from_db()
    assert log.object_repr == str(student)


def test_deleting_actor_keeps_log(admin_user: User, student: User) -> None:
    """ผู้กระทำถูกลบ → บันทึกยังอยู่ แต่ผู้กระทำเป็น null"""
    log = log_action(actor=admin_user, action=AuditAction.CREATE, target=student)

    admin_user.delete()

    log.refresh_from_db()
    assert log.actor is None


def test_newest_log_comes_first(admin_user: User, student: User) -> None:
    """เรียงล่าสุดขึ้นก่อน"""
    first = log_action(actor=admin_user, action=AuditAction.CREATE, target=student)
    second = log_action(actor=admin_user, action=AuditAction.UPDATE, target=student)

    assert list(AuditLog.objects.all()) == [second, first]


def test_str_shows_action_and_target(admin_user: User, student: User) -> None:
    """ข้อความแสดงบันทึก = การกระทำ (ภาษาไทย) + ข้อมูลที่ถูกกระทำ"""
    log = log_action(actor=admin_user, action=AuditAction.UPDATE, target=student)

    assert str(log) == f"แก้ไข: {student}"
