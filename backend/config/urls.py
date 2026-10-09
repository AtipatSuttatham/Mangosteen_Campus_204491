"""
รวมเส้นทาง URL ทั้งหมดของ backend (อ้างอิงรูปแบบ: docs/api.md)

- /admin/        หน้า Django admin (สำหรับผู้พัฒนา/ผู้ดูแลระบบระดับเทคนิค)
- /api/health/   ตรวจสุขภาพระบบ (ระบบทำงาน + เชื่อมฐานข้อมูลได้) — ของระบบ จึงอยู่นอก v1
- /api/v1/...    API ของฟีเจอร์ทั้งหมด (เพิ่มเส้นทางของแต่ละ app ใน api_v1_patterns)
- /api/อื่น ๆ     ที่อยู่ API ที่ไม่มีอยู่จริง → ตอบ 404 ในรูปแบบ error กลาง (JSON)
"""

from django.contrib import admin
from django.urls import include, path, re_path

from common.views import api_not_found, health_check

# เส้นทางของ API เวอร์ชัน 1 — แต่ละ app เพิ่มเส้นทางของตัวเองที่นี่ตอนทำฟีเจอร์
# ตัวอย่าง (ก้อน 1):  path("auth/", include("accounts.urls")),
api_v1_patterns: list = []

urlpatterns = [
    # หน้า Django admin
    path("admin/", admin.site.urls),
    # endpoint ตรวจสุขภาพระบบ — อยู่นอก /api/v1/ เพราะเป็นของระบบ ไม่ใช่ API ของฟีเจอร์
    path("api/health/", health_check, name="health-check"),
    # API ของฟีเจอร์ทั้งหมด
    path("api/v1/", include(api_v1_patterns)),
    # ต้องอยู่ท้ายสุด: ที่อยู่ใต้ /api/ ที่ไม่ตรงกับเส้นทางใดเลย → 404 แบบ JSON
    re_path(r"^api/(?P<unknown_path>.*)$", api_not_found, name="api-not-found"),
]
