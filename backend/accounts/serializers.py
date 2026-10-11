"""
ตัวแปลง/ตรวจข้อมูล (serializer) ของ API บัญชีผู้ใช้
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User, normalize_email


class LoginSerializer(serializers.Serializer):
    """
    ข้อมูลที่ส่งมาตอนเข้าสู่ระบบ: POST /api/v1/auth/login/

    - identifier: อีเมล หรือ รหัสนักศึกษา/รหัสพนักงาน (ช่องเดียวกัน — มี "@" = อีเมล)
    - password:   รหัสผ่าน (ไม่ตัดช่องว่าง — ช่องว่างเป็นส่วนหนึ่งของรหัสได้)
    """

    identifier = serializers.CharField(max_length=254)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class MeSerializer(serializers.ModelSerializer):
    """
    ข้อมูลของผู้ใช้ที่เข้าสู่ระบบอยู่ — ส่งกลับตอน login / แลก token / GET-PATCH me / รูปประจำตัว
    (ไม่มีข้อมูลภายใน เช่น รหัสผ่าน, is_staff)
    """

    # ลิงก์รูปประจำตัว — ให้ระบบ storage สร้างจากตำแหน่งไฟล์ (ช่วงพัฒนา "/media/avatars/…" ;
    # ตอนใช้ cloud เป็นลิงก์ของ cloud) ; ไม่ต่อชื่อเว็บไว้ข้างหน้า เพื่อให้โหลดผ่านเว็บเดียวกันเสมอ
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
            # ลิงก์รูปประจำตัว (ระบบสร้างจากตำแหน่งไฟล์) ; ไม่มีรูป = null
            "avatar_url",
        ]
        read_only_fields = fields

    def get_avatar_url(self, user: User) -> str | None:
        """ลิงก์รูปประจำตัว ; ไม่มีรูป → null (หน้าเว็บแสดงตัวอักษรย่อแทน)"""
        return user.avatar_url.url if user.avatar_url else None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    แก้ข้อมูลส่วนตัวของตัวเอง: PATCH /api/v1/auth/me/  (UC-02 — ส่งเฉพาะช่องที่แก้ก็ได้)

    - first_name / last_name: ห้ามว่าง (ตัดช่องว่างหัว-ท้าย)
    - email: ตรวจรูปแบบ, เก็บเป็นตัวพิมพ์เล็ก, ห้ามซ้ำกับคนอื่น (ไม่สนตัวพิมพ์) — ไม่ต้องกรอกรหัสผ่าน
    - ช่องอื่น (role, student_or_staff_id ฯลฯ) ไม่อยู่ในรายการ → ส่งมาก็ไม่มีผล (แก้เองไม่ได้)
    """

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email"]
        # ปิดตัวตรวจซ้ำอัตโนมัติของอีเมล (เทียบแบบสนตัวพิมพ์) — ตรวจเองใน validate_email แทน
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, value: str) -> str:
        """จัดรูปอีเมลเป็นตัวพิมพ์เล็ก แล้วตรวจว่าไม่ซ้ำกับบัญชีอื่น (บัญชีตัวเองไม่นับ)"""
        email = normalize_email(value)
        if User.objects.filter(email=email).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This email is already in use.", code="unique")
        return email


class PasswordChangeSerializer(serializers.Serializer):
    """
    เปลี่ยนรหัสผ่านของตัวเอง: POST /api/v1/auth/me/password/  (UC-02)

    - current_password: ต้องตรงกับรหัสเดิม → ไม่ตรง = รหัสช่อง password_incorrect
    - new_password: ต้องผ่านกฎมาตรฐานของ Django 4 ข้อ (settings.AUTH_PASSWORD_VALIDATORS)
      → ไม่ผ่าน = รหัสของกฎ เช่น password_too_short, password_too_common,
        password_entirely_numeric, password_too_similar (ไม่ผ่านหลายข้อ → ได้หลายรหัส)
    รหัสผ่านไม่ตัดช่องว่าง (ช่องว่างเป็นส่วนหนึ่งของรหัสได้ — เหมือนตอน login)
    ต้องส่ง context={"user": ผู้ใช้ที่เข้าสู่ระบบอยู่}
    """

    current_password = serializers.CharField(max_length=128, trim_whitespace=False)
    new_password = serializers.CharField(max_length=128, trim_whitespace=False)

    def validate_current_password(self, value: str) -> str:
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError(
                "Current password is incorrect.", code="password_incorrect"
            )
        return value

    def validate_new_password(self, value: str) -> str:
        try:
            # ส่งผู้ใช้ไปด้วย → กฎ "ไม่คล้ายชื่อ/อีเมล" เทียบกับข้อมูลของคนนี้ได้
            validate_password(value, self.context["user"])
        except DjangoValidationError as error:
            # แปลงเป็น error ของ DRF โดยคงรหัสของแต่ละกฎไว้ (frontend แปลเป็นข้อความไทย)
            raise serializers.ValidationError(
                [
                    serializers.ErrorDetail(" ".join(item.messages), code=item.code)
                    for item in error.error_list
                ]
            ) from error
        return value


class AvatarUploadSerializer(serializers.Serializer):
    """
    อัปโหลดรูปประจำตัว: POST /api/v1/auth/me/avatar/  (multipart, ช่องชื่อ avatar)
    ที่นี่ตรวจแค่ว่ามีไฟล์มา — การตรวจชนิด/ขนาด/ย่อรูปอยู่ใน accounts/avatars.py
    """

    avatar = serializers.FileField(allow_empty_file=False)
