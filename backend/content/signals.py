"""
ลบไฟล์บนที่เก็บไฟล์ตามเมื่อแถว Content ถูกลบ

- ทำงานทุกทางที่แถวถูกลบ: ลบเนื้อหาเอง, ลบหน่วยการเรียน หรือลบรายวิชาแล้วลบต่อเนื่อง (CASCADE)
  — Django ส่งสัญญาณ post_delete ให้ทุกแถวที่ถูกลบต่อเนื่องด้วย
- ลบไฟล์ **หลังฐานข้อมูลบันทึกเสร็จจริง** (on_commit) ถ้าการลบถูกยกเลิก ไฟล์ยังอยู่ → ข้อมูลกับไฟล์ไม่หลุดกัน
  (แบบเดียวกับการลบรูปประจำตัวเดิม — accounts/views.py)
- การ "เปลี่ยนไฟล์" ของแถวเดิม (ไฟล์เก่าต้องถูกลบ) ทำในชั้น API ขั้น 4.3
"""

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from content.models import Content


@receiver(post_delete, sender=Content, dispatch_uid="content_delete_file")
def delete_file_with_content(sender: type[Content], instance: Content, **kwargs: object) -> None:
    """แถวเนื้อหาถูกลบ → ลบไฟล์ของแถวนั้นหลังบันทึกเสร็จ (ไม่มีไฟล์ = ไม่ทำอะไร)"""
    name = instance.file_url.name
    if name:
        storage = instance.file_url.storage
        transaction.on_commit(lambda: storage.delete(name))
