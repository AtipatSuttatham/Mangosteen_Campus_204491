"""
ตัวตรวจสิทธิ์ "ต่อรายวิชา" — ใช้ร่วมกันทุก API ที่ทำงานกับรายวิชา (ขั้น 3.3 และก้อนถัดไป)
อ้างอิง: CLAUDE.md "บทบาทผู้ใช้" (permission ตรวจต่อรายวิชา ไม่ใช่แค่ User.role)
และ "การตัดสินใจก้อน 3", docs/api.md §8

กติกา:
- ผู้ดูแลระบบ: จัดการได้ทุกวิชา (ทำแทนผู้สอน — AuditLog จดชื่อผู้ดูแลระบบ)
- ผู้สอน: จัดการได้เฉพาะวิชาที่ตัวเองเป็น Course.teacher และยังมีบทบาทผู้สอนอยู่
- ผู้เรียน: ดูหัวรายวิชาได้เฉพาะวิชาที่กำลังเรียน (Enrollment active) และเผยแพร่แล้ว
- คนที่ไม่มีสิทธิ์ได้ 404 not_found (ไม่บอกว่ามีวิชานี้อยู่) — ผู้ใช้ยืนยันในแผนขั้น 3.3
"""

from django.contrib.contenttypes.models import ContentType
from django.db.models import CharField, Count, OuterRef, Q, QuerySet, Subquery
from django.db.models.functions import Cast
from rest_framework import status
from rest_framework.exceptions import NotFound

from academics.models import Course
from accounts.models import User
from audit.models import AuditAction, AuditLog
from common.exceptions import ApiError
from enrollment.models import Enrollment


def is_admin(user: User) -> bool:
    """ผู้ใช้เป็นผู้ดูแลระบบหรือไม่ (อ่านบทบาทจากฐานข้อมูลของคำขอนี้)"""
    return user.role == User.Role.ADMIN


def can_manage(user: User, course: Course) -> bool:
    """จัดการวิชานี้ได้ไหม: ผู้ดูแลระบบ หรือผู้สอนที่เป็นเจ้าของวิชา (ต้องยังเป็นบทบาทผู้สอน)"""
    if is_admin(user):
        return True
    return user.role == User.Role.TEACHER and course.teacher_id == user.pk


def with_stats(courses: QuerySet[Course]) -> QuerySet[Course]:
    """
    เติมข้อมูลที่หน้าจอต้องใช้ให้ทุกวิชาในคำสั่ง SQL เดียว (ไม่ต้องถามฐานข้อมูลทีละวิชา):
    - active_count: จำนวนผู้เรียนที่กำลังเรียน ("42 ผู้เรียน")
    - enrollment_total: จำนวนระเบียนทั้งหมด รวมคนที่ถูกถอน (ใช้ตัดสินว่าลบวิชาได้ไหม)
    - closed_at / closed_by_first / closed_by_last: เวลาและผู้ปิดรายวิชาครั้งล่าสุด อ่านจาก AuditLog
      action=close_course (ข้อตกลงก้อน 3 — ไม่เพิ่ม field ในตาราง Course)
    """
    content_type = ContentType.objects.get_for_model(Course)
    close_logs = AuditLog.objects.filter(
        content_type=content_type,
        object_id=Cast(OuterRef("pk"), output_field=CharField()),
        action=AuditAction.CLOSE_COURSE,
    ).order_by("-created_at", "-id")
    return (
        courses.select_related("teacher")
        .annotate(
            active_count=Count(
                "enrollments", filter=Q(enrollments__status=Enrollment.Status.ACTIVE), distinct=True
            ),
            enrollment_total=Count("enrollments", distinct=True),
            closed_at=Subquery(close_logs.values("created_at")[:1]),
            closed_by_first=Subquery(close_logs.values("actor__first_name")[:1]),
            closed_by_last=Subquery(close_logs.values("actor__last_name")[:1]),
        )
        # ระบุลำดับเอง: คำสั่งที่มีการนับ (Count) Django ไม่ใช้ลำดับเริ่มต้นของตาราง (Meta.ordering)
        # → ภาคล่าสุดก่อน แล้วตามรหัสวิชา (id ช่วยให้ลำดับคงที่เมื่อค่าเท่ากัน — สำคัญกับการแบ่งหน้า)
        .order_by("-academic_year", "-semester", "code", "id")
    )


def get_managed_course(user: User, pk: int, *, lock: bool = False) -> Course:
    """
    หาวิชาที่ผู้ใช้คนนี้จัดการได้ — ไม่พบ หรือไม่มีสิทธิ์ → 404 not_found
    lock=True: ล็อกแถววิชาไว้จนจบ transaction (ใช้ตอนแก้ข้อมูล กัน 2 คำขอแก้ทับกัน)
    """
    courses = Course.objects.select_related("teacher")
    if lock:
        # of=("self",) = ล็อกเฉพาะแถววิชา ไม่ล็อกแถวผู้สอนที่ดึงมาด้วย
        courses = courses.select_for_update(of=("self",))
    course = courses.filter(pk=pk).first()
    if course is None or not can_manage(user, course):
        raise NotFound()
    return course


def get_enrolled_course(user: User, pk: int) -> Course:
    """
    หาวิชาที่ผู้เรียนคนนี้ดูได้: กำลังเรียน (active) + วิชาเผยแพร่แล้ว (วิชาที่ปิดแล้วยังดูย้อนหลังได้)
    ไม่ผ่าน → 404 not_found
    """
    course = (
        Course.objects.select_related("teacher")
        .filter(
            pk=pk,
            is_published=True,
            enrollments__student=user,
            enrollments__status=Enrollment.Status.ACTIVE,
        )
        .first()
    )
    if course is None:
        raise NotFound()
    return course


def ensure_not_closed(course: Course) -> None:
    """วิชาที่ปิดแล้วแก้ไม่ได้ (ข้อมูล / การเผยแพร่ / รหัสเข้าร่วม / ลบ) → 409 course_closed"""
    if course.is_closed:
        raise ApiError(
            "course_closed",
            "This course is closed and cannot be changed.",
            status_code=status.HTTP_409_CONFLICT,
        )
