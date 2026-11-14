"""
test ของตาราง Module / Content (content/models.py) — ค่าเริ่มต้น, ลำดับ, กฎที่ฐานข้อมูลบังคับ,
การลบต่อเนื่อง, ชื่อไฟล์ที่เก็บ (uploads.py) และการลบไฟล์ตามแถว (signals.py)
"""

from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction

from academics.models import Course
from accounts.models import User
from content.models import Content, Module
from content.uploads import content_upload_path, safe_extension

pytestmark = pytest.mark.django_db


@pytest.fixture
def media_in_tmp(settings, tmp_path: Path) -> Path:
    """เก็บไฟล์ที่อัปโหลดใน test ไว้ในโฟลเดอร์ชั่วคราว (ไม่ปน backend/media/)"""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def course() -> Course:
    """รายวิชาสมมติ 204111"""
    teacher = User.objects.create_user(
        email="teacher@example.com", password="x-strong-pass-1", role=User.Role.TEACHER
    )
    return Course.objects.create(
        academic_year=2569, semester=1, code="204111", name="Python พื้นฐาน", teacher=teacher
    )


@pytest.fixture
def module(course: Course) -> Module:
    """หน่วยการเรียนสมมติ 1 หน่วย"""
    return Module.objects.create(course=course, title="โครงสร้างควบคุมทิศทาง", order=3)


def make_file_content(
    module: Module, kind: str = "file", name: str = "slides.pdf", **fields
) -> Content:
    """สร้างเนื้อหาที่มีไฟล์จริง (บันทึกไฟล์ลงที่เก็บไฟล์ตอน save)"""
    content = Content(
        module=module,
        title=fields.pop("title", "สไลด์"),
        content_type=kind,
        file_name=name,
        file_size=4,
        mime_type="application/pdf",
        **fields,
    )
    content.file_url.save(name, ContentFile(b"%PDF"), save=False)
    content.save()
    return content


def assert_rejected(**fields) -> None:
    """ฐานข้อมูลต้องไม่ยอมบันทึก (atomic กันไม่ให้ transaction ของ test เสีย)"""
    with pytest.raises(IntegrityError), transaction.atomic():
        Content.objects.create(**fields)


# ---------- ค่าเริ่มต้น / ลำดับ ----------


def test_new_module_and_content_defaults(module: Module) -> None:
    """หน่วยและเนื้อหาใหม่ยังไม่เผยแพร่ ; ไฟล์เปิดให้ดาวน์โหลดเป็นค่าเริ่มต้น"""
    content = Content.objects.create(module=module, title="สรุป", content_type="text", body="# หัวข้อ")

    assert module.is_published is False
    assert module.description == ""
    assert content.is_published is False
    assert content.allow_download is True
    assert content.has_file is False
    assert content.file_size is None
    assert str(module) == "โครงสร้างควบคุมทิศทาง"
    assert str(content) == "สรุป"


def test_ordering_by_order_then_id(course: Course) -> None:
    """เรียงตาม order ; order เท่ากันใช้ลำดับที่สร้าง"""
    second = Module.objects.create(course=course, title="ข", order=2)
    first = Module.objects.create(course=course, title="ก", order=1)
    tie = Module.objects.create(course=course, title="ค", order=2)

    assert list(course.modules.all()) == [first, second, tie]


# ---------- ข้อมูลต้องตรงกับชนิด ----------


def test_valid_shapes_per_type(module: Module, media_in_tmp: Path) -> None:
    """ทุกชนิดบันทึกได้เมื่อข้อมูลตรงชนิด รวมวิดีโอทั้งแบบอัปโหลดและแบบ YouTube"""
    Content.objects.create(module=module, title="ข้อความ", content_type="text", body="เนื้อความ")
    Content.objects.create(
        module=module, title="ลิงก์", content_type="link", external_url="https://docs.python.org/"
    )
    Content.objects.create(
        module=module,
        title="YouTube",
        content_type="video",
        external_url="https://www.youtube.com/watch?v=abc",
    )
    for kind in ("file", "image", "audio", "video"):
        make_file_content(module, kind=kind)

    assert module.contents.count() == 7


def test_unknown_type_rejected(module: Module) -> None:
    assert_rejected(module=module, title="?", content_type="slides")


def test_text_cannot_have_file_or_link(module: Module) -> None:
    assert_rejected(
        module=module, title="x", content_type="text", external_url="https://example.com/"
    )
    assert_rejected(
        module=module,
        title="x",
        content_type="text",
        file_url="content/1/a.pdf",
        file_name="a.pdf",
        file_size=1,
    )


def test_link_needs_url_and_no_file(module: Module) -> None:
    assert_rejected(module=module, title="x", content_type="link")
    assert_rejected(
        module=module,
        title="x",
        content_type="link",
        external_url="https://example.com/",
        file_url="content/1/a.pdf",
        file_name="a.pdf",
        file_size=1,
    )


def test_file_types_need_file_and_no_link(module: Module) -> None:
    for kind in ("file", "image", "audio"):
        assert_rejected(module=module, title="x", content_type=kind)
        assert_rejected(module=module, title="x", content_type=kind, external_url="https://e.com/")


