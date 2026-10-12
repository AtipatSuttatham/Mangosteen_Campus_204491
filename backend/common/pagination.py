"""
ตัวแบ่งหน้ากลางของ API ทั้งระบบ (อ้างอิง: docs/api.md §2) — ตั้งเป็นค่าเริ่มต้นใน settings.REST_FRAMEWORK

รูปแบบคำตอบของรายการที่แบ่งหน้า:
    {
        "count": 134,                        ← จำนวนทั้งหมด (ทุกหน้ารวมกัน)
        "next": "...?page=3",               ← ลิงก์หน้าถัดไป (หน้าสุดท้าย = null)
        "previous": "...?page=1",           ← ลิงก์หน้าก่อนหน้า (หน้าแรก = null)
        "results": [ ... ]                   ← ข้อมูลของหน้านี้
    }
ขอหน้าด้วย ?page=N (เริ่มที่ 1) ; ขอหน้าที่ไม่มีอยู่ → 404 not_found
"""

from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """แบ่งหน้าละ 20 รายการ (ตามการตัดสินใจก้อน 2 — หน้ารายชื่อผู้ใช้) ; ผู้เรียกปรับจำนวนเองไม่ได้"""

    # จำนวนรายการต่อหน้า
    page_size = 20
    # ชื่อพารามิเตอร์เลขหน้าในที่อยู่
    page_query_param = "page"
