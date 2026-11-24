"""
model กลางที่ app อื่นนำไปสืบทอด (ไม่ใช่ตารางจริงในฐานข้อมูล)
อ้างอิง: docs/database.md §1 "Abstract models"
"""

from django.db import models


class TimeStampedModel(models.Model):
    """
    ต้นแบบ (abstract) ที่เพิ่มเวลาสร้าง/เวลาแก้ไขล่าสุดให้ทุกตาราง

    ทุกตารางในระบบสืบทอดจากคลาสนี้ ยกเว้น AuditLog ที่มีเฉพาะ created_at
    (ตาม docs/database.md §1)
    """

    # ป้ายชื่อของ field ทุกตัว = ชื่อ field เอง (หน้า /admin/ แสดงตรงกับ docs/database.md — กติกา §1)
    # เวลาที่สร้างแถวนี้ — ระบบใส่ให้อัตโนมัติครั้งเดียวตอนสร้าง (เก็บเป็น UTC)
    created_at = models.DateTimeField("created_at", auto_now_add=True)
    # เวลาที่แก้ไขแถวนี้ล่าสุด — ระบบอัปเดตให้อัตโนมัติทุกครั้งที่บันทึก (เก็บเป็น UTC)
    updated_at = models.DateTimeField("updated_at", auto_now=True)

    class Meta:
        # abstract = True → ไม่สร้างตารางของคลาสนี้เอง แค่ส่ง field ให้คลาสลูก
        abstract = True
