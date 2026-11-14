"""
หน้าดูหน่วยการเรียนและเนื้อหาใน Django admin (/admin/content/…) — สำหรับนักพัฒนาตรวจข้อมูล
**ดูได้อย่างเดียว**: การสร้าง/แก้/ลบต้องผ่าน API (ขั้น 4.3) ซึ่งตรวจสิทธิ์ ตรวจไฟล์ และจด AuditLog
(แบบเดียวกับหน้า /admin/ ของรายวิชาและการลงทะเบียน)
"""

from django.contrib import admin
from django.http import HttpRequest

from content.models import Content, Module


class ReadOnlyAdmin(admin.ModelAdmin):
    """ปิดการเพิ่ม/แก้/ลบ — ทุกช่องในหน้ารายละเอียดเป็นแบบอ่านอย่างเดียว"""

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False


@admin.register(Module)
class ModuleAdmin(ReadOnlyAdmin):
    """รายการหน่วยการเรียน กรองตามสถานะ ค้นหาจากชื่อหน่วยหรือรหัสวิชา"""

    list_display = ("title", "course", "order", "is_published")
    list_filter = ("is_published", "course__academic_year", "course__semester")
    search_fields = ("title", "course__code", "course__name")
    list_select_related = ("course",)
    fields = ("course", "title", "description", "order", "is_published", "created_at", "updated_at")
    readonly_fields = fields


@admin.register(Content)
class ContentAdmin(ReadOnlyAdmin):
    """รายการเนื้อหา กรองตามชนิด / สถานะ ค้นหาจากหัวข้อ ชื่อไฟล์ หรือรหัสวิชา"""

    list_display = ("title", "content_type", "module", "order", "is_published", "file_name")
    list_filter = ("content_type", "is_published", "allow_download")
    search_fields = ("title", "file_name", "module__title", "module__course__code")
    list_select_related = ("module",)
    fields = (
        "module",
        "title",
        "content_type",
        "body",
        "order",
        "is_published",
        "file_url",
        "file_name",
        "file_size",
        "mime_type",
        "external_url",
        "allow_download",
        "created_at",
        "updated_at",
    )
    readonly_fields = fields
