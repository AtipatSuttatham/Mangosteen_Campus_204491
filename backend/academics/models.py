"""
ตาราง Course — รายวิชา 1 วิชาใน 1 ภาคการศึกษา (วิชาเดิมเปิดคนละภาค = คนละแถว)
อ้างอิง: docs/database.md §4 (รายงานตาราง 4.4), §11 v2.5 และ CLAUDE.md "การตัดสินใจก้อน 3"

กฎที่ฐานข้อมูลบังคับเอง (ไม่ว่าข้อมูลจะเข้ามาทางไหน):
- รหัสวิชาไม่ซ้ำภายในปีการศึกษา + ภาคเรียนเดียวกัน (ข้ามภาคใช้รหัสเดิมได้)
- ภาคเรียน 1 / 2 / 3 และปีการศึกษา 2500–2700 (กันพิมพ์ ค.ศ. หรือพิมพ์ขาด)
- รหัสเข้าร่วมไม่ซ้ำทั้งระบบ, รูปแบบ 8 ตัวตาม join_codes.py, เปิดใช้ได้ต่อเมื่อมีรหัส

กฎที่ตรวจในชั้น API (ขั้น 3.3): ผู้สอนต้องเป็นบัญชีผู้สอน, เปลี่ยนผู้สอนได้เฉพาะผู้ดูแลระบบ,
ลบได้เฉพาะวิชาที่ยังไม่เผยแพร่และไม่เคยมีผู้เรียน, เปิดวิชาที่ปิดแล้วคืนได้เฉพาะผู้ดูแลระบบ
"""

from django.conf import settings
from django.db import models

from academics.join_codes import JOIN_CODE_LENGTH, JOIN_CODE_PATTERN
from common.models import TimeStampedModel

# ช่วงปีการศึกษา (พ.ศ.) ที่ยอมรับ — กว้างพอใช้งานจริง แต่กันค่าผิดอย่าง 2026 (ค.ศ.) หรือ 269
MIN_ACADEMIC_YEAR = 2500
MAX_ACADEMIC_YEAR = 2700


class Course(TimeStampedModel):
    """รายวิชา 1 ตัว — มีผู้สอนคนเดียว (teacher) ; ผู้เรียนผูกผ่านตาราง Enrollment"""

    class Semester(models.IntegerChoices):
        """ภาคเรียน (3 = ภาคฤดูร้อน)"""

        FIRST = 1, "ภาคเรียนที่ 1"
        SECOND = 2, "ภาคเรียนที่ 2"
        SUMMER = 3, "ภาคฤดูร้อน"

    # ปีการศึกษาที่เปิดสอน (พ.ศ.) เช่น 2569
    academic_year = models.PositiveSmallIntegerField("ปีการศึกษา")
    # ภาคเรียน 1 / 2 / 3
    semester = models.PositiveSmallIntegerField("ภาคเรียน", choices=Semester.choices)
    # ผู้สอนที่รับผิดชอบ (1 วิชา 1 คน) — PROTECT: ลบบัญชีผู้สอนที่มีวิชาไม่ได้ (ระบบใช้การระงับแทน)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="ผู้สอน",
        on_delete=models.PROTECT,
        related_name="taught_courses",
    )
    # รหัสวิชา เช่น "204111"
    code = models.CharField("รหัสวิชา", max_length=20)
    # ชื่อรายวิชา
    name = models.CharField("ชื่อรายวิชา", max_length=200)
    # คำอธิบายรายวิชา (Markdown) — ไม่บังคับ
    description = models.TextField("คำอธิบายรายวิชา", blank=True)
    # เปิดให้ผู้เรียนเข้าร่วมเองด้วยรหัสเข้าร่วมหรือไม่
    join_code_enabled = models.BooleanField("เปิดใช้รหัสเข้าร่วม", default=False)
    # รหัสเข้าร่วม (สุ่มแยกจากรหัสวิชา — join_codes.py) ; NULL = ยังไม่เคยเปิดใช้
    # ใช้ NULL แทนข้อความว่าง เพราะ NULL ไม่นับว่า "ซ้ำกัน" จึงมีหลายวิชาที่ยังไม่มีรหัสได้
    join_code = models.CharField(  # noqa: DJ001
        "รหัสเข้าร่วม", max_length=JOIN_CODE_LENGTH, unique=True, null=True, blank=True
    )
    # True = ผู้เรียนเห็นและเข้าใช้งานได้
    is_published = models.BooleanField("เผยแพร่แล้ว", default=False)
    # True = ปิดรายวิชาแล้ว ผู้เรียนดูย้อนหลังได้อย่างเดียว (เปิดคืนได้เฉพาะผู้ดูแลระบบ)
    is_closed = models.BooleanField("ปิดรายวิชาแล้ว", default=False)
    # ผู้สร้าง (ผู้สอนเอง หรือผู้ดูแลระบบที่สร้างแทน) — ถ้าบัญชีผู้สร้างถูกลบ ช่องนี้กลายเป็นว่าง
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="สร้างโดย",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_courses",
    )

    class Meta:
        verbose_name = "รายวิชา"
        verbose_name_plural = "รายวิชา"
        # ภาคล่าสุดขึ้นก่อน แล้วเรียงตามรหัสวิชา (ตรงกับหน้า "รายวิชาของฉัน")
        ordering = ("-academic_year", "-semester", "code")
        constraints = [
            # รหัสวิชาไม่ซ้ำภายในภาคการศึกษาเดียวกัน (index นี้ใช้ค้นตามภาคได้เร็วด้วย — §11)
            models.UniqueConstraint(
                fields=["academic_year", "semester", "code"],
                name="academics_course_code_per_term_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(semester__in=[1, 2, 3]),
                name="academics_course_semester_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    academic_year__gte=MIN_ACADEMIC_YEAR, academic_year__lte=MAX_ACADEMIC_YEAR
                ),
                name="academics_course_academic_year_range",
            ),
            # เปิดใช้รหัสเข้าร่วมได้ต่อเมื่อมีรหัสแล้ว
            models.CheckConstraint(
                condition=models.Q(join_code_enabled=False) | models.Q(join_code__isnull=False),
                name="academics_course_join_code_when_enabled",
            ),
            # รหัสเข้าร่วม (ถ้ามี) ต้องเป็นตัวพิมพ์ใหญ่ 8 ตัวจากชุดตัวอักษรที่กำหนด
            models.CheckConstraint(
                condition=models.Q(join_code__isnull=True)
                | models.Q(join_code__regex=JOIN_CODE_PATTERN),
                name="academics_course_join_code_format",
            ),
        ]

    def __str__(self) -> str:
        # เช่น "204111 Python พื้นฐาน (2569/1)" — ใช้ใน /admin/ และ AuditLog.object_repr
        return f"{self.code} {self.name} ({self.academic_year}/{self.semester})"
