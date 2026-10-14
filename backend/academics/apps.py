"""
ตั้งค่า app "academics" — รายวิชา (Course) ของแต่ละภาคการศึกษา (ก้อน 3)
"""

from django.apps import AppConfig


class AcademicsConfig(AppConfig):
    """ข้อมูลประจำ app academics ที่ Django ใช้ตอนโหลด app"""

    # ชนิด primary key เริ่มต้นของตารางใน app นี้ = BigAutoField (ตาม docs/database.md §1)
    default_auto_field = "django.db.models.BigAutoField"
    # ชื่อ app ที่ใช้อ้างอิงใน INSTALLED_APPS
    name = "academics"
    # ชื่อกลุ่มที่แสดงในหน้า Django admin
    verbose_name = "รายวิชา"
