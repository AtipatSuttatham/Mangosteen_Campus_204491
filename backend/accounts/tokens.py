"""
ตัวช่วยเรื่อง token และ cookie ของการเข้าสู่ระบบ (ใช้ใน accounts/views.py)

ภาพรวม (docs/api.md §6):
- access token (15 นาที) → ส่งกลับใน JSON ให้หน้าเว็บถือไว้ในหน่วยความจำ
- refresh token (7 วัน)  → เก็บใน httpOnly cookie (JavaScript อ่านไม่ได้) ใช้แลก access token ใบใหม่
"""

from django.conf import settings
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User


def issue_refresh_token(user: User) -> RefreshToken:
    """
    ออก refresh token ใบใหม่ให้ผู้ใช้ พร้อมใส่บทบาท (role) ไว้ใน token
    access token ที่สร้างจากใบนี้จะมี role ติดไปด้วย (docs/database.md §3)
    ระบบบันทึกทุกใบที่ออกไว้ในตาราง OutstandingToken (ใช้ยกเลิกทีหลังได้)
    """
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    return refresh


def set_refresh_cookie(response: Response, refresh: RefreshToken) -> None:
    """แนบ refresh token ไปกับคำตอบเป็น httpOnly cookie (ค่าตั้งอยู่ใน settings: REFRESH_COOKIE_*)"""
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(refresh),
        # อายุ cookie = อายุ refresh token (7 วัน) → ปิดเบราว์เซอร์แล้วเปิดใหม่ยังอยู่ในระบบ
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=settings.REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def delete_refresh_cookie(response: Response) -> None:
    """สั่งเบราว์เซอร์ลบ cookie ของ refresh token (ต้องใช้ path/samesite เดียวกับตอนตั้ง)"""
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )
