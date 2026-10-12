"""
เส้นทาง URL ของ API จัดการบัญชีผู้ใช้ (ผู้ดูแลระบบ — ขั้น 2.3) — ต่ออยู่ใต้ /api/v1/admin/ (config/urls.py)
"""

from django.urls import path

from accounts.manage_views import AdminUserDetailView, AdminUserListView

urlpatterns = [
    # รายชื่อผู้ใช้ (ค้นหา / กรอง / แบ่งหน้า)
    path("users/", AdminUserListView.as_view(), name="admin-users"),
    # ข้อมูลบัญชี 1 คน
    path("users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
]
