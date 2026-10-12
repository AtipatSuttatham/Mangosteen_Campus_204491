"""
ตาราง AuditLog — สมุดบันทึกว่า "ใคร ทำอะไร กับข้อมูลไหน เมื่อไร เปลี่ยนจากอะไรเป็นอะไร"
อ้างอิง: docs/database.md §10 (รายงานตาราง 4.21)

ใช้เป็นหลักฐาน จึงเขียนได้อย่างเดียว: บันทึกแล้วแก้หรือลบผ่านโค้ดของระบบไม่ได้
การเขียนบันทึกทำผ่าน audit.services.log_action() เท่านั้น (ไม่สร้าง AuditLog ตรง ๆ)
"""

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models


class AuditAction(models.TextChoices):
    """การกระทำที่บันทึกได้ — 9 ค่าตาม docs/database.md §10 (ป้ายภาษาไทยใช้ในหน้า /admin/)"""

    CREATE = "create", "สร้าง"
    UPDATE = "update", "แก้ไข"
    DELETE = "delete", "ลบ"
    CLOSE_COURSE = "close_course", "ปิดรายวิชา"
    ENROLL = "enroll", "ลงทะเบียน"
    UNENROLL = "unenroll", "ถอนการลงทะเบียน"
    GRADE = "grade", "ให้คะแนน"
    IMPERSONATE_START = "impersonate_start", "เริ่มจำลองมุมมอง"
    IMPERSONATE_END = "impersonate_end", "สิ้นสุดจำลองมุมมอง"


class AuditLogImmutableError(Exception):
    """เกิดเมื่อมีโค้ดพยายามแก้หรือลบบันทึกที่บันทึกไปแล้ว (บันทึกเป็นหลักฐาน ห้ามเปลี่ยน)"""


class AuditLog(models.Model):
    """
    1 แถว = 1 เหตุการณ์ ; มีเฉพาะ created_at (ไม่มี updated_at เพราะไม่มีการแก้ไข)
    ไม่สืบทอด TimeStampedModel ตาม docs/database.md §1
    """

    # ผู้กระทำ — null = ระบบทำเอง ; ถ้าผู้ใช้ถูกลบ บันทึกยังอยู่ (SET_NULL)
    # กรณีผู้ดูแลระบบทำแทนผู้สอน actor = ผู้ดูแลระบบ
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="ผู้กระทำ",
    )
    # การกระทำ (9 ค่า)
    action = models.CharField("การกระทำ", max_length=32, choices=AuditAction.choices)
    # ชนิดตารางเป้าหมาย (ตารางระบบของ Django) — null = เหตุการณ์ที่ไม่ผูกกับข้อมูลใด
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="ชนิดข้อมูล",
    )
    # รหัสระเบียนเป้าหมาย (เก็บเป็นข้อความ รองรับ PK ทุกชนิด)
    # null = ไม่ผูกกับระเบียนใด (ตามสเปก) — แยกจาก "" ชัดเจน จึงยกเว้นกฎ DJ001 ของ ruff
    object_id = models.CharField(  # noqa: DJ001
        "รหัสระเบียน", max_length=64, null=True, blank=True
    )
    # ข้อความแสดงระเบียน ณ เวลาที่บันทึก — ยังอ่านได้แม้ระเบียนถูกลบหรือเปลี่ยนชื่อภายหลัง
    object_repr = models.CharField("ข้อมูลที่ถูกกระทำ", max_length=200)
    # สิ่งที่เปลี่ยน {"field": [ค่าเดิม, ค่าใหม่]} ; null = ไม่มีการเปลี่ยนข้อมูล (เช่น จำลองมุมมอง)
    # ใช้ DjangoJSONEncoder เพื่อเก็บวันที่/ตัวเลขทศนิยมได้ ; รหัสผ่านถูกปิดเป็น "***" เสมอ (services.py)
    changes = models.JSONField("สิ่งที่เปลี่ยน", null=True, blank=True, encoder=DjangoJSONEncoder)
    # เวลาที่เกิดเหตุการณ์ (UTC) — มี index เพราะหน้าประวัติกรองตามช่วงวันที่ (UC-06)
    created_at = models.DateTimeField("เวลา", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "บันทึกการใช้งาน"
        verbose_name_plural = "บันทึกการใช้งาน"
        # ล่าสุดขึ้นก่อน (id ช่วยเรียงเหตุการณ์ที่เกิดในเวลาเดียวกัน)
        ordering = ("-created_at", "-id")
        indexes = [
            # หาประวัติของระเบียนหนึ่ง ๆ ได้เร็ว (docs/database.md §11 "Index ที่ต้องเพิ่ม")
            models.Index(fields=["content_type", "object_id"], name="audit_target_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_action_display()}: {self.object_repr}"

    def save(self, *args, **kwargs) -> None:
        """บันทึกได้ครั้งเดียวตอนสร้าง — แก้แถวที่มีอยู่แล้วไม่ได้"""
        if not self._state.adding:
            raise AuditLogImmutableError("บันทึกประวัติการใช้งานแก้ไขไม่ได้")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """ลบบันทึกทีละแถวไม่ได้ (เป็นหลักฐาน)"""
        raise AuditLogImmutableError("บันทึกประวัติการใช้งานลบไม่ได้")
