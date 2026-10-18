"""
ตัวแปลง/ตรวจข้อมูล (serializer) ของ API รายวิชา (ขั้น 3.3) — อ้างอิง docs/api.md §8

- CourseSerializer: ข้อมูลเต็มที่ผู้สอนเจ้าของวิชา / ผู้ดูแลระบบเห็น
- StudentCourseSerializer: ข้อมูลหัวรายวิชาที่ผู้เรียนเห็น (ไม่มีรหัสเข้าร่วม / จำนวนผู้เรียน)
- CourseWriteSerializer: ตรวจข้อมูลตอนสร้าง / แก้ไขวิชา
- AdminCourseFilterSerializer: ตัวกรองของหน้าจัดการรายวิชา (ผู้ดูแลระบบ)
"""

import re

from rest_framework import serializers

from academics.models import MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR, Course
from accounts.models import User


class CourseTeacherSerializer(serializers.ModelSerializer):
    """ผู้สอนของวิชา (แสดงชื่อ + ถูกระงับไหม — หน้าผู้ดูแลระบบแสดง "บัญชีผู้สอนถูกระงับ")"""

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "is_active"]
        read_only_fields = fields


class StudentCourseSerializer(serializers.ModelSerializer):
    """
    ข้อมูลรายวิชาที่ผู้เรียนเห็น (หน้า "รายวิชาของฉัน" + หัวหน้ารายวิชา)
    ไม่มีรหัสเข้าร่วม / จำนวนผู้เรียน / สถานะเผยแพร่ (ผู้เรียนเห็นเฉพาะวิชาที่เผยแพร่แล้วอยู่แล้ว)
    """

    teacher = CourseTeacherSerializer(read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "academic_year",
            "semester",
            "code",
            "name",
            "description",
            "teacher",
            # True = ปิดแล้ว ดูย้อนหลังได้อย่างเดียว
            "is_closed",
        ]
        read_only_fields = fields


class CourseSerializer(StudentCourseSerializer):
    """
    ข้อมูลรายวิชาเต็มที่ผู้สอนเจ้าของวิชา / ผู้ดูแลระบบเห็น
    ช่องคำนวณมาจาก academics.access.with_stats() — ถ้าไม่ได้เติมไว้จะคำนวณจากฐานข้อมูลแทน
    """

    # จำนวนผู้เรียนที่กำลังเรียน
    student_count = serializers.SerializerMethodField()
    # ลบวิชานี้ได้ไหม (ยังไม่เผยแพร่ + ไม่ปิด + ไม่เคยมีผู้เรียน) — หน้าจอใช้ตัดสินว่าจะแสดงปุ่ม "ลบ"
    can_delete = serializers.SerializerMethodField()
    # เวลา / ผู้ปิดรายวิชาครั้งล่าสุด (เฉพาะตอนปิดอยู่ ; อ่านจาก AuditLog close_course)
    closed_at = serializers.SerializerMethodField()
    closed_by = serializers.SerializerMethodField()

    class Meta(StudentCourseSerializer.Meta):
        fields = [
            *StudentCourseSerializer.Meta.fields,
            "is_published",
            "join_code_enabled",
            "join_code",
            "student_count",
            "can_delete",
            "closed_at",
            "closed_by",
            "created_at",
        ]
        read_only_fields = fields

    def get_student_count(self, course: Course) -> int:
        count = getattr(course, "active_count", None)
        if count is None:
            count = course.enrollments.filter(status="active").count()
        return count

    def get_can_delete(self, course: Course) -> bool:
        if course.is_published or course.is_closed:
            return False
        total = getattr(course, "enrollment_total", None)
        if total is None:
            total = course.enrollments.count()
        return total == 0

    def get_closed_at(self, course: Course):
        closed_at = getattr(course, "closed_at", None)
        if not course.is_closed or closed_at is None:
            return None
        return serializers.DateTimeField().to_representation(closed_at)

    def get_closed_by(self, course: Course) -> str | None:
        if not course.is_closed or getattr(course, "closed_at", None) is None:
            return None
        # ชื่อผู้ปิด (บัญชีผู้ปิดถูกลบ → ไม่มีชื่อ = null)
        parts = [getattr(course, "closed_by_first", None), getattr(course, "closed_by_last", None)]
        name = " ".join(part for part in parts if part)
        return name or None


