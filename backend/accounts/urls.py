"""
เส้นทาง URL ของ app accounts — ต่ออยู่ใต้ /api/v1/auth/ (config/urls.py)
"""

from django.urls import path

from accounts.views import (
    AvatarView,
    LoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    RefreshView,
)

urlpatterns = [
    # เข้าสู่ระบบด้วยอีเมล/รหัส + รหัสผ่าน
    path("login/", LoginView.as_view(), name="auth-login"),
    # แลก access token ใบใหม่ด้วย refresh token ใน cookie
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    # ออกจากระบบ (ยกเลิก refresh token + ลบ cookie)
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    # ข้อมูลของผู้ใช้ที่เข้าสู่ระบบอยู่ (GET) / แก้ชื่อ-อีเมล (PATCH)
    path("me/", MeView.as_view(), name="auth-me"),
    # เปลี่ยนรหัสผ่าน (อุปกรณ์อื่นออกจากระบบทันที)
    path("me/password/", PasswordChangeView.as_view(), name="auth-me-password"),
    # อัปโหลด/เปลี่ยน (POST) หรือลบ (DELETE) รูปประจำตัว
    path("me/avatar/", AvatarView.as_view(), name="auth-me-avatar"),
]
