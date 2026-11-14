"""
ตั้งค่า app "content" — หน่วยการเรียน (Module) และเนื้อหา (Content) ในรายวิชา (ก้อน 4)
"""

from django.apps import AppConfig


class ContentConfig(AppConfig):
    """ข้อมูลประจำ app content ที่ Django ใช้ตอนโหลด app"""

    # ชนิด primary key เริ่มต้นของตารางใน app นี้ = BigAutoField (ตาม docs/database.md §1)
    default_auto_field = "django.db.models.BigAutoField"
    # ชื่อ app ที่ใช้อ้างอิงใน INSTALLED_APPS
    name = "content"
    # ชื่อกลุ่มที่แสดงในหน้า Django admin
    verbose_name = "เนื้อหารายวิชา"

    def ready(self) -> None:
        # ผูกตัวลบไฟล์อัตโนมัติเมื่อแถว Content ถูกลบ (signals.py) — import ตรงนี้ตามแบบของ Django
        from content import signals  # noqa: F401
