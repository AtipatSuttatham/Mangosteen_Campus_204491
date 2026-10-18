"""
เส้นทางของ API รายวิชา — ต่ออยู่ใต้ /api/v1/courses/ (config/urls.py) ; รายละเอียด docs/api.md §8
"""

from django.urls import path

from academics.views import CourseDetailView, CourseStatusView, JoinCodeView, MyCourseListView

urlpatterns = [
    # รายวิชาของฉัน (ผู้สอน / ผู้เรียน) + สร้างรายวิชา
    path("", MyCourseListView.as_view(), name="course-list"),
    # ดู / แก้ / ลบ วิชา 1 วิชา
    path("<int:pk>/", CourseDetailView.as_view(), name="course-detail"),
    # ปุ่มเปลี่ยนสถานะ (ตัวทำงานเดียวกัน ต่างกันที่ช่องและค่าปลายทาง)
    path(
        "<int:pk>/publish/",
        CourseStatusView.as_view(field="is_published", value=True),
        name="course-publish",
    ),
    path(
        "<int:pk>/unpublish/",
        CourseStatusView.as_view(field="is_published", value=False),
        name="course-unpublish",
    ),
    path(
        "<int:pk>/close/",
        CourseStatusView.as_view(field="is_closed", value=True),
        name="course-close",
    ),
    # เปิดรายวิชาคืน — ผู้ดูแลระบบเท่านั้น
    path(
        "<int:pk>/reopen/",
        CourseStatusView.as_view(field="is_closed", value=False),
        name="course-reopen",
    ),
    # รหัสเข้าร่วม: เปิด / ปิด / สุ่มใหม่
    path(
        "<int:pk>/join-code/enable/",
        JoinCodeView.as_view(action="enable"),
        name="course-join-code-enable",
    ),
    path(
        "<int:pk>/join-code/disable/",
        JoinCodeView.as_view(action="disable"),
        name="course-join-code-disable",
    ),
    path(
        "<int:pk>/join-code/regenerate/",
        JoinCodeView.as_view(action="regenerate"),
        name="course-join-code-regenerate",
    ),
]
