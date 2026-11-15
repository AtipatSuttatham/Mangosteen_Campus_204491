"""
งานหลักของเนื้อหารายวิชา (ขั้น 4.3) — เรียกจาก views.py ภายใน transaction.atomic()
อ้างอิง: CLAUDE.md "การตัดสินใจก้อน 4" และ docs/api.md §10

ข้อตกลงที่ใช้ทุกฟังก์ชัน:
- หน่วย / เนื้อหาใหม่ต่อท้ายรายการ และยังไม่เผยแพร่
- เลื่อน ↑ ↓ = สลับกับตัวข้างเคียง 1 ตำแหน่ง แล้วเขียนลำดับใหม่ทั้งรายการเป็น 0, 1, 2, …
  (ลำดับซ้ำ / เว้นช่องจากของเดิมจะถูกจัดให้เรียบร้อยไปด้วย) ; ตัวแรกกด ↑ / ตัวสุดท้ายกด ↓ = ไม่เปลี่ยน
- ย้ายเนื้อหาไปหน่วยอื่น = ต่อท้ายหน่วยใหม่ (หน่วยต้องอยู่วิชาเดียวกัน — ตรวจใน views ผ่าน access.py)
- ชนิดเนื้อหาเปลี่ยนไม่ได้ — แก้ลิงก์แล้วชนิดเปลี่ยน (YouTube ↔ ลิงก์ทั่วไป) → content_kind_mismatch
- AuditLog จดเฉพาะการลบ (ข้อตกลงก้อน 4) พร้อมรหัสวิชาในชื่อ เช่น "ฟังก์ชัน (204111)"
  เพราะหลังลบแล้วสืบกลับไม่ได้ว่าเป็นของวิชาไหน
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Literal
from urllib.parse import quote

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Max, QuerySet
from rest_framework import status

from academics.models import Course
from accounts.models import User
from audit.models import AuditAction
from audit.services import log_action
from common.exceptions import ApiError
from content.file_types import inspect_upload
from content.models import Content, Module
from content.youtube import (
    YOUTUBE_DEFAULT_TITLE,
    site_name,
    youtube_video_id,
    youtube_watch_url,
)

Direction = Literal["up", "down"]

logger = logging.getLogger(__name__)


def next_order(siblings: QuerySet) -> int:
    """ลำดับของรายการใหม่ = ต่อท้าย (มากสุด + 1) ; ยังไม่มีรายการ = 0"""
    current = siblings.aggregate(top=Max("order"))["top"]
    return 0 if current is None else current + 1


def move(item: Module | Content, siblings: QuerySet, direction: Direction) -> None:
    """เลื่อนรายการขึ้น / ลง 1 ตำแหน่งในกลุ่มของมัน แล้วเขียนลำดับใหม่ทั้งกลุ่ม"""
    items = list(siblings.order_by("order", "id"))
    index = next(i for i, sibling in enumerate(items) if sibling.pk == item.pk)
    target = index - 1 if direction == "up" else index + 1
    if 0 <= target < len(items):
        items[index], items[target] = items[target], items[index]
    changed = []
    for position, sibling in enumerate(items):
        if sibling.order != position:
            sibling.order = position
            changed.append(sibling)
    if changed:
        type(item).objects.bulk_update(changed, ["order"])
    item.refresh_from_db(fields=["order"])


def set_published(item: Module | Content, value: bool) -> None:
    """เผยแพร่ / ยกเลิกการเผยแพร่ (เป็นแบบนั้นอยู่แล้ว = ไม่บันทึกซ้ำ)"""
    if item.is_published != value:
        item.is_published = value
        item.save(update_fields=["is_published", "updated_at"])


def deleted_repr(title: str, course: Course) -> str:
    """ชื่อที่จดใน AuditLog ตอนลบ: ชื่อ + รหัสวิชา"""
    return f"{title} ({course.code})"


# ---------- หน่วยการเรียน ----------


def create_module(course: Course, *, title: str, description: str = "") -> Module:
    """เพิ่มหน่วยต่อท้าย (ยังไม่เผยแพร่)"""
    return Module.objects.create(
        course=course,
        title=title,
        description=description,
        order=next_order(Module.objects.filter(course=course)),
    )


def update_module(module: Module, data: dict[str, Any]) -> None:
    """แก้ชื่อ / คำอธิบาย (เฉพาะช่องที่ส่งมา)"""
    fields = [name for name in ("title", "description") if name in data]
    for name in fields:
        setattr(module, name, data[name])
    if fields:
        module.save(update_fields=[*fields, "updated_at"])


def delete_module(user: User, course: Course, module: Module) -> None:
    """ลบหน่วย (เนื้อหาในหน่วย + ไฟล์หายตาม) + จด AuditLog พร้อมจำนวนเนื้อหาที่หายตาม"""
    content_count = module.contents.count()
    log_action(
        actor=user,
        action=AuditAction.DELETE,
        target=module,
        object_repr=deleted_repr(module.title, course),
        changes={"title": [module.title, None], "content_count": [content_count, None]},
    )
    module.delete()


def move_module(course: Course, module: Module, direction: Direction) -> None:
    move(module, Module.objects.filter(course=course), direction)


# ---------- เนื้อหา ----------


def create_text(module: Module, *, title: str, body: str = "") -> Content:
    """เนื้อหาแบบข้อความ (Markdown) ต่อท้ายหน่วย"""
    return Content.objects.create(
        module=module,
        title=title,
        content_type=Content.Kind.TEXT,
        body=body,
        order=next_order(module.contents.all()),
    )


def link_kind_and_url(url: str) -> tuple[str, str]:
    """ชนิด + ลิงก์ที่จะเก็บ: YouTube → (video, ลิงก์มาตรฐาน) ; อื่น ๆ → (link, ลิงก์ตามที่วาง)"""
    video_id = youtube_video_id(url)
    if video_id:
        return Content.Kind.VIDEO, youtube_watch_url(video_id)
    return Content.Kind.LINK, url.strip()


def create_link(module: Module, *, url: str, title: str = "", body: str = "") -> Content:
    """เพิ่มลิงก์ — ระบบรู้เองว่าเป็น YouTube ; ไม่กรอกหัวข้อ → "วิดีโอจาก YouTube" / ชื่อเว็บไซต์"""
    kind, stored_url = link_kind_and_url(url)
    if not title:
        title = YOUTUBE_DEFAULT_TITLE if kind == Content.Kind.VIDEO else site_name(stored_url)
    return Content.objects.create(
        module=module,
        title=title[:200],
        content_type=kind,
        body=body,
        external_url=stored_url,
        order=next_order(module.contents.all()),
    )


def update_content(content: Content, data: dict[str, Any], *, new_module: Module | None) -> None:
    """
    แก้เนื้อหา (เฉพาะช่องที่ส่งมา): หัวข้อ, เนื้อความ / คำอธิบาย, ให้ดาวน์โหลด, ลิงก์, ย้ายหน่วย
    - ลิงก์ (url): ใช้ได้กับเนื้อหาที่เป็นลิงก์อยู่แล้ว และชนิดต้องไม่เปลี่ยน
    - new_module: หน่วยปลายทาง (ตรวจแล้วว่าอยู่วิชาเดียวกัน) → ไปต่อท้ายหน่วยนั้น
    """
    fields: list[str] = []
    for name in ("title", "body", "allow_download"):
        if name in data:
            setattr(content, name, data[name])
            fields.append(name)

    if "url" in data:
        kind, stored_url = link_kind_and_url(data["url"])
        if not content.external_url or kind != content.content_type:
            raise ApiError(
                "content_kind_mismatch",
                "The content type cannot change (YouTube video vs. other link, or not a link).",
                status_code=status.HTTP_409_CONFLICT,
            )
        content.external_url = stored_url
        fields.append("external_url")

    if new_module is not None and new_module.pk != content.module_id:
        content.order = next_order(new_module.contents.all())
        content.module = new_module
        fields += ["module", "order"]

    if fields:
        content.save(update_fields=[*fields, "updated_at"])


def delete_content(user: User, course: Course, content: Content) -> None:
    """ลบเนื้อหา (ไฟล์หายตามหลังบันทึกเสร็จ — signals.py) + จด AuditLog"""
    log_action(
        actor=user,
        action=AuditAction.DELETE,
        target=content,
        object_repr=deleted_repr(content.title, course),
        changes={
            "title": [content.title, None],
            "content_type": [content.content_type, None],
            "module": [content.module_id, None],
        },
    )
    content.delete()


def move_content(content: Content, direction: Direction) -> None:
    move(content, Content.objects.filter(module_id=content.module_id), direction)


# ---------- ไฟล์ (ขั้น 4.3 ข) ----------


@contextmanager
def remove_files_on_failure() -> Iterator[list[str]]:
    """
    ลบไฟล์ที่เพิ่งเก็บทิ้ง ถ้างานที่ตามมาไม่สำเร็จ (เรื่องที่ส่งต่อจากขั้น 4.2)

    Django เก็บไฟล์ลงที่เก็บไฟล์ "ก่อน" บันทึกแถว ถ้าบันทึกแถวไม่ผ่าน (กฎในฐานข้อมูล / transaction
    ถูกยกเลิก) ไฟล์จะค้างโดยไม่มีแถวอ้างถึง — ใช้ครอบ transaction.atomic() ทั้งก้อนใน views.py:
        with remove_files_on_failure() as stored, transaction.atomic(): ...
    ฟังก์ชันที่เก็บไฟล์ใส่ชื่อไฟล์ลงใน stored ; มี error หลุดออกมา → ลบทุกไฟล์ในรายการแล้วส่ง error ต่อ
    """
    stored: list[str] = []
    try:
        yield stored
    except BaseException:
        for name in stored:
            try:
                default_storage.delete(name)
            except Exception:  # ลบไม่ได้ก็ไม่ปิดบัง error เดิม — บันทึกไว้ให้นักพัฒนาดู
                logger.exception("Could not remove orphan upload %s", name)
        raise


def _store(content: Content, upload: UploadedFile, stored: list[str]) -> None:
    """เก็บไฟล์ลงที่เก็บไฟล์ (ชื่อสุ่ม — uploads.py) ; เก็บไม่สำเร็จ (เช่น B2 เต็ม) → file_upload_failed (กน1)"""
    try:
        content.file_url.save(upload.name or "file", upload, save=False)
    except Exception as error:
        logger.exception("Storing an uploaded content file failed")
        raise ApiError(
            "file_upload_failed",
            "The file could not be stored (storage may be full or unavailable).",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from error
    stored.append(content.file_url.name)


def create_file(
    module: Module, upload: UploadedFile, stored: list[str], *, title: str = "", body: str = ""
) -> Content:
    """
    อัปโหลด 1 ไฟล์เป็นเนื้อหาใหม่ต่อท้ายหน่วย — ระบบตั้งชนิดเองจากไฟล์ (file_types.py)
    ไม่กรอกหัวข้อ → ชื่อไฟล์ตัดนามสกุล ; ยังไม่เผยแพร่ ; ให้ดาวน์โหลดได้เป็นค่าเริ่มต้น
    """
    info = inspect_upload(upload)
    content = Content(
        module=module,
        title=title or info.title,
        content_type=info.kind,
        body=body,
        order=next_order(module.contents.all()),
        file_name=info.name,
        file_size=info.size,
        mime_type=info.mime,
    )
    _store(content, upload, stored)
    content.save()
    return content


def replace_file(content: Content, upload: UploadedFile, stored: list[str]) -> None:
    """
    เปลี่ยนไฟล์ของเนื้อหาเดิม — ไฟล์ใหม่ต้องเป็นชนิดเดิม ; หัวข้อเดิมคงไว้ (กธ1)
    ไฟล์เก่าถูกลบหลังบันทึกเสร็จ (ยกเลิกกลางทาง = ไฟล์เก่ายังอยู่ ไฟล์ใหม่ถูกลบทิ้ง)
    เนื้อหาที่ไม่มีไฟล์ (ข้อความ / ลิงก์ / วิดีโอ YouTube) → content_kind_mismatch
    """
    info = inspect_upload(upload)
    if not content.has_file or info.kind != content.content_type:
        raise ApiError(
            "content_kind_mismatch",
            "The new file must be the same kind as the current one.",
            status_code=status.HTTP_409_CONFLICT,
        )
    old_name = content.file_url.name
    storage = content.file_url.storage
    _store(content, upload, stored)
    content.file_name = info.name
    content.file_size = info.size
    content.mime_type = info.mime
    content.save(update_fields=["file_url", "file_name", "file_size", "mime_type", "updated_at"])
    transaction.on_commit(lambda: storage.delete(old_name))


def download_url(content: Content) -> str | None:
    """
    ลิงก์ดาวน์โหลดที่ได้ชื่อไฟล์เดิม (Content-Disposition: attachment)
    - ที่เก็บไฟล์แบบ S3 / B2 (django-storages ตอน deploy) รับ parameters → ลิงก์ชั่วคราวที่สั่งให้บันทึกไฟล์
    - ที่เก็บไฟล์ในเครื่องตอนพัฒนาไม่รับ → ลิงก์ปกติ (หน้าเว็บใส่ชื่อเดิมด้วย <a download> เพราะโดเมนเดียวกัน)
    """
    if not content.has_file:
        return None
    disposition = f"attachment; filename*=UTF-8''{quote(content.file_name)}"
    try:
        return content.file_url.storage.url(
            content.file_url.name, parameters={"ResponseContentDisposition": disposition}
        )
    except TypeError:
        return content.file_url.url
