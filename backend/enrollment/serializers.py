"""
ตัวแปลง/ตรวจข้อมูล (serializer) ของ API การลงทะเบียน (ขั้น 3.4) — อ้างอิง docs/api.md §9
"""

from rest_framework import serializers

from accounts.models import User
from enrollment.models import Enrollment


class EnrolledStudentSerializer(serializers.ModelSerializer):
    """ข้อมูลผู้เรียนในตารางแท็บผู้เรียน (is_active = false → หน้าจอแสดงป้าย "บัญชีถูกระงับ")"""

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "student_or_staff_id", "is_active"]
        read_only_fields = fields


class EnrollmentSerializer(serializers.ModelSerializer):
    """
    1 แถวในแท็บผู้เรียน
    method = วิธีเข้าร่วม ดูจากผู้เพิ่ม (ไม่มี field แยก): ไม่มีผู้เพิ่ม → "join_code",
    ผู้เพิ่มเป็นผู้ดูแลระบบ → "admin", อื่น ๆ → "teacher"
    """

    student = EnrolledStudentSerializer(read_only=True)
    method = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ["id", "student", "status", "method", "enrolled_at", "dropped_at"]
        read_only_fields = fields

    def get_method(self, enrollment: Enrollment) -> str:
        adder = enrollment.enrolled_by
        if adder is None:
            return "join_code"
        return "admin" if adder.role == User.Role.ADMIN else "teacher"


# จำนวนบรรทัดสูงสุดต่อการเพิ่ม 1 ครั้ง (เท่ากับเพดานนำเข้า CSV ของก้อน 2)
MAX_IDENTIFIERS = 500


class AddStudentsSerializer(serializers.Serializer):
    """
    รายการผู้เรียนที่จะเพิ่ม: {"identifiers": ["670510118", "a@example.com", ...]}
    - 1–500 บรรทัด ; แต่ละบรรทัดเป็นรหัสนักศึกษาหรืออีเมล (บรรทัดว่างข้ามได้)
    - เกิน 500 → {"identifiers": ["max_length"]} ; ว่างทั้งหมด → {"identifiers": ["blank"]}
    """

    identifiers = serializers.ListField(
        child=serializers.CharField(allow_blank=True, max_length=254),
        min_length=1,
        max_length=MAX_IDENTIFIERS,
    )

    def validate_identifiers(self, identifiers: list[str]) -> list[str]:
        if not any(value.strip() for value in identifiers):
            raise serializers.ValidationError("Enter at least one student.", code="blank")
        return identifiers


class JoinCourseSerializer(serializers.Serializer):
    """รหัสเข้าร่วมที่ผู้เรียนกรอก: {"join_code": "k7q2xm9a"} (ตัวพิมพ์เล็กได้ ; ระบบแปลงเป็นตัวใหญ่เอง)"""

    join_code = serializers.CharField(max_length=20)


class RosterFilterSerializer(serializers.Serializer):
    """
    ตัวกรองแท็บผู้เรียน: GET /api/v1/courses/{id}/enrollments/?status=&search=&page=
    - status: active (ค่าเริ่มต้น — กำลังเรียน) / dropped (ถูกถอน)
    - search: ชื่อ / นามสกุล / ชื่อเต็ม / อีเมล / รหัสนักศึกษา (ไม่สนตัวพิมพ์)
    """

    status = serializers.ChoiceField(choices=Enrollment.Status.choices, default="active")
    search = serializers.CharField(required=False, allow_blank=True, max_length=100)


class CandidateFilterSerializer(serializers.Serializer):
    """ค้นหาผู้เรียนเพื่อเพิ่ม: ?search= อย่างน้อย 2 ตัวอักษร (สั้นกว่า → {"search": ["min_length"]})"""

    search = serializers.CharField(min_length=2, max_length=100)


class CandidateSerializer(serializers.ModelSerializer):
    """
    ผลค้นหาผู้เรียนเพื่อเพิ่ม 1 คน
    enrollment_status = สถานะกับวิชานี้: null (ยังไม่อยู่ → ปุ่ม "เพิ่ม"), "active" (อยู่แล้ว),
    "dropped" (เคยถูกถอน → ปุ่ม "เพิ่มกลับ")
    """

    enrollment_status = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "student_or_staff_id",
            "enrollment_status",
        ]
        read_only_fields = fields
