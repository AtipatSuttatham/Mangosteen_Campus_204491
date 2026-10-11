"""
เส้นทาง URL ของ app accounts — ต่ออยู่ใต้ /api/v1/auth/ (config/urls.py)
"""

from django.urls import path

from accounts.views import LoginView, LogoutView, MeView, RefreshView

urlpatterns = [
    # เข้าสู่ระบบด้วยอีเมล/รหัส + รหัสผ่าน
    path("login/", LoginView.as_view(), name="auth-login"),
    # แลก access token ใบใหม่ด้วย refresh token ใน cookie
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    # ออกจากระบบ (ยกเลิก refresh token + ลบ cookie)
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    # ข้อมูลของผู้ใช้ที่เข้าสู่ระบบอยู่
    path("me/", MeView.as_view(), name="auth-me"),
]
