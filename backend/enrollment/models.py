"""
ตาราง Enrollment — ผู้เรียน 1 คนอยู่ในรายวิชา 1 วิชา + สถานะ (กำลังเรียน / ถูกถอน)
อ้างอิง: docs/database.md §6 (รายงานตาราง 4.22), §11 v2.5 และ docs/database-guide.md W4 / W5

หลักสำคัญ:
- 1 ผู้เรียนมีได้ 1 ระเบียนต่อวิชา — ถอนแล้วเพิ่มกลับ = เปลี่ยนระเบียนเดิมกลับเป็น active (คะแนนเดิมอยู่ครบ)
- enrolled_by ว่าง = ผู้เรียนเข้าร่วมเองด้วยรหัสเข้าร่วม ; มีค่า = ผู้สอน/ผู้ดูแลระบบเพิ่มให้
- "ต้องเป็นบัญชีผู้เรียน" ตรวจในชั้น API (ขั้น 3.4) เพราะฐานข้อมูลตรวจข้ามตารางไม่ได้
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel


class Enrollment(TimeStampedModel):
    """การลงทะเบียน 1 ระเบียน = ผู้เรียน 1 คน ในรายวิชา 1 วิชา"""

    class Status(models.TextChoices):
        """สถานะการลงทะเบียน (แผนภาพใน docs/database-guide.md §2)"""

        ACTIVE = "active", "กำลังเรียน"
        DROPPED = "dropped", "ถูกถอน"

    # รายวิชา — CASCADE: ลบวิชาแล้วระเบียนหายตาม (ลบวิชาได้เฉพาะที่ไม่เคยมีผู้เรียน จึงไม่มีข้อมูลหาย)
    course = models.ForeignKey(
        "academics.Course",
        verbose_name="รายวิชา",
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    # ผู้เรียน — PROTECT: เป็นทางเชื่อมเข้าสู่คะแนน ลบบัญชีที่เคยลงทะเบียนไม่ได้ (ใช้การระงับแทน)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="ผู้เรียน",
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    # สถานะ — ผู้เรียนที่ถูกถอนเข้าถึงรายวิชาไม่ได้ แต่คะแนนยังเก็บไว้
    status = models.CharField("สถานะ", max_length=16, choices=Status.choices, default=Status.ACTIVE)
    # ผู้ที่เพิ่มผู้เรียนเข้ารายวิชา — ว่าง = ผู้เรียนเข้าร่วมเองด้วยรหัสเข้าร่วม
    # ("+" = ไม่ต้องมีทางย้อนกลับจากบัญชีผู้เพิ่ม ; ใช้แสดงคอลัมน์ "วิธีเข้าร่วม" เท่านั้น)
    enrolled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="เพิ่มโดย",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    # เวลาที่เข้าร่วม (คอลัมน์ "เข้าร่วมเมื่อ" ในแท็บผู้เรียน)
    enrolled_at = models.DateTimeField("เข้าร่วมเมื่อ", default=timezone.now)
    # เวลาที่ถูกถอน — มีค่าเฉพาะตอน status = dropped (ฐานข้อมูลบังคับ)
    dropped_at = models.DateTimeField("ถอนเมื่อ", null=True, blank=True)

    class Meta:
        verbose_name = "การลงทะเบียน"
        verbose_name_plural = "การลงทะเบียน"
        ordering = ("course", "enrolled_at", "id")
        constraints = [
            # 1 ผู้เรียน 1 ระเบียนต่อวิชา
            models.UniqueConstraint(
                fields=["course", "student"], name="enrollment_course_student_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["active", "dropped"]),
                name="enrollment_status_valid",
            ),
            # ถูกถอน ⇔ มีเวลาถอน (กำลังเรียนต้องไม่มีเวลาถอนค้างอยู่)
            models.CheckConstraint(
                condition=models.Q(status="active", dropped_at__isnull=True)
                | models.Q(status="dropped", dropped_at__isnull=False),
                name="enrollment_dropped_at_matches_status",
            ),
        ]
        indexes = [
            # "วิชาของผู้เรียนคนนี้" และ "ผู้เรียนของวิชานี้" ตามสถานะ (docs/database.md §11)
            models.Index(fields=["student", "status"], name="enrollment_student_status_idx"),
            models.Index(fields=["course", "status"], name="enrollment_course_status_idx"),
        ]

    def __str__(self) -> str:
        # เช่น "s670510118@example.ac.th → 204111 (กำลังเรียน)" — ใช้ใน /admin/ และ AuditLog.object_repr
        return f"{self.student} → {self.course.code} ({self.get_status_display()})"
