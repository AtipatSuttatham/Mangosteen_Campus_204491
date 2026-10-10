"""
ลงทะเบียนตาราง User ในหน้า Django admin (/admin/)
ใช้สำหรับนักพัฒนาตรวจ/แก้ข้อมูลตอนพัฒนา — ผู้ดูแลระบบตัวจริงใช้หน้าจัดการบัญชีของระบบ (ก้อน 2)
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm

from accounts.models import User


class UserAddForm(BaseUserCreationForm):
    """
    ฟอร์มเพิ่มผู้ใช้ในหน้า /admin/ — ฟอร์มมาตรฐานของ Django ผูกกับตารางผู้ใช้เดิม (username)
    จึงต้องชี้ให้ใช้ตาราง User ของเรา ; บังคับตั้งรหัสผ่าน (ไม่มีตัวเลือก "ไม่ตั้งรหัสผ่าน")
    """

    class Meta:
        model = User
        fields = ("email",)


class UserEditForm(UserChangeForm):
    """ฟอร์มแก้ไขผู้ใช้ในหน้า /admin/ — ชี้ให้ใช้ตาราง User ของเรา"""

    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """
    หน้าจัดการผู้ใช้ใน /admin/ — ดัดแปลงจากหน้ามาตรฐานของ Django
    ให้ใช้อีเมล/รหัส/บทบาทแทน username
    """

    # ฟอร์มที่ใช้ตอนเพิ่ม / แก้ไขผู้ใช้
    add_form = UserAddForm
    form = UserEditForm

    # คอลัมน์ในตารางรายชื่อ
    list_display = (
        "email",
        "student_or_staff_id",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "last_login",
    )
    # ตัวกรองด้านขวา
    list_filter = ("role", "is_active", "is_staff")
    # ช่องค้นหา: อีเมล / รหัส / ชื่อ / นามสกุล
    search_fields = ("email", "student_or_staff_id", "first_name", "last_name")
    ordering = ("id",)
    # ช่องที่ดูได้อย่างเดียว (ระบบตั้งให้เอง)
    readonly_fields = ("last_login", "date_joined", "created_at", "updated_at")
    # เลือก "สร้างโดย" ด้วยการพิมพ์รหัสผู้ใช้ แทนรายการยาว ๆ
    raw_id_fields = ("created_by",)

    # หน้าแก้ไขผู้ใช้ — แบ่งเป็นกลุ่ม
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "ข้อมูลส่วนตัว",
            {"fields": ("student_or_staff_id", "first_name", "last_name", "avatar_url")},
        ),
        ("บทบาทและสถานะ", {"fields": ("role", "is_active", "created_by")}),
        (
            "สิทธิ์หน้า Django admin",
            {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("เวลา", {"fields": ("last_login", "date_joined", "created_at", "updated_at")}),
    )
    # หน้าเพิ่มผู้ใช้ใหม่ — password1/password2 = ช่องรหัสผ่าน + ยืนยันรหัสผ่าน
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "student_or_staff_id",
                    "first_name",
                    "last_name",
                    "role",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
