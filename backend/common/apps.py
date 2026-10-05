"""
ตั้งค่า app "common" — ของใช้ร่วมกันทุก app (abstract model, endpoint ระดับระบบ)
"""

from django.apps import AppConfig


class CommonConfig(AppConfig):
    """ข้อมูลประจำ app common ที่ Django ใช้ตอนโหลด app"""

    # ชนิด primary key เริ่มต้นของตารางใน app นี้ = BigAutoField (ตาม docs/database.md §1)
    default_auto_field = "django.db.models.BigAutoField"
    # ชื่อ app ที่ใช้อ้างอิงใน INSTALLED_APPS
    name = "common"
