"""
หน้าดูบันทึกการใช้งานใน Django admin (/admin/audit/auditlog/) — สำหรับนักพัฒนาตรวจข้อมูล
**ดูได้อย่างเดียว**: ไม่มีปุ่มเพิ่ม แก้ไข หรือลบ เพราะบันทึกเป็นหลักฐาน
(หน้าประวัติการใช้งานของผู้ดูแลระบบตัวจริงทำในก้อน 9 — UC-06)
"""

import json

from django.contrib import admin
from django.http import HttpRequest
from django.utils.html import format_html

from audit.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """รายการบันทึก ล่าสุดขึ้นก่อน กรองตามการกระทำ/ชนิดข้อมูล ค้นหาจากชื่อข้อมูลหรืออีเมลผู้กระทำ"""

    # คอลัมน์ในตารางรายการ
    list_display = ("created_at", "actor", "action", "content_type", "object_repr")
    # ตัวกรองด้านขวา
    list_filter = ("action", "content_type", "created_at")
    # ช่องค้นหา
    search_fields = ("object_repr", "object_id", "actor__email")
    # ลิงก์วันที่ด้านบน (เลือกปี/เดือน/วัน)
    date_hierarchy = "created_at"
    # โหลดผู้กระทำและชนิดข้อมูลมาพร้อมกัน (ลดจำนวนคำสั่ง SQL)
    list_select_related = ("actor", "content_type")
    # หน้ารายละเอียด: แสดงทุกช่อง + สิ่งที่เปลี่ยนแบบจัดบรรทัดอ่านง่าย
    fields = (
        "created_at",
        "actor",
        "action",
        "content_type",
        "object_id",
        "object_repr",
        "changes_pretty",
    )
    readonly_fields = fields

    @admin.display(description="สิ่งที่เปลี่ยน")
    def changes_pretty(self, obj: AuditLog) -> str:
        """แสดง changes เป็น JSON ที่จัดบรรทัดแล้ว (ภาษาไทยอ่านได้ ไม่เป็นรหัส \\uXXXX)"""
        if obj.changes is None:
            return "-"
        text = json.dumps(obj.changes, ensure_ascii=False, indent=2, default=str)
        return format_html("<pre style='margin:0'>{}</pre>", text)

    # --- ปิดการเพิ่ม/แก้/ลบ (ดูได้อย่างเดียว) ---
    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: AuditLog | None = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: AuditLog | None = None) -> bool:
        return False
