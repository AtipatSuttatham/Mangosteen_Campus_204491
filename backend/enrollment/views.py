"""
API การลงทะเบียน (UC-08, UC-15 — ขั้น 3.4) — อ้างอิง docs/api.md §9 และ CLAUDE.md "การตัดสินใจก้อน 3"

สิทธิ์ตรวจต่อรายวิชาผ่าน academics/access.py (ผู้สอนเจ้าของ / ผู้ดูแลระบบ ; ไม่มีสิทธิ์ = 404)
"""

from django.db import transaction
from django.db.models import Count, OuterRef, Q, QuerySet, Subquery, Value
from django.db.models.functions import Concat
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.access import ensure_not_closed, get_managed_course
from accounts.models import User
from common.pagination import StandardPagination
from enrollment.models import Enrollment
from enrollment.serializers import (
    AddStudentsSerializer,
    CandidateFilterSerializer,
    CandidateSerializer,
    EnrolledStudentSerializer,
    EnrollmentSerializer,
    RosterFilterSerializer,
)
from enrollment.services import add_students, drop

# จำนวนผลค้นหาสูงสุดในหน้าต่าง "เพิ่มผู้เรียน — ค้นหาทีละคน"
CANDIDATE_LIMIT = 10


def search_students(users: QuerySet[User], search: str, prefix: str = "") -> QuerySet[User]:
    """
    กรองผู้ใช้ด้วยคำค้น: ชื่อ / นามสกุล / ชื่อเต็ม / อีเมล / รหัสนักศึกษา (ไม่สนตัวพิมพ์)
    prefix = ทางไปหาผู้ใช้ เช่น "student__" เมื่อกรองจากตาราง Enrollment
    """
    search = search.strip()
    if not search:
        return users
    return users.annotate(
        full_name=Concat(f"{prefix}first_name", Value(" "), f"{prefix}last_name")
    ).filter(
        Q(full_name__icontains=search)
        | Q(**{f"{prefix}email__icontains": search})
        | Q(**{f"{prefix}student_or_staff_id__icontains": search})
    )


