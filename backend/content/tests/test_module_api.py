"""
test API หน่วยการเรียนของผู้สอน (ขั้น 4.3 ก) — ดูรายการ / เพิ่ม / แก้ / ลบ / เลื่อน / เผยแพร่
"""

import pytest
from rest_framework.test import APIClient

from academics.models import Course
from audit.models import AuditAction, AuditLog
from content.models import Content, Module
from content.tests.conftest import make_module, make_text, modules_url

pytestmark = pytest.mark.django_db


def test_list_returns_modules_in_order_with_contents(
    teacher_client: APIClient, course: Course
) -> None:
    """รายการเรียงตามลำดับ + เนื้อหาเรียงตามลำดับ ; เห็นทุกสถานะ (รวมที่ยังไม่เผยแพร่)"""
    second = make_module(course, "ฟังก์ชัน", order=1)
    first = make_module(course, "ก้าวแรก", order=0, is_published=True)
    make_text(first, "ข", order=1)
    make_text(first, "ก", order=0)

    response = teacher_client.get(modules_url(course))

    assert response.status_code == 200
    assert [m["id"] for m in response.data] == [first.pk, second.pk]
    assert [c["title"] for c in response.data[0]["contents"]] == ["ก", "ข"]
    assert response.data[1]["is_published"] is False
    assert response.data[1]["contents"] == []


def test_create_appends_unpublished(teacher_client: APIClient, course: Course) -> None:
    """หน่วยใหม่ต่อท้ายรายการ (ลำดับ = มากสุด + 1) และยังไม่เผยแพร่"""
    make_module(course, "เดิม", order=4)

    response = teacher_client.post(
        modules_url(course), {"title": "  โครงสร้างข้อมูล  ", "description": "ทูเพิล เซต"}
    )

    assert response.status_code == 201
    assert response.data["title"] == "โครงสร้างข้อมูล"
    assert response.data["order"] == 5
    assert response.data["is_published"] is False
    assert response.data["contents"] == []


@pytest.mark.parametrize(
    ("payload", "code"),
    [({}, "required"), ({"title": "   "}, "blank"), ({"title": "ก" * 201}, "max_length")],
)
def test_create_validates_title(
    teacher_client: APIClient, course: Course, payload: dict, code: str
) -> None:
    """ชื่อหน่วยบังคับ ห้ามว่าง ยาวไม่เกิน 200 ตัว"""
    response = teacher_client.post(modules_url(course), payload, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["title"] == [code]
    assert not Module.objects.exists()


def test_update_changes_only_sent_fields(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course, "เดิม", description="คำอธิบายเดิม")

    response = teacher_client.patch(modules_url(course, f"{module.pk}/"), {"title": "ใหม่"})

    assert response.status_code == 200
    module.refresh_from_db()
    assert (module.title, module.description) == ("ใหม่", "คำอธิบายเดิม")


def test_delete_cascades_and_logs_with_course_code(
    teacher_client: APIClient, teacher, course: Course
) -> None:
    """ลบหน่วย → เนื้อหาหายตาม + AuditLog delete จดชื่อพร้อมรหัสวิชาและจำนวนเนื้อหา"""
    module = make_module(course, "ฟังก์ชัน")
    make_text(module)
    make_text(module)

    response = teacher_client.delete(modules_url(course, f"{module.pk}/"))

    assert response.status_code == 204
    assert not Module.objects.exists()
    assert not Content.objects.exists()
    log = AuditLog.objects.get()
    assert log.action == AuditAction.DELETE
    assert log.actor == teacher
    assert log.object_repr == "ฟังก์ชัน (204111)"
    assert log.changes == {"title": ["ฟังก์ชัน", None], "content_count": [2, None]}


def test_publish_and_unpublish(teacher_client: APIClient, course: Course) -> None:
    """เผยแพร่ / ยกเลิก ; กดซ้ำสถานะเดิม = 200 เหมือนกัน ; ไม่จด AuditLog (จดเฉพาะการลบ)"""
    module = make_module(course)

    for action, expected in [("publish", True), ("publish", True), ("unpublish", False)]:
        response = teacher_client.post(modules_url(course, f"{module.pk}/{action}/"))
        assert response.status_code == 200
        assert response.data["is_published"] is expected
    assert not AuditLog.objects.exists()


def test_move_swaps_and_renumbers(teacher_client: APIClient, course: Course) -> None:
    """เลื่อนสลับกับตัวข้างเคียง แล้วเขียนลำดับใหม่ 0, 1, 2 (ลำดับเดิมซ้ำ / เว้นช่องได้)"""
    make_module(course, "ก", order=3)
    make_module(course, "ข", order=3)
    c = make_module(course, "ค", order=9)

    response = teacher_client.post(modules_url(course, f"{c.pk}/move/"), {"direction": "up"})

    assert response.status_code == 200
    assert response.data["order"] == 1
    assert list(Module.objects.order_by("order").values_list("title", flat=True)) == ["ก", "ค", "ข"]
    assert sorted(Module.objects.values_list("order", flat=True)) == [0, 1, 2]


def test_move_at_edges_keeps_order(teacher_client: APIClient, course: Course) -> None:
    """ตัวแรกกด ↑ / ตัวสุดท้ายกด ↓ → ไม่เปลี่ยน (200)"""
    first = make_module(course, "ก", order=0)
    last = make_module(course, "ข", order=1)

    assert (
        teacher_client.post(
            modules_url(course, f"{first.pk}/move/"), {"direction": "up"}
        ).status_code
        == 200
    )
    assert (
        teacher_client.post(
            modules_url(course, f"{last.pk}/move/"), {"direction": "down"}
        ).status_code
        == 200
    )
    assert list(Module.objects.order_by("order").values_list("title", flat=True)) == ["ก", "ข"]


def test_move_rejects_bad_direction(teacher_client: APIClient, course: Course) -> None:
    module = make_module(course)

    response = teacher_client.post(modules_url(course, f"{module.pk}/move/"), {"direction": "left"})

    assert response.status_code == 400
    assert response.data["fields"]["direction"] == ["invalid_choice"]
