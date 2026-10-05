"""
รวมเส้นทาง URL ทั้งหมดของ backend

- /admin/        หน้า Django admin (สำหรับผู้พัฒนา/ผู้ดูแลระบบระดับเทคนิค)
- /api/health/   ตรวจสุขภาพระบบ (ระบบทำงาน + เชื่อมฐานข้อมูลได้)
API ของฟีเจอร์ต่าง ๆ จะอยู่ใต้ /api/v1/ (เพิ่มในขั้น 0.5 เป็นต้นไป)
"""

from django.contrib import admin
from django.urls import path

from common.views import health_check

urlpatterns = [
    # หน้า Django admin
    path("admin/", admin.site.urls),
    # endpoint ตรวจสุขภาพระบบ — อยู่นอก /api/v1/ เพราะเป็นของระบบ ไม่ใช่ API ของฟีเจอร์
    path("api/health/", health_check, name="health-check"),
]
