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


class AdminPasswordResetSerializer(serializers.Serializer):
    """
    รีเซ็ตรหัสผ่าน: POST /api/v1/admin/users/{id}/password/  {new_password}
    ต้องผ่านกฎ 4 ข้อ (ข้อ "ไม่คล้ายชื่อ/อีเมล" เทียบกับเจ้าของบัญชี) ; ต้องส่ง context={"user": เจ้าของบัญชี}
    """

    new_password = serializers.CharField(max_length=128, trim_whitespace=False)

    def validate_new_password(self, value: str) -> str:
        try:
            validate_password(value, self.context["user"])
        except DjangoValidationError as error:
            raise _password_errors(error) from error
        return value


class CsvUploadSerializer(serializers.Serializer):
    """
    ไฟล์ที่อัปโหลดเพื่อนำเข้าบัญชี (multipart ช่อง "file") — ขั้น 2.4
    ไม่ส่งไฟล์ → {"file": ["required"]} ; ไฟล์ว่างผ่านตรงนี้ แล้วไปตอบ csv_empty ในตัวอ่านไฟล์
    (ขนาด / การเข้ารหัส / หัวตาราง ตรวจใน accounts/csv_import.py)
    """

    file = serializers.FileField(allow_empty_file=True)


# ค่าในคอลัมน์ role ที่รับ (ไม่สนตัวพิมพ์ — ผู้ใช้เลือกข้อ 2.ก ขั้น 2.4: รับทั้งอังกฤษและไทย)
CSV_ROLE_ALIASES = {
    "teacher": User.Role.TEACHER,
    "ผู้สอน": User.Role.TEACHER,
    "student": User.Role.STUDENT,
    "ผู้เรียน": User.Role.STUDENT,
}
# ค่าที่หมายถึงผู้ดูแลระบบ → ผิดเสมอ (สร้างผู้ดูแลระบบจาก CSV ไม่ได้ — csv_admin_not_allowed)
CSV_ADMIN_ALIASES = {"admin", "ผู้ดูแลระบบ"}


def csv_role(value: str) -> str | None:
    """แปลงค่าในคอลัมน์ role เป็นบทบาทในระบบ (teacher / student) ; ไม่รู้จัก → None"""
    return CSV_ROLE_ALIASES.get(value.strip().lower())


class CsvRowSerializer(AdminUserWriteSerializer):
    """
    ตรวจข้อมูล 1 แถวของไฟล์ CSV — กติกาเดียวกับเพิ่มบัญชีทีละคน (ชื่อห้ามว่าง, รูปแบบอีเมล, ความยาว ฯลฯ)
    ต่างกันที่:
    - role: รับ teacher / student / ผู้สอน / ผู้เรียน ; admin → csv_admin_not_allowed ;
      ค่าอื่น → invalid_choice
    - ตรวจซ้ำกับบัญชีในระบบจากชุดข้อมูลที่โหลดไว้ครั้งเดียวทั้งไฟล์ (ไม่ถามฐานข้อมูลทีละแถว — 500 แถวก็เร็ว)
      ซ้ำในระบบ → unique ; ซ้ำกับแถวก่อนหน้าในไฟล์เดียวกัน → duplicate_in_file (จดแถวที่ซ้ำไว้ใน duplicate_of)

    context ที่ต้องส่ง (ใช้ร่วมกันทุกแถวของไฟล์):
        existing_emails / existing_ids : อีเมล / รหัสที่มีอยู่แล้วในระบบ
        seen_emails / seen_ids         : {ค่า: เลขแถวแรกที่ใช้ค่านี้} — ตัวตรวจเติมให้เอง
        row                            : เลขแถวของแถวนี้
    """

    # รับข้อความใด ๆ แล้วแปลงเองใน validate_role (ไม่ใช้ ChoiceField เพราะต้องรับค่าภาษาไทย)
    role = serializers.CharField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # {ชื่อคอลัมน์: เลขแถวก่อนหน้าที่ใช้ค่าเดียวกัน} — ใช้ประกอบรายงาน duplicate_in_file
        self.duplicate_of: dict[str, int] = {}

    def _check_duplicate(self, column: str, value: str, existing: set, seen: dict) -> None:
        """ซ้ำกับบัญชีในระบบ → unique ; ซ้ำกับแถวก่อนหน้าในไฟล์ → duplicate_in_file ; ไม่ซ้ำ → จดว่าแถวนี้ใช้แล้ว"""
        if value in existing:
            raise serializers.ValidationError("Already in use.", code="unique")
        if value in seen:
            self.duplicate_of[column] = seen[value]
            raise serializers.ValidationError("Duplicated in this file.", code="duplicate_in_file")
        seen[value] = self.context["row"]

    def validate_email(self, value: str) -> str:
        email = normalize_email(value)
        self._check_duplicate(
            "email", email, self.context["existing_emails"], self.context["seen_emails"]
        )
        return email

    def validate_student_or_staff_id(self, value: str | None) -> str | None:
        value = normalize_student_or_staff_id(value)
        if value:
            self._check_duplicate(
                "student_or_staff_id",
                value,
                self.context["existing_ids"],
                self.context["seen_ids"],
            )
        return value

    def validate_role(self, value: str) -> str:
        if value.strip().lower() in CSV_ADMIN_ALIASES:
            raise serializers.ValidationError(
                "Admins cannot be imported from CSV.", code="csv_admin_not_allowed"
            )
        role = csv_role(value)
        if role is None:
            raise serializers.ValidationError("Unknown role.", code="invalid_choice")
        return role