class CourseWriteSerializer(serializers.ModelSerializer):
    """
    ตรวจข้อมูลรายวิชาตอนสร้าง (POST) / แก้ไข (PATCH ส่งเฉพาะช่องที่แก้ก็ได้)

    - academic_year: 2500–2700 → นอกช่วงได้ {"academic_year": ["min_value" | "max_value"]}
    - semester: 1 / 2 / 3 → อื่น ๆ ได้ "invalid_choice"
    - code / name: ห้ามว่าง (ตัดช่องว่างหัว-ท้าย) ; description ว่างได้
    - code ซ้ำกับวิชาอื่นในปี + ภาคเดียวกัน → {"code": ["course_code_duplicate"]}
    - teacher: รหัสผู้ใช้ — ต้องเป็นบัญชีผู้สอนที่ใช้งานได้ → อื่น ๆ ได้ "teacher_not_assignable"
      (ใครส่งช่องนี้ได้ ตัดสินใน views.py: ผู้ดูแลระบบเท่านั้น)
    """

    academic_year = serializers.IntegerField(
        min_value=MIN_ACADEMIC_YEAR, max_value=MAX_ACADEMIC_YEAR
    )
    teacher = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)

    class Meta:
        model = Course
        fields = ["academic_year", "semester", "code", "name", "description", "teacher"]
        extra_kwargs = {"description": {"required": False}}
        # ปิดตัวตรวจ "ห้ามซ้ำ" อัตโนมัติของ DRF — ตรวจเองใน validate() เพื่อได้รหัส course_code_duplicate
        validators: list = []

    def validate_teacher(self, teacher: User) -> User:
        if teacher.role != User.Role.TEACHER or not teacher.is_active:
            raise serializers.ValidationError(
                "Only active teacher accounts can teach a course.", code="teacher_not_assignable"
            )
        return teacher

    def validate(self, attrs: dict) -> dict:
        # ค่าหลังแก้ = ค่าที่ส่งมา หรือค่าเดิมของวิชา (กรณี PATCH ส่งมาไม่ครบ)
        current = self.instance
        year = attrs.get("academic_year", getattr(current, "academic_year", None))
        semester = attrs.get("semester", getattr(current, "semester", None))
        code = attrs.get("code", getattr(current, "code", None))
        duplicates = Course.objects.filter(academic_year=year, semester=semester, code=code)
        if current is not None:
            duplicates = duplicates.exclude(pk=current.pk)
        if duplicates.exists():
            raise course_code_duplicate_error()
        return attrs


def course_code_duplicate_error() -> serializers.ValidationError:
    """error รายช่อง "รหัสวิชานี้มีอยู่แล้วในภาคเรียนนี้" (ใช้ทั้งตอนตรวจ และตอนฐานข้อมูลปฏิเสธ)"""
    return serializers.ValidationError(
        {
            "code": [
                serializers.ErrorDetail(
                    "This course code already exists in this term.", code="course_code_duplicate"
                )
            ]
        }
    )


# รูปแบบตัวกรองภาคเรียน "ปี-ภาค" เช่น 2569-1
TERM_PATTERN = re.compile(r"^(\d{4})-([123])$")


class AdminCourseFilterSerializer(serializers.Serializer):
    """
    ตัวกรองของหน้าจัดการรายวิชา: GET /api/v1/admin/courses/?search=&term=&teacher=&status=&page=
    ทุกตัวไม่บังคับ ; ค่าผิดรูปแบบ → 400 validation_error
    """

    # คำค้น: รหัสวิชา หรือชื่อวิชา (ไม่สนตัวพิมพ์)
    search = serializers.CharField(required=False, allow_blank=True, max_length=100)
    # ภาคเรียน "ปี-ภาค" เช่น 2569-1
    term = serializers.RegexField(TERM_PATTERN, required=False)
    # รหัสผู้ใช้ของผู้สอน
    teacher = serializers.IntegerField(required=False, min_value=1)
    # สถานะ: draft = ยังไม่เผยแพร่, published = เผยแพร่แล้ว, closed = ปิดแล้ว
    status = serializers.ChoiceField(choices=["draft", "published", "closed"], required=False)
