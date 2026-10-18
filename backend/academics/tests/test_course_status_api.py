"""
test ของปุ่มเปลี่ยนสถานะรายวิชา (เผยแพร่ / ยกเลิก / ปิด / เปิดคืน) และรหัสเข้าร่วม (เปิด / ปิด / สุ่มใหม่)
— ขั้น 3.3 ; อ้างอิงพฤติกรรม: docs/api.md §8, CLAUDE.md "การตัดสินใจก้อน 3"
"""

import re
from unittest import mock

import pytest
from rest_framework.test import APIClient

from academics.join_codes import JOIN_CODE_PATTERN
from academics.models import Course
from academics.tests.conftest import client_for, course_url, make_course
from accounts.models import User
from audit.models import AuditAction, AuditLog

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------- เผยแพร่ / ยกเลิกการเผยแพร่


def test_publish_and_unpublish(teacher_client: APIClient, course: Course) -> None:
    """เผยแพร่ → is_published true ; ยกเลิก → false ; จดทั้งสองครั้ง"""
    published = teacher_client.post(course_url(course, "publish/"))
    unpublished = teacher_client.post(course_url(course, "unpublish/"))

    assert published.status_code == 200
    assert published.data["is_published"] is True
    assert unpublished.data["is_published"] is False
    changes = [log.changes for log in AuditLog.objects.order_by("id")]
    assert changes == [{"is_published": [False, True]}, {"is_published": [True, False]}]


def test_publish_twice_is_not_audited_again(teacher_client: APIClient, course: Course) -> None:
    """กดเผยแพร่ซ้ำ → 200 แต่จดครั้งเดียว"""
    teacher_client.post(course_url(course, "publish/"))
    response = teacher_client.post(course_url(course, "publish/"))

    assert response.status_code == 200
    assert AuditLog.objects.count() == 1


@pytest.mark.parametrize("action", ["publish/", "unpublish/"])
def test_cannot_change_publishing_of_closed_course(
    teacher_client: APIClient, teacher: User, action: str
) -> None:
    """วิชาที่ปิดแล้ว → 409 course_closed"""
    course = make_course(teacher, is_published=True, is_closed=True)

    response = teacher_client.post(course_url(course, action))

    assert response.status_code == 409
    assert response.data["code"] == "course_closed"


@pytest.mark.parametrize(
    "action", ["publish/", "unpublish/", "close/", "reopen/", "join-code/enable/"]
)
def test_other_teacher_gets_404(other_teacher: User, course: Course, action: str) -> None:
    """ผู้สอนคนอื่นกดปุ่มใดก็ได้ 404"""
    assert client_for(other_teacher).post(course_url(course, action)).status_code == 404


def test_student_gets_404(student_client: APIClient, course: Course) -> None:
    assert student_client.post(course_url(course, "publish/")).status_code == 404


# ---------------------------------------------------------------- ปิด / เปิดคืน


def test_close_course(teacher_client: APIClient, teacher: User) -> None:
    """ปิดรายวิชา → is_closed true, AuditLog close_course, ข้อมูลการปิดอ่านจากบันทึก"""
    course = make_course(teacher, is_published=True)

    response = teacher_client.post(course_url(course, "close/"))

    assert response.status_code == 200
    assert response.data["is_closed"] is True
    assert response.data["closed_by"] == "กมล ศรีวงศ์"
    assert response.data["closed_at"] is not None
    log = AuditLog.objects.get()
    assert log.action == AuditAction.CLOSE_COURSE
    assert log.changes == {"is_closed": [False, True]}


def test_close_unpublished_course_is_allowed(teacher_client: APIClient, course: Course) -> None:
    """ปิดวิชาที่ยังไม่เผยแพร่ได้ (กันวิชาที่ทั้งลบและปิดไม่ได้ค้างอยู่)"""
    assert teacher_client.post(course_url(course, "close/")).data["is_closed"] is True


def test_close_twice_is_not_audited_again(teacher_client: APIClient, course: Course) -> None:
    teacher_client.post(course_url(course, "close/"))
    teacher_client.post(course_url(course, "close/"))

    assert AuditLog.objects.count() == 1


def test_teacher_cannot_reopen(teacher_client: APIClient, teacher: User) -> None:
    """ผู้สอนเปิดรายวิชาคืนไม่ได้ → 403"""
    course = make_course(teacher, is_published=True, is_closed=True)

    response = teacher_client.post(course_url(course, "reopen/"))

    assert response.status_code == 403
    course.refresh_from_db()
    assert course.is_closed is True


def test_admin_reopens_course(admin_client: APIClient, admin: User, teacher: User) -> None:
    """ผู้ดูแลระบบเปิดคืน → is_closed false, AuditLog update {is_closed: [true, false]}"""
    course = make_course(teacher, is_published=True, is_closed=True)

    response = admin_client.post(course_url(course, "reopen/"))

    assert response.status_code == 200
    assert response.data["is_closed"] is False
    assert response.data["closed_at"] is None
    log = AuditLog.objects.get()
    assert (log.action, log.actor, log.changes) == (
        AuditAction.UPDATE,
        admin,
        {"is_closed": [True, False]},
    )


