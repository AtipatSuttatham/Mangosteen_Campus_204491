"""
ตาราง Module (หน่วยการเรียน) และ Content (เนื้อหา 1 ชิ้น) — โครงสร้าง Course → Module → Content
อ้างอิง: docs/database.md §5 (รายงานตาราง 4.5 / 4.6), §11 v2.7 และ CLAUDE.md "การตัดสินใจก้อน 4"

กฎที่ฐานข้อมูลบังคับเอง (ไม่ว่าข้อมูลจะเข้ามาทางไหน):
- ชนิดเนื้อหาต้องเป็น 1 ใน 6 ชนิด
- ข้อมูลต้องตรงกับชนิด: ข้อความไม่มีไฟล์/ลิงก์ ; ลิงก์มีลิงก์ ; เอกสาร/รูป/เสียงมีไฟล์ ;
  วิดีโอมีไฟล์ (อัปโหลด) **หรือ** ลิงก์ (YouTube) อย่างใดอย่างหนึ่ง
- มีไฟล์ ⇔ มีชื่อไฟล์เดิม + ขนาด + ชนิดไฟล์ (MIME) ; ไม่มีไฟล์ = ข้อมูลไฟล์ว่างทั้งหมด

กฎที่ตรวจในชั้น API (ขั้น 4.3): ชนิด/ขนาดไฟล์ที่รับ (ดูเนื้อไฟล์จริง), ระบบตั้งชนิดเองจากไฟล์ / ลิงก์,
หัวข้อตั้งจากชื่อไฟล์เมื่อไม่ได้กรอก, สิทธิ์ต่อรายวิชา, วิชาที่ปิดแล้วแก้ไม่ได้
ไฟล์บนที่เก็บไฟล์ถูกลบตามเมื่อแถว Content ถูกลบ (signals.py) — รวมกรณีลบหน่วย / รายวิชาแล้วลบต่อเนื่อง
"""

from django.db import models
from django.db.models import Q

from academics.models import Course
from common.models import TimeStampedModel
from content.uploads import content_upload_path


class Module(TimeStampedModel):
    """หน่วยการเรียน 1 หน่วยในรายวิชา — กล่องจัดกลุ่มเนื้อหา เรียงตาม order"""

    # รายวิชาที่หน่วยนี้อยู่ — ลบรายวิชา → ลบหน่วยทั้งหมดตาม (CASCADE)
    course = models.ForeignKey(
        Course, verbose_name="รายวิชา", on_delete=models.CASCADE, related_name="modules"
    )
    # ชื่อหน่วยการเรียน
    title = models.CharField("ชื่อหน่วยการเรียน", max_length=200)
    # คำอธิบายหน่วย (Markdown) — ไม่บังคับ
    description = models.TextField("คำอธิบาย", blank=True)
    # ลำดับในรายวิชา (ไม่ unique — จัดลำดับใหม่ทั้งรายการใน transaction เดียว ตาม §1)
    order = models.PositiveIntegerField("ลำดับ", default=0)
    # True = ผู้เรียนเห็น ; หน่วยใหม่เริ่มที่ยังไม่เผยแพร่
    is_published = models.BooleanField("เผยแพร่แล้ว", default=False)

    class Meta:
        verbose_name = "หน่วยการเรียน"
        verbose_name_plural = "หน่วยการเรียน"
        # เรียงตามลำดับที่ผู้สอนจัด ; ลำดับเท่ากันใช้ลำดับที่สร้าง
        ordering = ("order", "id")
        # หน้ารายวิชาดึงหน่วยของวิชาเดียวเรียงตามลำดับเสมอ (§11 "Index ที่ต้องเพิ่ม")
        indexes = [models.Index(fields=["course", "order"], name="content_module_course_order")]

    def __str__(self) -> str:
        # ใช้ใน /admin/ และ AuditLog.object_repr
        return self.title


class Content(TimeStampedModel):
    """เนื้อหา 1 ชิ้นในหน่วยการเรียน — 1 ชิ้น = 1 ไฟล์หลัก (หลายไฟล์ = หลายชิ้น)"""

    class Kind(models.TextChoices):
        """ชนิดเนื้อหา (ชื่อ field ตามสเปกคือ content_type)"""

        TEXT = "text", "ข้อความ"
        FILE = "file", "เอกสาร"
        IMAGE = "image", "รูปภาพ"
        VIDEO = "video", "วิดีโอ"
        AUDIO = "audio", "เสียง"
        LINK = "link", "ลิงก์"

    # หน่วยการเรียนที่เนื้อหานี้อยู่ — ลบหน่วย → ลบเนื้อหาตาม (CASCADE)
    module = models.ForeignKey(
        Module, verbose_name="หน่วยการเรียน", on_delete=models.CASCADE, related_name="contents"
    )
    # ชื่อหัวข้อ (อัปโหลดไฟล์แล้วไม่กรอก → API ตั้งจากชื่อไฟล์)
    title = models.CharField("ชื่อหัวข้อ", max_length=200)
    # ชนิดเนื้อหา — ระบบตั้งเองจากไฟล์ / ลิงก์ และเปลี่ยนภายหลังไม่ได้ (ตรวจในชั้น API)
    content_type = models.CharField("ชนิดเนื้อหา", max_length=10, choices=Kind.choices)
    # ข้อความ (Markdown): เนื้อความของชนิดข้อความ หรือคำอธิบายเหนือไฟล์ / ลิงก์ (ไม่บังคับ)
    body = models.TextField("เนื้อความ / คำอธิบาย", blank=True)
    # ลำดับในหน่วย (ไม่ unique — เหมือน Module.order)
    order = models.PositiveIntegerField("ลำดับ", default=0)
    # True = ผู้เรียนเห็น ; เนื้อหาใหม่เริ่มที่ยังไม่เผยแพร่
    is_published = models.BooleanField("เผยแพร่แล้ว", default=False)
    # ตำแหน่งไฟล์บนที่เก็บไฟล์ (ไม่เก็บลิงก์เต็ม — ระบบสร้างลิงก์ตอนเรียกใช้) ; ว่าง = ไม่มีไฟล์
    file_url = models.FileField("ไฟล์", upload_to=content_upload_path, max_length=255, blank=True)
    # ชื่อไฟล์เดิมที่อาจารย์อัปโหลด — ใช้ตั้งชื่อตอนดาวน์โหลด (ชื่อบนที่เก็บไฟล์เป็นชื่อสุ่ม)
    file_name = models.CharField("ชื่อไฟล์เดิม", max_length=255, blank=True)
    # ขนาดไฟล์ (ไบต์) ; NULL = ไม่มีไฟล์
    file_size = models.PositiveBigIntegerField("ขนาดไฟล์ (ไบต์)", null=True, blank=True)
    # ชนิดไฟล์ เช่น application/pdf (ตั้งจากเนื้อไฟล์จริงในขั้น 4.3)
    mime_type = models.CharField("ชนิดไฟล์ (MIME)", max_length=100, blank=True)
    # ลิงก์ภายนอก: ชนิดลิงก์ หรือวิดีโอจาก YouTube
    external_url = models.URLField("ลิงก์ภายนอก", max_length=500, blank=True)
    # ให้ผู้เรียนดาวน์โหลดไฟล์ได้ไหม (กฑ2) — ใช้กับเนื้อหาที่มีไฟล์ ; ปิด = ไม่ส่งลิงก์ดาวน์โหลดให้ผู้เรียน
    allow_download = models.BooleanField("ให้ผู้เรียนดาวน์โหลดได้", default=True)

    class Meta:
        verbose_name = "เนื้อหา"
        verbose_name_plural = "เนื้อหา"
        ordering = ("order", "id")
        # หน่วยที่เปิดดึงเนื้อหาของหน่วยเดียวเรียงตามลำดับเสมอ (§11 "Index ที่ต้องเพิ่ม")
        indexes = [models.Index(fields=["module", "order"], name="content_content_module_order")]
        constraints = [
            models.CheckConstraint(
                # เขียนค่าตรง ๆ เพราะใน Meta เรียก Kind ของคลาสนอกไม่ได้ (ต้องตรงกับ Kind ด้านบน)
                condition=Q(content_type__in=["text", "file", "image", "video", "audio", "link"]),
                name="content_content_type_valid",
            ),
            # ข้อมูลต้องตรงกับชนิด (has_file / has_link ด้านล่าง)
            models.CheckConstraint(
                condition=(
                    (Q(content_type="text") & Q(file_url="") & Q(external_url=""))
                    | (Q(content_type="link") & Q(file_url="") & Q(external_url__gt=""))
                    | (
                        Q(content_type__in=["file", "image", "audio"])
                        & Q(file_url__gt="")
                        & Q(external_url="")
                    )
                    | (
                        Q(content_type="video")
                        & (
                            (Q(file_url__gt="") & Q(external_url=""))
                            | (Q(file_url="") & Q(external_url__gt=""))
                        )
                    )
                ),
                name="content_content_fields_match_type",
            ),
            # มีไฟล์ ⇔ มีชื่อไฟล์เดิม + ขนาด + ชนิดไฟล์ ; ไม่มีไฟล์ = ข้อมูลไฟล์ว่างทั้งหมด
            # (ชนิดไฟล์บังคับด้วย เพราะหน้าเว็บใช้เลือกตัวแสดงผล เช่น เล่นวิดีโอ / เปิด PDF — PR แก้หลังขั้น 4.2)
            models.CheckConstraint(
                condition=(
                    Q(file_url="", file_name="", file_size__isnull=True, mime_type="")
                    | Q(
                        file_url__gt="",
                        file_name__gt="",
                        file_size__isnull=False,
                        mime_type__gt="",
                    )
                ),
                name="content_content_file_metadata",
            ),
        ]

    def __str__(self) -> str:
        # ใช้ใน /admin/ และ AuditLog.object_repr
        return self.title

    @property
    def has_file(self) -> bool:
        """มีไฟล์บนที่เก็บไฟล์ไหม (เอกสาร / รูป / เสียง / วิดีโอที่อัปโหลด)"""
        return bool(self.file_url)
