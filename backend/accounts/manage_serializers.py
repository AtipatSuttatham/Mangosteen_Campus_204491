"""
ตัวแปลง/ตรวจข้อมูล (serializer) ของ API จัดการบัญชีผู้ใช้สำหรับผู้ดูแลระบบ (UC-04 — ขั้น 2.3)
ที่อยู่ทั้งหมดอยู่ใต้ /api/v1/admin/users/ (accounts/manage_urls.py) — อ้างอิง docs/api.md §7
"""

from rest_framework import serializers

from accounts.models import User


class AdminUserSerializer(serializers.ModelSerializer):
    """
    ข้อมูลบัญชี 1 คนที่ผู้ดูแลระบบเห็น (รายการ / รายละเอียด / ผลหลังเพิ่ม-แก้-ระงับ)
    ไม่มีข้อมูลภายใน เช่น รหัสผ่าน, is_staff, is_superuser
    """

    # ลิงก์รูปประจำตัว (ระบบสร้างจากตำแหน่งไฟล์) ; ไม่มีรูป = null — แบบเดียวกับ MeSerializer
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "student_or_staff_id",
            "role",
            "first_name",
            "last_name",
            # False = ถูกระงับ
            "is_active",
            "avatar_url",
            # วันที่สร้างบัญชี / เข้าสู่ระบบล่าสุด (ยังไม่เคย = null) — เวลา UTC
            "date_joined",
            "last_login",
        ]
        read_only_fields = fields

    def get_avatar_url(self, user: User) -> str | None:
        return user.avatar_url.url if user.avatar_url else None


class AdminUserFilterSerializer(serializers.Serializer):
    """
    ตัวกรองของหน้ารายชื่อ: GET /api/v1/admin/users/?search=&role=&is_active=&page=
    ทุกตัวไม่บังคับ ; ค่าที่ไม่รู้จัก (เช่น role=boss) → 400 validation_error {"role": ["invalid_choice"]}
    """

    # คำค้น: ชื่อ / นามสกุล / ชื่อเต็ม / อีเมล / รหัส (ไม่สนตัวพิมพ์ ; ว่าง = ไม่กรอง)
    search = serializers.CharField(required=False, allow_blank=True, max_length=100)
    # บทบาท: admin / teacher / student
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    # สถานะ: "true" = ใช้งานได้, "false" = ถูกระงับ
    # (ใช้ ChoiceField ไม่ใช้ BooleanField เพราะ BooleanField ตีความ "ไม่ส่งมา" ใน query string เป็น false)
    is_active = serializers.ChoiceField(choices=["true", "false"], required=False)
