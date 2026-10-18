"""
เส้นทางของ API การลงทะเบียน (ขั้น 3.4) ; รายละเอียด docs/api.md §9
- course_patterns: ต่ออยู่ใต้ /api/v1/courses/ (config/urls.py) — ทำงานกับรายชื่อผู้เรียนของวิชา 1 วิชา
"""

from django.urls import path

from enrollment.views import (
    CandidateSearchView,
    CourseRosterView,
    DropEnrollmentView,
    JoinCourseView,
)

course_patterns = [
    # รายชื่อผู้เรียนในวิชา (แท็บผู้เรียน)
    path("<int:pk>/enrollments/", CourseRosterView.as_view(), name="course-enrollments"),
    # ค้นหาผู้เรียนเพื่อเพิ่ม (หน้าต่างเพิ่มผู้เรียน — ค้นหาทีละคน)
    path(
        "<int:pk>/enrollments/candidates/",
        CandidateSearchView.as_view(),
        name="course-enrollment-candidates",
    ),
    # ถอนผู้เรียน 1 คน
    path(
        "<int:pk>/enrollments/<int:enrollment_id>/drop/",
        DropEnrollmentView.as_view(),
        name="course-enrollment-drop",
    ),
]

# ผู้เรียนเข้าร่วมรายวิชาด้วยรหัส — ต่ออยู่ใต้ /api/v1/ (config/urls.py) เป็น /api/v1/enroll/
join_patterns = [
    path("enroll/", JoinCourseView.as_view(), name="enroll-with-code"),
]
