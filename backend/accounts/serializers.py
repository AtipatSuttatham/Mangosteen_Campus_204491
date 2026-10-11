"""
ตัวแปลง/ตรวจข้อมูล (serializer) ของ API บัญชีผู้ใช้
"""

from rest_framework import serializers

from accounts.models import User


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
    ข้อมูลของผู้ใช้ที่เข้าสู่ระบบอยู่ — ส่งกลับตอน login / แลก token / GET me
    (ไม่มีข้อมูลภายใน เช่น รหัสผ่าน, is_staff)
    """

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
