"""
API การลงทะเบียน (UC-08, UC-15 — ขั้น 3.4) — อ้างอิง docs/api.md §9 และ CLAUDE.md "การตัดสินใจก้อน 3"

สิทธิ์ตรวจต่อรายวิชาผ่าน academics/access.py (ผู้สอนเจ้าของ / ผู้ดูแลระบบ ; ไม่มีสิทธิ์ = 404)
"""

from django.db.models import Count, OuterRef, Q, QuerySet, Subquery, Value
from django.db.models.functions import Concat
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.access import get_managed_course
from accounts.models import User
from common.pagination import StandardPagination
from enrollment.models import Enrollment
from enrollment.serializers import (
    CandidateFilterSerializer,
    CandidateSerializer,
    EnrollmentSerializer,
    RosterFilterSerializer,
)

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