def test_closed_info_shows_latest_close(
    admin_client: APIClient, teacher_client: APIClient, admin: User, teacher: User
) -> None:
    """ปิด → เปิดคืน → ปิดอีกครั้ง: ข้อมูลการปิดเป็นของครั้งล่าสุด"""
    course = make_course(teacher, is_published=True)
    teacher_client.post(course_url(course, "close/"))
    admin_client.post(course_url(course, "reopen/"))

    response = admin_client.post(course_url(course, "close/"))

    assert response.data["closed_by"] == "สุดา แก้วมณี"


# ---------------------------------------------------------------- รหัสเข้าร่วม


def test_enable_generates_code(teacher_client: APIClient, course: Course) -> None:
    """เปิดครั้งแรก → สุ่มรหัส 8 ตัว + จด {join_code_enabled, join_code}"""
    response = teacher_client.post(course_url(course, "join-code/enable/"))

    assert response.status_code == 200
    code = response.data["join_code"]
    assert response.data["join_code_enabled"] is True
    assert re.fullmatch(JOIN_CODE_PATTERN, code)
    assert AuditLog.objects.get().changes == {
        "join_code_enabled": [False, True],
        "join_code": [None, code],
    }


def test_disable_then_enable_keeps_code(teacher_client: APIClient, course: Course) -> None:
    """ปิดแล้วเปิดใหม่ → ใช้รหัสเดิม (ผู้สอนอาจแจ้งห้องไปแล้ว)"""
    code = teacher_client.post(course_url(course, "join-code/enable/")).data["join_code"]

    disabled = teacher_client.post(course_url(course, "join-code/disable/"))
    enabled = teacher_client.post(course_url(course, "join-code/enable/"))

    assert disabled.data["join_code_enabled"] is False
    assert disabled.data["join_code"] == code
    assert enabled.data["join_code"] == code
    assert AuditLog.objects.order_by("-id").first().changes == {"join_code_enabled": [False, True]}


def test_regenerate_replaces_code(teacher_client: APIClient, course: Course) -> None:
    """สุ่มใหม่ → รหัสเปลี่ยน + จด {join_code: [เดิม, ใหม่]}"""
    old = teacher_client.post(course_url(course, "join-code/enable/")).data["join_code"]

    response = teacher_client.post(course_url(course, "join-code/regenerate/"))

    new = response.data["join_code"]
    assert new != old
    assert response.data["join_code_enabled"] is True
    assert AuditLog.objects.order_by("-id").first().changes == {"join_code": [old, new]}


def test_disable_when_already_disabled_is_not_audited(
    teacher_client: APIClient, course: Course
) -> None:
    response = teacher_client.post(course_url(course, "join-code/disable/"))

    assert response.status_code == 200
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("action", ["enable/", "disable/", "regenerate/"])
def test_join_code_of_closed_course_is_locked(
    teacher_client: APIClient, teacher: User, action: str
) -> None:
    """วิชาที่ปิดแล้ว → 409 course_closed"""
    course = make_course(teacher, is_published=True, is_closed=True)

    assert teacher_client.post(course_url(course, f"join-code/{action}")).status_code == 409


def test_regenerate_retries_on_collision(teacher_client: APIClient, course: Course) -> None:
    """สุ่มได้รหัสที่อีกวิชาเพิ่งใช้พอดี (ฐานข้อมูลปฏิเสธ) → สุ่มใหม่แล้วสำเร็จ"""
    make_course(course.teacher, code="204212", join_code="AAAAAAAA")
    codes = iter(["AAAAAAAA", "BBBBBBBB"])

    # ตัวสุ่มจำลอง: ไม่ตรวจซ้ำก่อนบันทึก (เหมือนอีกคำขอแทรกเข้ามาพอดี) → ฐานข้อมูลเป็นคนกัน
    with mock.patch("academics.views.generate_join_code", side_effect=lambda: next(codes)):
        response = teacher_client.post(course_url(course, "join-code/regenerate/"))

    assert response.status_code == 200
    assert response.data["join_code"] == "BBBBBBBB"


def test_regenerate_gives_up_after_three_collisions(course: Course) -> None:
    """ชนครบ 3 ครั้ง → ยอมแพ้ (ไม่วนไม่รู้จบ) และไม่มีอะไรถูกบันทึก"""
    make_course(course.teacher, code="204212", join_code="AAAAAAAA")
    client = client_for(course.teacher)
    client.raise_request_exception = False

    with mock.patch("academics.views.generate_join_code", return_value="AAAAAAAA") as fake:
        response = client.post(course_url(course, "join-code/regenerate/"))

    assert response.status_code == 500
    assert fake.call_count == 3
    course.refresh_from_db()
    assert course.join_code is None
    assert not AuditLog.objects.exists()
