"""
ตัวตรวจสิทธิ์ของ API เนื้อหารายวิชา (ขั้น 4.3) — แยก "ดู" กับ "แก้"
อ้างอิง: CLAUDE.md "การตัดสินใจก้อน 4" (กง1) และ docs/api.md §10

- ดู (รายการหน่วย + เนื้อหาทุกสถานะ): ผู้สอนเจ้าของวิชา + ผู้ดูแลระบบ
- แก้ (เพิ่ม / แก้ / ลบ / เลื่อน / เผยแพร่): ผู้สอนเจ้าของวิชาเท่านั้น
  ผู้ดูแลระบบ → 403 content_read_only (รายงานตาราง 3.1 — ผู้ดูแลระบบไม่จัดการเนื้อหา)
- คนอื่น (ผู้สอนวิชาอื่น / ผู้เรียน) → 404 not_found ไม่บอกว่ามีวิชานี้ (แบบเดียวกับ academics/access.py)
- วิชาที่ปิดแล้วแก้ไม่ได้ → 409 course_closed
- หาหน่วย / เนื้อหาเฉพาะใน "วิชาที่ระบุ" เท่านั้น → ส่งรหัสของวิชาอื่นมา = 404 (กันแก้ / ย้ายข้ามวิชา)
"""

from rest_framework import status
from rest_framework.exceptions import NotFound

from academics.access import can_manage, ensure_not_closed, is_admin
from academics.models import Course
from accounts.models import User
from common.exceptions import ApiError
from content.models import Content, Module


def get_course_for_content(
    user: User, course_id: int, *, write: bool = False, lock: bool | None = None
) -> Course:
    """
    หาวิชาที่ผู้ใช้ดู (write=False) หรือแก้ (write=True) เนื้อหาได้
    lock (ค่าเริ่มต้น = write): ล็อกแถววิชาไว้จนจบ transaction — การแก้เนื้อหาในวิชาเดียวกันจึงทำทีละคำขอ
    (กันลำดับพังเมื่อเปิด 2 แท็บแล้วกด ↑ ↓ พร้อมกัน) ; ต้องเรียกใน transaction.atomic()
    write=True, lock=False: ตรวจสิทธิ์แก้ล่วงหน้าโดยไม่ล็อก — ใช้ก่อนรับ / เก็บไฟล์ (views.py)
    เพื่อไม่ถือล็อกวิชาไว้ระหว่างส่งไฟล์ขึ้นที่เก็บ (ล็อกเดียวกันนี้ใช้ตอนผู้เรียนเข้าร่วมด้วยรหัสด้วย)
    """
    if lock is None:
        lock = write
    courses = Course.objects.all()
    if lock:
        courses = courses.select_for_update()
    course = courses.filter(pk=course_id).first()
    if course is None or not can_manage(user, course):
        raise NotFound()
    if write:
        if is_admin(user):
            raise ApiError(
                "content_read_only",
                "Administrators can view course content but cannot change it.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        ensure_not_closed(course)
    return course


def get_module(course: Course, module_id: int) -> Module:
    """หน่วยการเรียนในวิชานี้ ; ไม่พบ (หรือเป็นของวิชาอื่น) → 404"""
    module = Module.objects.filter(pk=module_id, course=course).first()
    if module is None:
        raise NotFound()
    return module


def get_content(course: Course, content_id: int) -> Content:
    """เนื้อหาในวิชานี้ ; ไม่พบ (หรือเป็นของวิชาอื่น) → 404"""
    content = (
        Content.objects.select_related("module")
        .filter(pk=content_id, module__course=course)
        .first()
    )
    if content is None:
        raise NotFound()
    return content
