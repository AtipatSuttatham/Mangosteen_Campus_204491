"""
หน้าดูการลงทะเบียนใน Django admin (/admin/enrollment/enrollment/) — สำหรับนักพัฒนาตรวจข้อมูล
**ดูได้อย่างเดียว**: การเพิ่ม/ถอนผู้เรียนต้องผ่าน API (ขั้น 3.4) ซึ่งตรวจสิทธิ์และจด AuditLog
"""

from django.contrib import admin
from django.http import HttpRequest

from enrollment.models import Enrollment


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    """รายการการลงทะเบียน กรองตามสถานะ ค้นหาจากรหัสวิชา อีเมล หรือรหัสนักศึกษา"""

    # คอลัมน์ในตารางรายการ
    list_display = ("course", "student", "status", "enrolled_by", "enrolled_at", "dropped_at")
    # ตัวกรองด้านขวา
    list_filter = ("status", "course__academic_year", "course__semester")
    # ช่องค้นหา
    search_fields = (
        "course__code",
        "course__name",
        "student__email",
        "student__student_or_staff_id",
    )
    # โหลดรายวิชา ผู้เรียน และผู้เพิ่มมาพร้อมกัน (ลดจำนวนคำสั่ง SQL)
    list_select_related = ("course", "student", "enrolled_by")
    # หน้ารายละเอียด: แสดงทุกช่องแบบอ่านอย่างเดียว
    fields = (
        "course",
        "student",
        "status",
        "enrolled_by",
        "enrolled_at",
        "dropped_at",
        "created_at",
        "updated_at",
    )
    readonly_fields = fields

    # --- ปิดการเพิ่ม/แก้/ลบ (ดูได้อย่างเดียว) ---
    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Enrollment | None = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Enrollment | None = None) -> bool:
        return False
