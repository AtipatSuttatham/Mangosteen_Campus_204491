"""
งานหลักของการลงทะเบียน (ขั้น 3.4) — แยกจาก views.py ให้อ่านและทดสอบง่าย
อ้างอิง: docs/api.md §9, docs/database-guide.md W4 / W5, CLAUDE.md "การตัดสินใจก้อน 3"

ทุกฟังก์ชันต้องเรียกใน transaction.atomic() หลังล็อกแถววิชาแล้ว (get_managed_course(..., lock=True))
→ คำขอเพิ่ม / ถอน / เข้าร่วมของวิชาเดียวกันต่อคิวกัน ไม่เกิดระเบียนซ้ำจากการกดพร้อมกัน
"""

from collections.abc import Iterator

from django.utils import timezone

from academics.join_codes import normalize_join_code
from academics.models import Course
from accounts.models import User
from audit.models import AuditAction
from audit.services import log_action
from common.exceptions import ApiError
from enrollment.models import Enrollment

# เหตุผลที่เพิ่มไม่ได้ (หน้าจอแปลเป็นข้อความไทย)
NOT_FOUND = "not_found"  # ไม่พบผู้ใช้จากรหัส / อีเมลนี้
NOT_STUDENT = "not_student"  # เป็นบัญชีผู้สอน / ผู้ดูแลระบบ
SUSPENDED = "suspended"  # บัญชีผู้เรียนถูกระงับ

# ผลตรวจรายการก่อนเพิ่มของคนที่เพิ่มได้ (คู่กับเหตุผลที่เพิ่มไม่ได้ด้านบน)
PREVIEW_ADD = "add"  # ยังไม่อยู่ในวิชา → จะเพิ่ม
PREVIEW_REACTIVATE = "reactivate"  # เคยถูกถอน → เพิ่มกลับ
PREVIEW_ALREADY = "already"  # กำลังเรียนอยู่แล้ว


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


def _resolve(course: Course, cleaned: list[str]) -> Iterator[tuple]:
    """
    จับคู่รายการ (ที่ผ่าน clean_identifiers แล้ว) กับบัญชีและระเบียนในวิชานี้ ตามลำดับที่วาง
    คืนทีละรายการ (รหัสหรืออีเมล, ผู้ใช้, เหตุผลที่เพิ่มไม่ได้, ระเบียนเดิม)
    - เพิ่มไม่ได้: ผู้ใช้ / ระเบียน = None และมีเหตุผล ; เพิ่มได้: เหตุผล = None ; ยังไม่เคยอยู่ในวิชา: ระเบียน = None
    - ผู้ใช้คนเดียวกันมาทั้งทางรหัสและอีเมล → คืนแค่รายการแรก
    ใช้ทั้งการตรวจรายการ (preview_students) และการเพิ่มจริง (add_students) → ผลตรงกันเสมอ
    """
    users = _find_users(cleaned)
    existing = {
        enrollment.student_id: enrollment
        for enrollment in Enrollment.objects.filter(
            course=course, student__in=[user.pk for user in users.values()]
        )
    }
    handled: set[int] = set()
    for identifier in cleaned:
        user = users.get(identifier)
        if user is None:
            yield identifier, None, NOT_FOUND, None
        elif user.role != User.Role.STUDENT:
            yield identifier, None, NOT_STUDENT, None
        elif not user.is_active:
            yield identifier, None, SUSPENDED, None
        elif user.pk not in handled:
            handled.add(user.pk)
            yield identifier, user, None, existing.get(user.pk)


def preview_students(course: Course, identifiers: list[str]) -> dict:
    """
    ตรวจรายการก่อนเพิ่ม (ปุ่ม "ตรวจรายการ") — อ่านอย่างเดียว ไม่บันทึกข้อมูลและไม่จด AuditLog

    คืน {"rows": [...], "duplicates": จำนวนรายการซ้ำ}
    - rows: [{"identifier", "result", "student"}] เรียงตามลำดับที่วาง
      result: add (จะเพิ่ม) / reactivate (เพิ่มกลับ) / already (อยู่แล้ว) / เหตุผลที่เพิ่มไม่ได้
      student: บัญชีผู้เรียน ; เพิ่มไม่ได้ = None (ไม่แสดงข้อมูลบัญชีเกินจำเป็น)
    - duplicates: บรรทัดที่ไม่ว่างแต่ไม่มีแถวในผลตรวจ (ซ้ำกันเอง หรือเป็นคนเดียวกับแถวก่อนหน้า)
    """
    rows: list[dict] = []
    for identifier, user, reason, enrollment in _resolve(course, clean_identifiers(identifiers)):
        if reason:
            result = reason
        elif enrollment is None:
            result = PREVIEW_ADD
        elif enrollment.status == Enrollment.Status.DROPPED:
            result = PREVIEW_REACTIVATE
        else:
            result = PREVIEW_ALREADY
        rows.append({"identifier": identifier, "result": result, "student": user})
    filled = sum(1 for value in identifiers if value.strip())
    return {"rows": rows, "duplicates": filled - len(rows)}