class CourseRosterView(APIView):
    """
    GET /api/v1/courses/{id}/enrollments/?status=&search=&page=   รายชื่อในแท็บผู้เรียน หน้าละ 20
    - status: active (ค่าเริ่มต้น) / dropped ; search: ชื่อ / อีเมล / รหัสนักศึกษา
    - เรียงตามรหัสนักศึกษา แล้วตามชื่อ (เหมือนใบรายชื่อของคณะ)
    - คำตอบ = รูปแบบแบ่งหน้ามาตรฐาน + counts {active, dropped} (ตัวเลขบนปุ่มกรอง — ไม่ขึ้นกับคำค้น)
    - ผู้สอนเจ้าของ / ผู้ดูแลระบบ ; คนอื่น → 404 ; วิชาที่ปิดแล้วยังดูได้
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: int) -> Response:
        course = get_managed_course(request.user, pk)
        filters = RosterFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        params = filters.validated_data

        enrollments = (
            Enrollment.objects.filter(course=course, status=params["status"])
            .select_related("student", "enrolled_by")
            .order_by("student__student_or_staff_id", "student__first_name", "id")
        )
        enrollments = search_students(enrollments, params.get("search", ""), prefix="student__")

        counts = course.enrollments.aggregate(
            active=Count("id", filter=Q(status=Enrollment.Status.ACTIVE)),
            dropped=Count("id", filter=Q(status=Enrollment.Status.DROPPED)),
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(enrollments, request, view=self)
        response = paginator.get_paginated_response(EnrollmentSerializer(page, many=True).data)
        response.data["counts"] = counts
        return response

    def post(self, request: Request, pk: int) -> Response:
        """
        POST /api/v1/courses/{id}/enrollments/  {"identifiers": ["670510118", "a@example.com", ...]}
        เพิ่มผู้เรียน 1–500 คน (ใช้ทั้งปุ่ม "เพิ่ม" ทีละคน และ "วางรายการรหัส")
        - เพิ่มคนที่ถูกไปก่อน แล้วรายงานที่เหลือ → 200 {added, reactivated, already, failed}
          failed[].reason: not_found / not_student / suspended (เรียงตามลำดับที่วาง)
        - เกิน 500 รายการ → 400 {"identifiers": ["max_length"]} ไม่เพิ่มใครเลย ; ว่างทั้งหมด → "blank"
        - วิชาที่ปิดแล้ว → 409 course_closed ; วิชาที่ยังไม่เผยแพร่เพิ่มได้ (เตรียมรายชื่อก่อนเปิด)
        """
        serializer = AddStudentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            # ล็อกแถววิชา → คำขอเพิ่ม / ถอน / เข้าร่วมของวิชาเดียวกันต่อคิวกัน (ไม่เกิดระเบียนซ้ำ)
            course = get_managed_course(request.user, pk, lock=True)
            ensure_not_closed(course)
            result = add_students(course, request.user, serializer.validated_data["identifiers"])

        def rows(items: list) -> list[dict]:
            return [
                {"identifier": identifier, "student": EnrolledStudentSerializer(e.student).data}
                for identifier, e in items
            ]

        return Response(
            {
                "added": rows(result["added"]),
                "reactivated": rows(result["reactivated"]),
                "already": rows(result["already"]),
                "failed": result["failed"],
            }
        )


class CandidateSearchView(APIView):
    """
    GET /api/v1/courses/{id}/enrollments/candidates/?search=   ค้นหาผู้เรียนเพื่อเพิ่มเข้าวิชา
    - เฉพาะบัญชีผู้เรียนที่ใช้งานได้ ; คำค้นอย่างน้อย 2 ตัวอักษร (สั้นกว่า → 400 min_length)
    - ไม่เกิน 10 คน เรียงตามรหัสนักศึกษา ; แต่ละคนบอก enrollment_status กับวิชานี้
    - ผู้สอนเจ้าของ / ผู้ดูแลระบบ ; คนอื่น → 404
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: int) -> Response:
        course = get_managed_course(request.user, pk)
        filters = CandidateFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)

        status_in_course = Enrollment.objects.filter(course=course, student=OuterRef("pk"))
        students = (
            search_students(
                User.objects.filter(role=User.Role.STUDENT, is_active=True),
                filters.validated_data["search"],
            )
            .annotate(enrollment_status=Subquery(status_in_course.values("status")[:1]))
            .order_by("student_or_staff_id", "first_name", "id")[:CANDIDATE_LIMIT]
        )
        return Response(CandidateSerializer(students, many=True).data)


class DropEnrollmentView(APIView):
    """
    POST /api/v1/courses/{id}/enrollments/{enrollment_id}/drop/
    ถอนผู้เรียนออกจากวิชา (ปุ่ม "ถอน" หลังยืนยัน)
    - สำเร็จ → 200 ระเบียนหลังถอน (status = dropped) + AuditLog unenroll ; ถูกถอนอยู่แล้ว → 200 ไม่จดซ้ำ
    - ไม่ลบระเบียน → คะแนนเดิมอยู่ครบ ; เพิ่มกลับใช้ POST …/enrollments/ (ผู้สอน / ผู้ดูแลระบบเท่านั้น)
    - ผู้สอนเจ้าของ / ผู้ดูแลระบบ ; คนอื่น / ระเบียนของวิชาอื่น → 404 ; วิชาที่ปิดแล้ว → 409 course_closed
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, pk: int, enrollment_id: int) -> Response:
        with transaction.atomic():
            course = get_managed_course(request.user, pk, lock=True)
            ensure_not_closed(course)
            enrollment = get_object_or_404(
                Enrollment.objects.select_related("student", "enrolled_by"),
                pk=enrollment_id,
                course=course,
            )
            drop(enrollment, request.user)
        return Response(EnrollmentSerializer(enrollment).data)
