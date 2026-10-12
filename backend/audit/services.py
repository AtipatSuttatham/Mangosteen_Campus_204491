"""
ฟังก์ชันสำหรับเขียน AuditLog — ทุก app เรียกผ่านไฟล์นี้ที่เดียว

วิธีใช้ (ตัวอย่างจากขั้น 2.3 แก้ไขผู้ใช้):

    before = field_values(user, ["first_name", "role"])
    ... แก้ user แล้ว save ...
    log_action(
        actor=request.user,
        action=AuditAction.UPDATE,
        target=user,
        changes=diff_changes(before, field_values(user, ["first_name", "role"])),
    )

หลักการ:
- เรียก log_action() ภายใน transaction เดียวกับการแก้ข้อมูล → ถ้าการแก้ล้มเหลว บันทึกก็หายไปด้วย
- ช่องรหัสผ่านถูกปิดเป็น "***" เสมอ ไม่ว่าผู้เรียกจะส่งค่าอะไรมา (กันรหัสหลุดลงบันทึก)
"""

from collections.abc import Iterable
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models.fields.files import FieldFile

from audit.models import AuditAction, AuditLog

# ชื่อช่องที่ห้ามเก็บค่าจริงลงบันทึก — เก็บได้แค่ว่า "มีการเปลี่ยน"
SENSITIVE_FIELDS = frozenset({"password"})
# ค่าที่ใช้แทนข้อมูลลับ
MASK = "***"
# ความยาวสูงสุดของ object_repr (ตรงกับ max_length ในตาราง)
OBJECT_REPR_MAX = 200


def field_values(instance: models.Model, fields: Iterable[str]) -> dict[str, Any]:
    """
    อ่านค่าปัจจุบันของช่องที่ระบุจากระเบียน เป็นค่าที่เก็บลง JSON ได้
    - ช่อง FK → รหัสของระเบียนปลายทาง (เช่น created_by → 12)
    - ช่องไฟล์ → ตำแหน่งไฟล์ (เช่น "avatars/ab12.webp") หรือ None ถ้าไม่มีไฟล์
    """
    values: dict[str, Any] = {}
    for name in fields:
        value = instance._meta.get_field(name).value_from_object(instance)
        if isinstance(value, FieldFile):
            value = value.name or None
        values[name] = value
    return values


def diff_changes(before: dict[str, Any], after: dict[str, Any]) -> dict[str, list[Any]]:
    """
    เทียบค่าก่อน/หลังแก้ แล้วคืนเฉพาะช่องที่เปลี่ยน ในรูป {"field": [ค่าเดิม, ค่าใหม่]}
    ช่องที่ค่าเท่าเดิมไม่ถูกบันทึก (ตามข้อตกลง "แก้ไข → เฉพาะช่องที่เปลี่ยน")
    """
    return {
        name: [before.get(name), value]
        for name, value in after.items()
        if before.get(name) != value
    }


def created_changes(values: dict[str, Any]) -> dict[str, list[Any]]:
    """
    รูปแบบ changes ตอนสร้างระเบียนใหม่: {"field": [None, ค่าที่ตั้ง]}
    ข้ามช่องที่ไม่ได้ตั้งค่า (None / ข้อความว่าง) ให้บันทึกสั้นและอ่านง่าย
    """
    return {name: [None, value] for name, value in values.items() if value not in (None, "")}


def mask_sensitive(changes: dict[str, Any] | None) -> dict[str, Any] | None:
    """ปิดค่าของช่องลับ (เช่น password) เป็น ["***", "***"] — คืนสำเนาใหม่ ไม่แก้ dict เดิม"""
    if changes is None:
        return None
    return {
        name: [MASK, MASK] if name in SENSITIVE_FIELDS else value for name, value in changes.items()
    }


def log_action(
    *,
    actor: Any,
    action: AuditAction | str,
    target: models.Model | None = None,
    changes: dict[str, Any] | None = None,
    object_repr: str | None = None,
) -> AuditLog:
    """
    เขียนบันทึก 1 แถว

    - actor: ผู้กระทำ (มักเป็น request.user) ; ผู้ใช้ที่ไม่ได้เข้าสู่ระบบ/None → บันทึกว่าเป็น "ระบบ"
    - action: หนึ่งใน AuditAction (ค่าอื่น → ValueError กันพิมพ์ผิด)
    - target: ระเบียนที่ถูกกระทำ → ใช้หาชนิดตาราง + รหัสระเบียนให้อัตโนมัติ
    - changes: {"field": [เดิม, ใหม่]} ; dict ว่าง/None → เก็บเป็น null (ไม่มีการเปลี่ยนข้อมูล)
    - object_repr: ข้อความแสดงระเบียน ; ไม่ส่ง → ใช้ str(target) (ตัดให้ไม่เกิน 200 ตัว)
    """
    # ตรวจว่าเป็นการกระทำที่รู้จัก (ค่าที่ไม่อยู่ใน 9 ค่า → ValueError)
    action = AuditAction(action)

    # ผู้ใช้ที่ยังไม่เข้าสู่ระบบ (AnonymousUser) ไม่ใช่แถวในตาราง User → บันทึกเป็น null
    if actor is not None and not getattr(actor, "is_authenticated", False):
        actor = None

    content_type = None
    object_id = None
    if target is not None:
        content_type = ContentType.objects.get_for_model(target)
        object_id = str(target.pk)
        if object_repr is None:
            object_repr = str(target)

    return AuditLog.objects.create(
        actor=actor,
        action=action,
        content_type=content_type,
        object_id=object_id,
        object_repr=(object_repr or "")[:OBJECT_REPR_MAX],
        changes=mask_sensitive(changes) or None,
    )
