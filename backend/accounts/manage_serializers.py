"""
ตัวแปลง/ตรวจข้อมูล (serializer) ของ API จัดการบัญชีผู้ใช้สำหรับผู้ดูแลระบบ (UC-04 — ขั้น 2.3)
ที่อยู่ทั้งหมดอยู่ใต้ /api/v1/admin/users/ (accounts/manage_urls.py) — อ้างอิง docs/api.md §7
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User, normalize_email, normalize_student_or_staff_id


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


def _password_errors(error: DjangoValidationError) -> serializers.ValidationError:
    """แปลง error ของกฎรหัสผ่าน Django เป็น error ของ DRF โดยคงรหัสของแต่ละกฎไว้ (เหมือนขั้น 1.7)"""
    return serializers.ValidationError(
        [
            serializers.ErrorDetail(" ".join(item.messages), code=item.code)
            for item in error.error_list
        ]
    )


class AdminUserWriteSerializer(serializers.ModelSerializer):
    """
    ตรวจข้อมูลบัญชีที่ผู้ดูแลระบบกรอก — ใช้ตอนแก้ไข (PATCH ส่งเฉพาะช่องที่แก้ก็ได้)
    และเป็นฐานของตัวเพิ่มบัญชี

    - first_name / last_name: ห้ามว่าง (ตัดช่องว่างหัว-ท้าย)
    - email: ตรวจรูปแบบ, เก็บตัวพิมพ์เล็ก, ห้ามซ้ำกับบัญชีอื่น (ไม่สนตัวพิมพ์) → {"email": ["unique"]}
    - student_or_staff_id: ไม่บังคับ (ว่าง = ไม่มีรหัส), ห้ามซ้ำ → {"student_or_staff_id": ["unique"]}
    - role: admin / teacher / student
    ช่องอื่น (is_active, is_staff ฯลฯ) ไม่อยู่ในรายการ → ส่งมาก็ไม่มีผล
    (ระงับ/เปิดใช้งานมีที่อยู่ของตัวเอง ; is_staff ใช้กับ Django admin เท่านั้น ไม่ตั้งผ่าน API)
    """

    class Meta:
        model = User
        fields = ["email", "student_or_staff_id", "first_name", "last_name", "role"]
        extra_kwargs = {
            # ปิดตัวตรวจซ้ำอัตโนมัติ (เทียบก่อนจัดรูป) — ตรวจเองใน validate_* หลังจัดรูปแทน
            "email": {"validators": []},
            "student_or_staff_id": {"validators": [], "allow_null": True, "allow_blank": True},
        }

    def _others(self):
        """บัญชีอื่นทั้งหมด (ตอนแก้ไขไม่นับบัญชีที่กำลังแก้)"""
        users = User.objects.all()
        return users.exclude(pk=self.instance.pk) if self.instance else users

    def validate_email(self, value: str) -> str:
        email = normalize_email(value)
        if self._others().filter(email=email).exists():
            raise serializers.ValidationError("This email is already in use.", code="unique")
        return email

    def validate_student_or_staff_id(self, value: str | None) -> str | None:
        # ตัดช่องว่าง ; ว่าง → None (ไม่มีรหัส — หลายคนไม่มีรหัสได้โดยไม่ชนกัน)
        value = normalize_student_or_staff_id(value)
        if value and self._others().filter(student_or_staff_id=value).exists():
            raise serializers.ValidationError("This ID is already in use.", code="unique")
        return value


class AdminUserCreateSerializer(AdminUserWriteSerializer):
    """
    เพิ่มบัญชี: POST /api/v1/admin/users/  — ทุกช่องบังคับ ยกเว้น student_or_staff_id

    - password: รหัสผ่านชั่วคราวที่ผู้ดูแลระบบพิมพ์/สุ่ม (ไม่ตัดช่องว่าง) ต้องผ่านกฎ 4 ข้อของ Django
      โดยข้อ "ไม่คล้ายชื่อ/อีเมล" เทียบกับข้อมูลของบัญชีใหม่ → รหัสของกฎใต้ช่อง password
    """

    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)

    class Meta(AdminUserWriteSerializer.Meta):
        fields = [*AdminUserWriteSerializer.Meta.fields, "password"]

    def validate(self, attrs: dict) -> dict:
        # ตรวจรหัสผ่านหลังตรวจช่องอื่น เพื่อเทียบกับชื่อ/อีเมลของบัญชีใหม่ (ยังไม่บันทึก)
        candidate = User(**{name: value for name, value in attrs.items() if name != "password"})
        try:
            validate_password(attrs["password"], candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {"password": _password_errors(error).detail}
            ) from error
        return attrs
