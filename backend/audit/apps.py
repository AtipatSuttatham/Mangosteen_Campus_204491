"""
ตั้งค่า app "audit" — บันทึกประวัติการกระทำ (AuditLog)
"""

from django.apps import AppConfig


class AuditConfig(AppConfig):
    """ข้อมูลประจำ app audit ที่ Django ใช้ตอนโหลด app"""

    # ชนิด primary key เริ่มต้นของตารางใน app นี้ = BigAutoField (ตาม docs/database.md §1)
    default_auto_field = "django.db.models.BigAutoField"
    # ชื่อ app ที่ใช้อ้างอิงใน INSTALLED_APPS
    name = "audit"
    # ชื่อกลุ่มที่แสดงในหน้า Django admin = ชื่อ app (ตรงกับคำนำหน้าชื่อตาราง เช่น accounts_user)
    # — กติกา docs/database.md §1 ; ตรวจโดย common/tests/test_admin_names.py
    verbose_name = "audit"
