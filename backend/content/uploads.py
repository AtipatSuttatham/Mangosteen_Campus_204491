"""
ตั้งชื่อไฟล์ที่อาจารย์อัปโหลดเป็นเนื้อหา (ใช้เป็น upload_to ของ Content.file_url)

- ชื่อไฟล์บนที่เก็บไฟล์ = **ชื่อสุ่ม** (uuid4) ไม่ใช้ชื่อเดิม: กันชื่อชนกัน, กันชื่อแปลก ๆ / อักขระพิเศษ
  และไม่เปิดเผยชื่อเดิมในลิงก์ ; ชื่อเดิมเก็บใน Content.file_name ไว้ตั้งชื่อตอนดาวน์โหลด
- แยกโฟลเดอร์ตามรายวิชา `content/<id วิชา>/` — ดูได้ง่ายว่าไฟล์เป็นของวิชาไหน
- นามสกุลเก็บเป็นตัวพิมพ์เล็ก ; นามสกุลแปลก (ไม่ใช่ a–z 0–9 หรือยาวเกิน 10 ตัว) ตัดทิ้ง
  (ชนิดไฟล์ที่ยอมรับตรวจในชั้น API ขั้น 4.3 — ตรงนี้แค่ตั้งชื่อให้ปลอดภัย)
"""

import re
import uuid
from pathlib import PurePosixPath
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from content.models import Content

# นามสกุลที่ยอมใช้ในชื่อไฟล์: จุด + a–z / 0–9 ไม่เกิน 10 ตัว
_SAFE_EXTENSION = re.compile(r"^\.[a-z0-9]{1,10}$")


def safe_extension(filename: str) -> str:
    """นามสกุลของชื่อไฟล์เดิมแบบตัวพิมพ์เล็ก เช่น ".PDF" → ".pdf" ; ไม่มี / แปลก → "" """
    extension = PurePosixPath(filename.replace("\\", "/")).suffix.lower()
    return extension if _SAFE_EXTENSION.match(extension) else ""


def content_upload_path(instance: "Content", filename: str) -> str:
    """ตำแหน่งไฟล์ใหม่ เช่น `content/12/3f2a…9c.pdf` (12 = id รายวิชา)"""
    course_id = instance.module.course_id
    return f"content/{course_id}/{uuid.uuid4().hex}{safe_extension(filename)}"
