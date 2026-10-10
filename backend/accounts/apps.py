"""
ตั้งค่า app "accounts" — บัญชีผู้ใช้และการเข้าสู่ระบบ
"""

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """ข้อมูลประจำ app accounts ที่ Django ใช้ตอนโหลด app"""

    # ชนิด primary key เริ่มต้นของตารางใน app นี้ = BigAutoField (ตาม docs/database.md §1)
    default_auto_field = "django.db.models.BigAutoField"
    # ชื่อ app ที่ใช้อ้างอิงใน INSTALLED_APPS
    name = "accounts"
    # ชื่อกลุ่มที่แสดงในหน้า Django admin
    verbose_name = "บัญชีผู้ใช้"
