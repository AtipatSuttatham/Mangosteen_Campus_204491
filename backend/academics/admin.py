"""
หน้าดูรายวิชาใน Django admin (/admin/academics/course/) — สำหรับนักพัฒนาตรวจข้อมูล
**ดูได้อย่างเดียว**: การสร้าง/แก้/ลบรายวิชาต้องผ่าน API (ขั้น 3.3) ซึ่งตรวจสิทธิ์และจด AuditLog
ถ้าแก้ผ่านหน้านี้ได้ การเปลี่ยนแปลงจะไม่ถูกบันทึกในประวัติการใช้งาน (CLAUDE.md "การตัดสินใจก้อน 3")
"""

from django.contrib import admin
from django.http import HttpRequest

from academics.models import Course


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    """รายการรายวิชา ภาคล่าสุดก่อน กรองตามภาค/สถานะ ค้นหาจากรหัส ชื่อ หรืออีเมลผู้สอน"""

    # คอลัมน์ในตารางรายการ
    list_display = (
        "code",
        "name",
        "academic_year",
        "semester",
        "teacher",
        "is_published",
        "is_closed",
        "join_code_enabled",
    )
    # ตัวกรองด้านขวา
    list_filter = ("academic_year", "semester", "is_published", "is_closed")
    # ช่องค้นหา
    search_fields = ("code", "name", "teacher__email", "join_code")
    # โหลดผู้สอนมาพร้อมกัน (ลดจำนวนคำสั่ง SQL)
    list_select_related = ("teacher",)
    # หน้ารายละเอียด: แสดงทุกช่องแบบอ่านอย่างเดียว
    fields = (
        "academic_year",
        "semester",
        "code",
        "name",
        "description",
        "teacher",
        "is_published",
        "is_closed",
        "join_code_enabled",
        "join_code",
        "created_by",
        "created_at",
        "updated_at",
    )
    readonly_fields = fields

    # --- ปิดการเพิ่ม/แก้/ลบ (ดูได้อย่างเดียว) ---
    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Course | None = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Course | None = None) -> bool:
        return False
