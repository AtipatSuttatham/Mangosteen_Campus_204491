"""
งานหลักของการลงทะเบียน (ขั้น 3.4) — แยกจาก views.py ให้อ่านและทดสอบง่าย
อ้างอิง: docs/api.md §9, docs/database-guide.md W4 / W5, CLAUDE.md "การตัดสินใจก้อน 3"

ทุกฟังก์ชันต้องเรียกใน transaction.atomic() หลังล็อกแถววิชาแล้ว (get_managed_course(..., lock=True))
→ คำขอเพิ่ม / ถอน / เข้าร่วมของวิชาเดียวกันต่อคิวกัน ไม่เกิดระเบียนซ้ำจากการกดพร้อมกัน
"""

from django.utils import timezone

from academics.models import Course
from accounts.models import User
from audit.models import AuditAction
from audit.services import log_action
from enrollment.models import Enrollment

# เหตุผลที่เพิ่มไม่ได้ (หน้าจอแปลเป็นข้อความไทย)
NOT_FOUND = "not_found"  # ไม่พบผู้ใช้จากรหัส / อีเมลนี้
NOT_STUDENT = "not_student"  # เป็นบัญชีผู้สอน / ผู้ดูแลระบบ
SUSPENDED = "suspended"  # บัญชีผู้เรียนถูกระงับ


def _normalize(identifier: str) -> str:
    """รหัสหรืออีเมล 1 บรรทัด: ตัดช่องว่าง ; อีเมล (มี @) แปลงเป็นตัวพิมพ์เล็ก (ระบบเก็บอีเมลตัวเล็กเสมอ)"""
    value = identifier.strip()
    return value.lower() if "@" in value else value


def clean_identifiers(identifiers: list[str]) -> list[str]:
    """ข้ามบรรทัดว่าง และนับรายการซ้ำครั้งเดียว (ตามตำแหน่งแรก) — คงลำดับที่วางมา"""
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in identifiers:
        value = _normalize(raw)
        if value and value not in seen:
            seen.add(value)
            cleaned.append(value)
    return cleaned


def _find_users(identifiers: list[str]) -> dict[str, User]:
    """หาผู้ใช้จากรหัสนักศึกษาหรืออีเมลทั้งรายการในคำสั่งเดียว → {รหัส/อีเมล: ผู้ใช้}"""
    emails = [value for value in identifiers if "@" in value]
    ids = [value for value in identifiers if "@" not in value]
    found: dict[str, User] = {}
    for user in User.objects.filter(email__in=emails):
        found[user.email] = user
    for user in User.objects.filter(student_or_staff_id__in=ids):
        found[user.student_or_staff_id or ""] = user
    return found


def activate(enrollment: Enrollment, added_by: User | None) -> None:
    """เปลี่ยนระเบียนที่ถูกถอนกลับเป็นกำลังเรียน: เวลาเข้าร่วมใหม่, ล้างเวลาถอน, ผู้เพิ่ม = คนที่กด"""
    enrollment.status = Enrollment.Status.ACTIVE
    enrollment.dropped_at = None
    enrollment.enrolled_at = timezone.now()
    enrollment.enrolled_by = added_by
    enrollment.save(
        update_fields=["status", "dropped_at", "enrolled_at", "enrolled_by", "updated_at"]
    )


def add_students(course: Course, actor: User, identifiers: list[str]) -> dict[str, list]:
    """
    เพิ่มผู้เรียนเข้าวิชาตามรายการรหัสนักศึกษา / อีเมล — เพิ่มคนที่ถูกไปก่อน แล้วรายงานที่เหลือ

    คืน {"added": [...], "reactivated": [...], "already": [...], "failed": [...]}
    - added / reactivated / already: [(รหัสหรืออีเมลที่วาง, ระเบียน), ...]
    - failed: [{"identifier", "reason"}] เรียงตามลำดับที่วาง (หน้าจอใส่กลับในช่องได้ตามลำดับเดิม)
    - ผู้ใช้คนเดียวกันมาทั้งทางรหัสและอีเมล → นับครั้งเดียว
    - เพิ่มใหม่ / เพิ่มกลับ → AuditLog enroll 1 รายการต่อคน (actor = ผู้สอน / ผู้ดูแลระบบที่กด)
    """
    cleaned = clean_identifiers(identifiers)
    users = _find_users(cleaned)
    existing = {
        enrollment.student_id: enrollment
        for enrollment in Enrollment.objects.filter(
            course=course, student__in=[user.pk for user in users.values()]
        )
    }

    result: dict[str, list] = {"added": [], "reactivated": [], "already": [], "failed": []}
    handled: set[int] = set()
    for identifier in cleaned:
        user = users.get(identifier)
        if user is None:
            result["failed"].append({"identifier": identifier, "reason": NOT_FOUND})
            continue
        if user.role != User.Role.STUDENT:
            result["failed"].append({"identifier": identifier, "reason": NOT_STUDENT})
            continue
        if not user.is_active:
            result["failed"].append({"identifier": identifier, "reason": SUSPENDED})
            continue
        if user.pk in handled:
            continue
        handled.add(user.pk)

        enrollment = existing.get(user.pk)
        if enrollment is None:
            enrollment = Enrollment.objects.create(course=course, student=user, enrolled_by=actor)
            changes = {"status": [None, Enrollment.Status.ACTIVE]}
            result["added"].append((identifier, enrollment))
        elif enrollment.status == Enrollment.Status.DROPPED:
            activate(enrollment, actor)
            changes = {"status": [Enrollment.Status.DROPPED, Enrollment.Status.ACTIVE]}
            result["reactivated"].append((identifier, enrollment))
        else:
            result["already"].append((identifier, enrollment))
            continue
        log_action(actor=actor, action=AuditAction.ENROLL, target=enrollment, changes=changes)
    return result
