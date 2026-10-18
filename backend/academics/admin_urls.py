"""
เส้นทางของ API รายวิชาสำหรับผู้ดูแลระบบ — ต่ออยู่ใต้ /api/v1/admin/ (config/urls.py) ; docs/api.md §8
(จัดการวิชา 1 วิชาใช้ที่อยู่เดียวกับผู้สอน /api/v1/courses/{id}/… — ผู้ดูแลระบบทำแทนได้ทุกวิชา)
"""

from django.urls import path

from academics.views import AdminCourseListView, AdminTermListView

urlpatterns = [
    # รายวิชาทั้งระบบ + ค้นหา / กรอง / แบ่งหน้า
    path("courses/", AdminCourseListView.as_view(), name="admin-course-list"),
    # ภาคเรียนที่มีรายวิชาอยู่ (ตัวเลือกของตัวกรอง)
    path("courses/terms/", AdminTermListView.as_view(), name="admin-course-terms"),
]
