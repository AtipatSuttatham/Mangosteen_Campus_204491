"""
test ของการเข้าร่วมรายวิชาด้วยรหัส (POST /api/v1/enroll/) — ขั้น 3.4
อ้างอิงพฤติกรรม: docs/api.md §9, CLAUDE.md "การตัดสินใจก้อน 3" (ข้อความเดียวทุกกรณี, จำกัดจำนวนครั้ง,
ผู้ที่ถูกถอนกลับเองไม่ได้)
"""

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from academics.models import Course
from academics.tests.conftest import client_for, enroll, make_course, make_user
from accounts.models import User
from audit.models import AuditAction, AuditLog
from enrollment.models import Enrollment

pytestmark = pytest.mark.django_db

JOIN_URL = "/api/v1/enroll/"
CODE = "K7Q2XM9A"


@pytest.fixture(autouse=True)
def reset_throttle() -> None:
    """ล้างตัวนับจำกัดความถี่ (เก็บใน cache) ก่อนทุก test — ไม่ให้ test หนึ่งกินโควตาของอีก test"""
    cache.clear()


@pytest.fixture
def open_course(teacher: User) -> Course:
    """วิชาที่เข้าร่วมได้: เผยแพร่แล้ว + เปิดรหัส + ยังไม่ปิด"""
    return make_course(teacher, is_published=True, join_code=CODE, join_code_enabled=True)


def join(client: APIClient, code: str = CODE):
    return client.post(JOIN_URL, {"join_code": code}, format="json")


def test_join_with_code(student_client: APIClient, student: User, open_course: Course) -> None:
    """เข้าร่วมสำเร็จ → 201 หัวรายวิชา, กำลังเรียน, ไม่มีผู้เพิ่ม (= ใช้รหัส), AuditLog enroll โดยผู้เรียน"""
    response = join(student_client)

    assert response.status_code == 201
    assert response.data["code"] == "204111"
    assert "join_code" not in response.data
    enrollment = Enrollment.objects.get()
    assert (enrollment.student, enrollment.status, enrollment.enrolled_by) == (
        student,
        Enrollment.Status.ACTIVE,
        None,
    )
    log = AuditLog.objects.get()
    assert (log.action, log.actor) == (AuditAction.ENROLL, student)


def test_code_is_case_insensitive(student_client: APIClient, open_course: Course) -> None:
    """พิมพ์ตัวเล็ก / มีช่องว่าง → ใช้ได้"""
    assert join(student_client, "  k7q2xm9a ").status_code == 201


def test_joined_course_appears_in_my_courses(
    student_client: APIClient, open_course: Course
) -> None:
    join(student_client)

    assert [c["code"] for c in student_client.get("/api/v1/courses/").data] == ["204111"]


def test_join_again_when_already_enrolled(
    student_client: APIClient, student: User, open_course: Course
) -> None:
    """อยู่ในวิชาอยู่แล้ว → 200 ไม่จดซ้ำ"""
    enroll(open_course, student)

    response = join(student_client)

    assert response.status_code == 200
    assert Enrollment.objects.count() == 1
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("case", ["unknown", "disabled", "unpublished", "closed", "dropped"])
def test_every_failure_has_the_same_error(
    student_client: APIClient, student: User, teacher: User, case: str
) -> None:
    """ไม่มีรหัส / ปิดรหัส / ยังไม่เผยแพร่ / ปิดวิชา / เคยถูกถอน → join_code_invalid เหมือนกันทุกกรณี"""
    fields = {"is_published": True, "join_code": CODE, "join_code_enabled": True}
    if case == "disabled":
        fields["join_code_enabled"] = False
    elif case == "unpublished":
        fields["is_published"] = False
    elif case == "closed":
        fields["is_closed"] = True
    course = make_course(teacher, **fields)
    if case == "dropped":
        enroll(course, student, status=Enrollment.Status.DROPPED, dropped_at="2026-06-10T00:00Z")

    response = join(student_client, "ZZZZZZZZ" if case == "unknown" else CODE)

    assert response.status_code == 400
    assert response.data["code"] == "join_code_invalid"
    assert not AuditLog.objects.exists()


def test_dropped_student_stays_dropped(
    student_client: APIClient, student: User, open_course: Course
) -> None:
    """ผู้ที่ถูกถอนใช้รหัสกลับเองไม่ได้ (ผู้ใช้เลือกแบบ ข) — ระเบียนยังเป็นถูกถอน"""
    enrollment = enroll(
        open_course, student, status=Enrollment.Status.DROPPED, dropped_at="2026-06-10T00:00Z"
    )

    join(student_client)

    enrollment.refresh_from_db()
    assert enrollment.status == Enrollment.Status.DROPPED


def test_regenerated_code_replaces_old_one(
    student_client: APIClient, teacher_client: APIClient, open_course: Course
) -> None:
    """ผู้สอนสุ่มรหัสใหม่ → รหัสเดิมใช้ไม่ได้ทันที รหัสใหม่ใช้ได้"""
    new_code = teacher_client.post(f"/api/v1/courses/{open_course.pk}/join-code/regenerate/").data[
        "join_code"
    ]

    assert join(student_client, CODE).data["code"] == "join_code_invalid"
    assert join(student_client, new_code).status_code == 201


def test_blank_code(student_client: APIClient) -> None:
    response = join(student_client, "")

    assert response.status_code == 400
    assert response.data["fields"] == {"join_code": ["blank"]}


@pytest.mark.parametrize("who", ["teacher_client", "admin_client"])
def test_only_students_can_join(
    request: pytest.FixtureRequest, open_course: Course, who: str
) -> None:
    """ผู้สอน / ผู้ดูแลระบบ → 403"""
    client: APIClient = request.getfixturevalue(who)

    assert join(client).status_code == 403


def test_requires_login(open_course: Course) -> None:
    assert join(APIClient()).status_code == 401


def test_attempts_are_limited_per_minute(student_client: APIClient, student: User) -> None:
    """ลองเกิน 10 ครั้งใน 1 นาที → ครั้งที่ 11 ได้ 429 throttled (นับทั้งรหัสผิดและถูก)"""
    codes = [join(student_client, f"WRONG{n:03d}").status_code for n in range(10)]

    eleventh = join(student_client, "WRONG999")

    assert codes == [400] * 10
    assert eleventh.status_code == 429
    assert eleventh.data["code"] == "throttled"


def test_limit_is_per_account(
    student_client: APIClient, teacher: User, open_course: Course
) -> None:
    """ผู้เรียนอีกคนไม่โดนผลจากโควตาของคนแรก"""
    for n in range(10):
        join(student_client, f"WRONG{n:03d}")
    other = make_user("s670510999@example.com", User.Role.STUDENT)

    assert join(client_for(other)).status_code == 201
