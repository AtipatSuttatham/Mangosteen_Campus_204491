"""
API รายวิชา (UC-07 — ขั้น 3.3) — อ้างอิง docs/api.md §8 และ CLAUDE.md "การตัดสินใจก้อน 3"

สิทธิ์ตรวจ "ต่อรายวิชา" ผ่าน academics/access.py ; ทุกการเปลี่ยนข้อมูลจด AuditLog
ใน transaction เดียวกับการแก้ (จดไม่สำเร็จ = การแก้ถูกยกเลิก) ; actor = ผู้ที่กด (ผู้ดูแลระบบที่ทำแทนก็จดชื่อผู้ดูแลระบบ)
"""

from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.access import (
    ensure_not_closed,
    get_enrolled_course,
    get_managed_course,
    is_admin,
    with_stats,
)
from academics.join_codes import generate_join_code
from academics.models import Course
from academics.serializers import (
    AdminCourseFilterSerializer,
    CourseSerializer,
    CourseWriteSerializer,
    StudentCourseSerializer,
    course_code_duplicate_error,
)
from accounts.models import User
from accounts.permissions import IsAdminRole
from audit.models import AuditAction
from audit.services import created_changes, diff_changes, field_values, log_action
from common.exceptions import ApiError
from common.pagination import StandardPagination

# ช่องที่สร้าง / แก้ผ่าน API ได้ — ใช้เทียบค่าก่อน-หลังเพื่อจดลง AuditLog (teacher จดเป็นรหัสผู้ใช้)
EDITABLE_FIELDS = ["academic_year", "semester", "code", "name", "description", "teacher"]


def course_response(course: Course, status_code: int = status.HTTP_200_OK) -> Response:
    """ส่งข้อมูลวิชาฉบับเต็ม (อ่านใหม่พร้อมจำนวนผู้เรียน / ข้อมูลการปิด ให้ตรงกับค่าล่าสุด)"""
    fresh = with_stats(Course.objects.filter(pk=course.pk)).get()
    return Response(CourseSerializer(fresh).data, status=status_code)