def test_video_needs_exactly_one_source(module: Module) -> None:
    """วิดีโอต้องมีไฟล์ หรือ ลิงก์ อย่างใดอย่างหนึ่ง — ไม่มีเลย / มีทั้งสองไม่ได้"""
    assert_rejected(module=module, title="x", content_type="video")
    assert_rejected(
        module=module,
        title="x",
        content_type="video",
        external_url="https://www.youtube.com/watch?v=abc",
        file_url="content/1/a.mp4",
        file_name="a.mp4",
        file_size=1,
    )


def test_file_metadata_must_match_file(module: Module) -> None:
    """มีไฟล์ต้องมีชื่อเดิม + ขนาด ; ไม่มีไฟล์ต้องไม่มีข้อมูลไฟล์ค้าง"""
    assert_rejected(
        module=module, title="x", content_type="file", file_url="content/1/a.pdf", file_size=1
    )
    assert_rejected(
        module=module, title="x", content_type="file", file_url="content/1/a.pdf", file_name="a.pdf"
    )
    assert_rejected(module=module, title="x", content_type="text", file_name="a.pdf")
    assert_rejected(module=module, title="x", content_type="text", file_size=10)


# ---------- ลบต่อเนื่อง ----------


def test_deleting_module_or_course_cascades(course: Course, module: Module) -> None:
    """ลบหน่วย → เนื้อหาหายตาม ; ลบรายวิชา → หน่วยและเนื้อหาหายตาม"""
    Content.objects.create(module=module, title="ก", content_type="text")
    other = Module.objects.create(course=course, title="อีกหน่วย")
    Content.objects.create(module=other, title="ข", content_type="text")

    module.delete()
    assert Content.objects.count() == 1

    course.delete()
    assert Module.objects.count() == 0
    assert Content.objects.count() == 0


# ---------- ชื่อไฟล์บนที่เก็บไฟล์ ----------


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("slides.PDF", ".pdf"),
        ("บทที่3-ลูป.pptx", ".pptx"),
        ("archive.tar.gz", ".gz"),
        ("noext", ""),
        ("weird.p$f", ""),
        ("long.abcdefghijk", ""),
        ("C:\\Users\\a\\code.py", ".py"),
    ],
)
def test_safe_extension(filename: str, expected: str) -> None:
    assert safe_extension(filename) == expected


def test_upload_path_is_random_per_course(module: Module) -> None:
    """ตำแหน่งไฟล์ = content/<id วิชา>/<ชื่อสุ่ม>.<นามสกุล> ; อัปโหลดชื่อเดิมซ้ำได้ชื่อใหม่ทุกครั้ง"""
    instance = Content(module=module)
    first = content_upload_path(instance, "สไลด์ บทที่ 3.PDF")
    second = content_upload_path(instance, "สไลด์ บทที่ 3.PDF")

    assert first.startswith(f"content/{module.course_id}/")
    assert first.endswith(".pdf")
    assert "สไลด์" not in first
    assert first != second


def test_saved_file_keeps_original_name_separately(module: Module, media_in_tmp: Path) -> None:
    """ไฟล์ถูกเก็บด้วยชื่อสุ่ม ส่วนชื่อเดิมอยู่ใน file_name"""
    content = make_file_content(module, name="while-for-loop.pdf")

    assert content.file_name == "while-for-loop.pdf"
    assert "while-for-loop" not in content.file_url.name
    assert (media_in_tmp / content.file_url.name).read_bytes() == b"%PDF"


# ---------- ลบไฟล์ตามแถว ----------


def test_deleting_content_removes_file_after_commit(
    module: Module, media_in_tmp: Path, django_capture_on_commit_callbacks
) -> None:
    """ลบเนื้อหา → ไฟล์ถูกลบหลังบันทึกเสร็จ"""
    content = make_file_content(module)
    stored = media_in_tmp / content.file_url.name

    with django_capture_on_commit_callbacks(execute=True):
        content.delete()

    assert not stored.exists()


def test_cascade_delete_removes_files(
    course: Course, module: Module, media_in_tmp: Path, django_capture_on_commit_callbacks
) -> None:
    """ลบรายวิชา → ไฟล์ของเนื้อหาทุกชิ้นในทุกหน่วยถูกลบด้วย (ไม่มีไฟล์ค้าง)"""
    other = Module.objects.create(course=course, title="อีกหน่วย")
    stored = [
        media_in_tmp / make_file_content(module).file_url.name,
        media_in_tmp / make_file_content(other, kind="image", name="a.png").file_url.name,
    ]
    Content.objects.create(module=module, title="ข้อความ", content_type="text")

    with django_capture_on_commit_callbacks(execute=True):
        course.delete()

    assert not any(path.exists() for path in stored)


def test_rolled_back_delete_keeps_file(module: Module, media_in_tmp: Path) -> None:
    """การลบถูกยกเลิก (rollback) → แถวและไฟล์ยังอยู่ทั้งคู่"""
    content = make_file_content(module)
    stored = media_in_tmp / content.file_url.name

    with pytest.raises(RuntimeError), transaction.atomic():
        Content.objects.filter(pk=content.pk).get().delete()
        raise RuntimeError("ยกเลิก")

    assert Content.objects.filter(pk=content.pk).exists()
    assert stored.exists()