def add_students(course: Course, actor: User, identifiers: list[str]) -> dict[str, list]:
    """
    เพิ่มผู้เรียนเข้าวิชาตามรายการรหัสนักศึกษา / อีเมล — เพิ่มคนที่ถูกไปก่อน แล้วรายงานที่เหลือ

    คืน {"added": [...], "reactivated": [...], "already": [...], "failed": [...]}
    - added / reactivated / already: [(รหัสหรืออีเมลที่วาง, ระเบียน), ...]
    - failed: [{"identifier", "reason"}] เรียงตามลำดับที่วาง (หน้าจอใส่กลับในช่องได้ตามลำดับเดิม)
    - ผู้ใช้คนเดียวกันมาทั้งทางรหัสและอีเมล → นับครั้งเดียว
    - เพิ่มใหม่ / เพิ่มกลับ → AuditLog enroll 1 รายการต่อคน (actor = ผู้สอน / ผู้ดูแลระบบที่กด)
    """
    result: dict[str, list] = {"added": [], "reactivated": [], "already": [], "failed": []}
    for identifier, user, reason, enrollment in _resolve(course, clean_identifiers(identifiers)):
        if reason:
            result["failed"].append({"identifier": identifier, "reason": reason})
            continue
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


def drop(enrollment: Enrollment, actor: User) -> None:
    """
    ถอนผู้เรียนออกจากวิชา: สถานะ "ถูกถอน" + เวลาถอน → AuditLog unenroll
    ไม่ลบระเบียน (คะแนนเดิมอยู่ครบ) ; ถูกถอนอยู่แล้ว → ไม่ทำอะไรและไม่จด
    """
    if enrollment.status == Enrollment.Status.DROPPED:
        return
    enrollment.status = Enrollment.Status.DROPPED
    enrollment.dropped_at = timezone.now()
    enrollment.save(update_fields=["status", "dropped_at", "updated_at"])
    log_action(
        actor=actor,
        action=AuditAction.UNENROLL,
        target=enrollment,
        changes={"status": [Enrollment.Status.ACTIVE, Enrollment.Status.DROPPED]},
    )


def join_code_invalid_error() -> ApiError:
    """
    ใช้รหัสนี้เข้าร่วมไม่ได้ — ข้อความเดียวทุกกรณี (ไม่มีรหัสนี้ / ปิดรหัส / ยังไม่เผยแพร่ / ปิดวิชา /
    เคยถูกถอน) กันการเดารหัสแล้วรู้ข้อมูลวิชา (ข้อตกลงก้อน 3)
    """
    return ApiError("join_code_invalid", "This join code cannot be used.")


def join_with_code(student: User, raw_code: str) -> tuple[Course, bool]:
    """
    ผู้เรียนเข้าร่วมวิชาด้วยรหัส → (วิชา, เข้าร่วมใหม่หรือไม่) ; ต้องเรียกใน transaction.atomic()

    ผ่านได้เมื่อ: วิชาเปิดใช้รหัส + เผยแพร่แล้ว + ยังไม่ปิด + ผู้เรียนไม่เคยถูกถอนจากวิชานี้
    (ผู้ใช้เลือกแบบ ข 2026-10-18 — การถอนต้องมีผลจริง ; เพิ่มกลับได้เฉพาะผู้สอน / ผู้ดูแลระบบ)
    - อยู่ในวิชาอยู่แล้ว → (วิชา, False) ไม่จด
    - เข้าร่วมใหม่ → Enrollment active ไม่มีผู้เพิ่ม (= เข้าร่วมด้วยรหัส) + AuditLog enroll โดยผู้เรียนเอง
    - ไม่ผ่านทุกกรณี → 400 join_code_invalid
    """
    course = (
        Course.objects.select_for_update().filter(join_code=normalize_join_code(raw_code)).first()
    )
    if course is None or not (
        course.join_code_enabled and course.is_published and not course.is_closed
    ):
        raise join_code_invalid_error()

    existing = Enrollment.objects.filter(course=course, student=student).first()
    if existing is not None:
        if existing.status == Enrollment.Status.DROPPED:
            raise join_code_invalid_error()
        return course, False

    enrollment = Enrollment.objects.create(course=course, student=student)
    log_action(
        actor=student,
        action=AuditAction.ENROLL,
        target=enrollment,
        changes={"status": [None, Enrollment.Status.ACTIVE]},
    )
    return course, True