class MyCourseListView(APIView):
    """
    GET  /api/v1/courses/   "รายวิชาของฉัน" (ไม่แบ่งหน้า — หน้าจอจัดกลุ่มตามภาคเรียนเอง)
         - ผู้สอน: วิชาที่ตัวเองสอนทุกสถานะ (ข้อมูลเต็ม)
         - ผู้เรียน: วิชาที่กำลังเรียนและเผยแพร่แล้ว รวมวิชาที่ปิดแล้ว (ข้อมูลหัวรายวิชา)
         - ผู้ดูแลระบบ: 403 permission_denied (ใช้ /api/v1/admin/courses/ แทน)
         เรียงภาคล่าสุดก่อน แล้วตามรหัสวิชา
    POST /api/v1/courses/   สร้างรายวิชา {academic_year, semester, code, name, description?, teacher?}
         - ผู้สอน: ผู้สอน = ตัวเองเสมอ ; ส่งช่อง teacher มา → 403 permission_denied
         - ผู้ดูแลระบบ: ต้องระบุ teacher (บัญชีผู้สอนที่ใช้งานได้) → ไม่ส่ง = {"teacher": ["required"]}
         - ผู้เรียน: 403 permission_denied
         สำเร็จ → 201 ข้อมูลเต็ม (ยังไม่เผยแพร่ ไม่เปิดรหัสเข้าร่วม) + AuditLog create
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = request.user
        if user.role == User.Role.TEACHER:
            courses = with_stats(Course.objects.filter(teacher=user))
            return Response(CourseSerializer(courses, many=True).data)
        if user.role == User.Role.STUDENT:
            courses = (
                Course.objects.select_related("teacher")
                .filter(
                    is_published=True,
                    enrollments__student=user,
                    enrollments__status="active",
                )
                .distinct()
            )
            return Response(StudentCourseSerializer(courses, many=True).data)
        raise PermissionDenied()

    def post(self, request: Request) -> Response:
        user = request.user
        if user.role == User.Role.TEACHER:
            if "teacher" in request.data:
                # ผู้สอนกำหนดผู้สอนคนอื่นไม่ได้ (เปลี่ยนผู้สอนได้เฉพาะผู้ดูแลระบบ)
                raise PermissionDenied()
        elif not is_admin(user):
            raise PermissionDenied()

        serializer = CourseWriteSerializer(data=request.data)
        if is_admin(user):
            # ผู้ดูแลระบบสร้างแทน → ต้องเลือกผู้สอน (ช่องนี้ไม่บังคับสำหรับผู้สอน)
            serializer.fields["teacher"].required = True
        serializer.is_valid(raise_exception=True)
        teacher = serializer.validated_data.get("teacher", user)

        try:
            # สร้างวิชา + จดบันทึกใน transaction เดียว
            with transaction.atomic():
                course = serializer.save(teacher=teacher, created_by=user)
                log_action(
                    actor=user,
                    action=AuditAction.CREATE,
                    target=course,
                    changes=created_changes(
                        field_values(course, [*EDITABLE_FIELDS, "is_published", "is_closed"])
                    ),
                )
        except IntegrityError as error:
            # 2 คำขอสร้างรหัสวิชาเดียวกันพร้อมกัน → ผ่านการตรวจทั้งคู่ แต่ฐานข้อมูลกันไว้ได้
            raise course_code_duplicate_error() from error
        return course_response(course, status.HTTP_201_CREATED)


class CourseDetailView(APIView):
    """
    GET    /api/v1/courses/{id}/   ดูข้อมูลวิชา
           - ผู้สอนเจ้าของ / ผู้ดูแลระบบ → ข้อมูลเต็ม
           - ผู้เรียนที่กำลังเรียน + วิชาเผยแพร่แล้ว → ข้อมูลหัวรายวิชา
           - คนอื่น → 404 not_found
    PATCH  /api/v1/courses/{id}/   แก้ข้อมูลวิชา (ส่งเฉพาะช่องที่แก้) — ผู้สอนเจ้าของ / ผู้ดูแลระบบ
           - ช่อง teacher (เปลี่ยนผู้สอน) ส่งได้เฉพาะผู้ดูแลระบบ → ผู้สอนส่งมา 403 permission_denied
           - วิชาที่ปิดแล้ว → 409 course_closed ยกเว้นผู้ดูแลระบบเปลี่ยนผู้สอนอย่างเดียว
           - สำเร็จ → 200 ข้อมูลเต็ม + AuditLog update เฉพาะช่องที่เปลี่ยน (ไม่มีอะไรเปลี่ยน = ไม่จด)
    DELETE /api/v1/courses/{id}/   ลบวิชา — ได้เฉพาะวิชาที่ยังไม่เผยแพร่ ไม่ปิด และไม่เคยมีผู้เรียน
           - ปิดแล้ว → 409 course_closed ; เผยแพร่แล้ว / เคยมีผู้เรียน → 409 course_not_deletable
           - สำเร็จ → 204 + AuditLog delete พร้อมค่าทั้งหมดก่อนลบ
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: int) -> Response:
        user = request.user
        if user.role == User.Role.STUDENT:
            return Response(StudentCourseSerializer(get_enrolled_course(user, pk)).data)
        return course_response(get_managed_course(user, pk))

    def patch(self, request: Request, pk: int) -> Response:
        user = request.user
        if "teacher" in request.data and not is_admin(user):
            # ตรวจสิทธิ์วิชาก่อน (ไม่ใช่วิชาของตัวเอง = 404 ไม่บอกว่ามีวิชานี้) แล้วจึงปฏิเสธการเปลี่ยนผู้สอน
            get_managed_course(user, pk)
            raise PermissionDenied()

        with transaction.atomic():
            course = get_managed_course(user, pk, lock=True)
            only_teacher = set(request.data) <= {"teacher"}
            if not (is_admin(user) and only_teacher):
                # วิชาที่ปิดแล้ว: ผู้ดูแลระบบเปลี่ยนผู้สอนได้อย่างเดียว (เช่น ผู้สอนย้ายงาน)
                ensure_not_closed(course)

            serializer = CourseWriteSerializer(course, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            before = field_values(course, EDITABLE_FIELDS)
            try:
                # savepoint ย่อย: ฐานข้อมูลปฏิเสธเพราะรหัสซ้ำ (คำขอชนกัน) → ตอบ error ปกติแทน 500
                with transaction.atomic():
                    serializer.save()
            except IntegrityError as error:
                raise course_code_duplicate_error() from error

            changes = diff_changes(before, field_values(course, EDITABLE_FIELDS))
            if changes:
                log_action(actor=user, action=AuditAction.UPDATE, target=course, changes=changes)
        return course_response(course)

    def delete(self, request: Request, pk: int) -> Response:
        user = request.user
        with transaction.atomic():
            course = get_managed_course(user, pk, lock=True)
            ensure_not_closed(course)
            if course.is_published or course.enrollments.exists():
                raise ApiError(
                    "course_not_deletable",
                    "Only unpublished courses that never had students can be deleted.",
                    status_code=status.HTTP_409_CONFLICT,
                )
            # จดก่อนลบ (ยังมีรหัสระเบียนให้อ้างอิง) — เก็บค่าทั้งหมดในรูป {"field": [ค่าเดิม, null]}
            values = field_values(course, [*EDITABLE_FIELDS, "join_code"])
            log_action(
                actor=user,
                action=AuditAction.DELETE,
                target=course,
                changes={name: [value, None] for name, value in values.items() if value},
            )
            course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CourseStatusView(APIView):
    """
    POST /api/v1/courses/{id}/publish/     เผยแพร่ (is_published → True)
    POST /api/v1/courses/{id}/unpublish/   ยกเลิกการเผยแพร่ (is_published → False)
    POST /api/v1/courses/{id}/close/       ปิดรายวิชา (is_closed → True) → AuditLog close_course
    POST /api/v1/courses/{id}/reopen/      เปิดรายวิชาคืน (is_closed → False) — ผู้ดูแลระบบเท่านั้น
    (ไม่มี body — ที่อยู่ไหนเปลี่ยนช่องไหนกำหนดด้วย field / value ใน urls.py)

    - ผู้สอนเจ้าของ / ผู้ดูแลระบบ ; คนอื่น → 404 not_found ; ผู้สอนกด reopen → 403 permission_denied
    - เผยแพร่ / ยกเลิกการเผยแพร่วิชาที่ปิดแล้ว → 409 course_closed
    - สำเร็จ → 200 ข้อมูลเต็ม ; สถานะเป็นแบบนั้นอยู่แล้ว → 200 เหมือนกัน แต่ไม่จด
    - ปิดวิชาที่ยังไม่เผยแพร่ได้ (กันวิชาที่ทั้งลบไม่ได้และปิดไม่ได้ค้างอยู่ ;
      หน้าจอแสดงปุ่มปิดเฉพาะวิชาที่เผยแพร่แล้ว — ผู้ใช้ยืนยันในแผนขั้น 3.3)
    """

    permission_classes = [IsAuthenticated]
    # ช่องที่เปลี่ยน ("is_published" / "is_closed") และค่าปลายทาง
    field: str = "is_published"
    value: bool = True

    def post(self, request: Request, pk: int) -> Response:
        user = request.user
        with transaction.atomic():
            course = get_managed_course(user, pk, lock=True)
            reopening = self.field == "is_closed" and self.value is False
            if reopening and not is_admin(user):
                raise PermissionDenied()
            if self.field == "is_published":
                ensure_not_closed(course)

            if getattr(course, self.field) != self.value:
                setattr(course, self.field, self.value)
                course.save(update_fields=[self.field, "updated_at"])
                closing = self.field == "is_closed" and self.value is True
                log_action(
                    actor=user,
                    action=AuditAction.CLOSE_COURSE if closing else AuditAction.UPDATE,
                    target=course,
                    changes={self.field: [not self.value, self.value]},
                )
        return course_response(course)


# จำนวนครั้งที่ลองบันทึกรหัสเข้าร่วมใหม่ เมื่อชนกับคำขออื่นที่สุ่มได้รหัสเดียวกันพร้อมกันพอดี
JOIN_CODE_SAVE_ATTEMPTS = 3


def save_new_join_code(course: Course) -> None:
    """
    สุ่มรหัสเข้าร่วมใหม่แล้วบันทึก — ฐานข้อมูลปฏิเสธเพราะรหัสซ้ำ (ชนกันพอดี) → สุ่มใหม่ สูงสุด 3 ครั้ง
    ต้องเรียกใน transaction.atomic() ; แต่ละครั้งใช้ savepoint ย่อย ให้ย้อนเฉพาะครั้งที่ไม่ผ่าน
    """
    for attempt in range(JOIN_CODE_SAVE_ATTEMPTS):
        course.join_code = generate_join_code()
        try:
            with transaction.atomic():
                course.save(update_fields=["join_code", "join_code_enabled", "updated_at"])
            return
        except IntegrityError:
            if attempt == JOIN_CODE_SAVE_ATTEMPTS - 1:
                raise


class JoinCodeView(APIView):
    """
    POST /api/v1/courses/{id}/join-code/enable/       เปิดให้เข้าร่วมด้วยรหัส
         ยังไม่มีรหัส → สุ่มให้ ; เคยมีแล้ว → ใช้รหัสเดิม (ผู้สอนอาจแจ้งห้องไปแล้ว — ยืนยันในแผนขั้น 3.3)
    POST /api/v1/courses/{id}/join-code/disable/      ปิดการเข้าร่วมด้วยรหัส (เก็บรหัสไว้)
    POST /api/v1/courses/{id}/join-code/regenerate/   สุ่มรหัสใหม่ — รหัสเดิมใช้ไม่ได้ทันที
    (action ของแต่ละที่อยู่กำหนดใน urls.py)

    - ผู้สอนเจ้าของ / ผู้ดูแลระบบ ; คนอื่น → 404 ; วิชาที่ปิดแล้ว → 409 course_closed
    - สำเร็จ → 200 ข้อมูลเต็ม (มี join_code) + AuditLog update เมื่อมีอะไรเปลี่ยน
      (เก็บรหัสเข้าร่วมค่าจริง ไม่ปิดเป็น *** — แสดงบนจอให้ทั้งห้องเห็นอยู่แล้ว ; ยืนยันในแผนขั้น 3.3)
    """

    permission_classes = [IsAuthenticated]
    # "enable" / "disable" / "regenerate"
    action: str = "enable"

    def post(self, request: Request, pk: int) -> Response:
        user = request.user
        with transaction.atomic():
            course = get_managed_course(user, pk, lock=True)
            ensure_not_closed(course)
            before = field_values(course, ["join_code_enabled", "join_code"])

            if self.action == "regenerate" or (self.action == "enable" and not course.join_code):
                if self.action == "enable":
                    course.join_code_enabled = True
                save_new_join_code(course)
            elif course.join_code_enabled != (self.action == "enable"):
                course.join_code_enabled = self.action == "enable"
                course.save(update_fields=["join_code_enabled", "updated_at"])

            changes = diff_changes(before, field_values(course, ["join_code_enabled", "join_code"]))
            if changes:
                log_action(actor=user, action=AuditAction.UPDATE, target=course, changes=changes)
        return course_response(course)


class AdminCourseListView(APIView):
    """
    GET /api/v1/admin/courses/?search=&term=&teacher=&status=&page=   รายวิชาทั้งระบบ หน้าละ 20
    - search: รหัสหรือชื่อวิชา (ไม่สนตัวพิมพ์) ; term: "ปี-ภาค" เช่น 2569-1 ; teacher: รหัสผู้ใช้ของผู้สอน
    - status: draft (ยังไม่เผยแพร่) / published (เผยแพร่แล้ว) / closed (ปิดแล้ว)
    - เรียงภาคล่าสุดก่อน แล้วตามรหัสวิชา ; ตัวกรองผิด → 400 ; หน้าที่ไม่มี → 404
    - ผู้ดูแลระบบเท่านั้น → อื่น ๆ 403 permission_denied
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: Request) -> Response:
        filters = AdminCourseFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        params = filters.validated_data

        courses = Course.objects.all()
        search = params.get("search", "").strip()
        if search:
            courses = courses.filter(Q(code__icontains=search) | Q(name__icontains=search))
        if "term" in params:
            year, semester = params["term"].split("-")
            courses = courses.filter(academic_year=int(year), semester=int(semester))
        if "teacher" in params:
            courses = courses.filter(teacher_id=params["teacher"])
        state = params.get("status")
        if state == "draft":
            courses = courses.filter(is_published=False, is_closed=False)
        elif state == "published":
            courses = courses.filter(is_published=True, is_closed=False)
        elif state == "closed":
            courses = courses.filter(is_closed=True)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(with_stats(courses), request, view=self)
        return paginator.get_paginated_response(CourseSerializer(page, many=True).data)


class AdminTermListView(APIView):
    """
    GET /api/v1/admin/courses/terms/   ภาคเรียนที่มีรายวิชาอยู่ (ตัวเลือกของตัวกรอง "ภาคเรียน")
    → 200 [{"academic_year": 2569, "semester": 1}, ...] เรียงภาคล่าสุดก่อน (ไม่แบ่งหน้า)
    ผู้ดูแลระบบเท่านั้น
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: Request) -> Response:
        terms = (
            Course.objects.order_by("-academic_year", "-semester")
            .values("academic_year", "semester")
            .distinct()
        )
        return Response(list(terms))
