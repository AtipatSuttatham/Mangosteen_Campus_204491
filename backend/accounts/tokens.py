"""
ตัวช่วยเรื่อง token และ cookie ของการเข้าสู่ระบบ (ใช้ใน accounts/views.py)

ภาพรวม (docs/api.md §6):
- access token (15 นาที) → ส่งกลับใน JSON ให้หน้าเว็บถือไว้ในหน่วยความจำ
- refresh token (7 วัน)  → เก็บใน httpOnly cookie (JavaScript อ่านไม่ได้) ใช้แลก access token ใบใหม่
"""

from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User

# ชื่อช่องใน token ที่เก็บ "ลายนิ้วมือของรหัสผ่าน" (ขั้น 1.7)
PASSWORD_CLAIM = "pwd"
# ความยาวลายนิ้วมือที่เก็บ (ตัวอักษรฐาน 16) — 16 ตัว = 64 บิต พอสำหรับเทียบ และไม่ทำให้ token ยาว
_FINGERPRINT_LENGTH = 16


def password_fingerprint(user: User) -> str:
    """
    "ลายนิ้วมือของรหัสผ่าน" ปัจจุบันของผู้ใช้ — เปลี่ยนทันทีเมื่อรหัสผ่านเปลี่ยน

    ใช้ get_session_auth_hash() มาตรฐานของ Django (วิธีเดียวกับที่ Django ใช้ให้ session เดิม
    หลุดเมื่อเปลี่ยนรหัส): ค่า HMAC ของรหัสผ่านที่เข้ารหัสแล้ว + SECRET_KEY
    → อ่านย้อนกลับเป็นรหัสผ่านไม่ได้ และคนนอกปลอมไม่ได้
    """
    return user.get_session_auth_hash()[:_FINGERPRINT_LENGTH]


def password_fingerprint_matches(user: User, claim: object) -> bool:
    """
    บัตรใบนี้ออกหลังการเปลี่ยนรหัสผ่านครั้งล่าสุดหรือไม่ (ลายนิ้วมือในบัตรตรงกับรหัสปัจจุบัน)
    บัตรที่ไม่มีลายนิ้วมือ (ออกก่อนขั้น 1.7) → ไม่ตรง → ต้องเข้าสู่ระบบใหม่ 1 ครั้ง
    """
    return isinstance(claim, str) and constant_time_compare(claim, password_fingerprint(user))


def issue_refresh_token(user: User) -> RefreshToken:
    """
    ออก refresh token ใบใหม่ให้ผู้ใช้ พร้อมใส่บทบาท (role) และลายนิ้วมือของรหัสผ่านไว้ใน token
    access token ที่สร้างจากใบนี้จะมีทั้งสองค่าติดไปด้วย (docs/database.md §3, docs/api.md §6)
    ระบบบันทึกทุกใบที่ออกไว้ในตาราง OutstandingToken (ใช้ยกเลิกทีหลังได้)
    """
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    refresh[PASSWORD_CLAIM] = password_fingerprint(user)
    return refresh


def revoke_all_refresh_tokens(user: User) -> None:
    """
    ยกเลิก refresh token ทุกใบของผู้ใช้ (ขึ้นบัญชีดำ) → ทุกอุปกรณ์แลกบัตรใหม่ไม่ได้
    ใช้ตอนเปลี่ยนรหัสผ่าน (ขั้น 1.7) — เครื่องที่ใช้อยู่จะได้บัตรใบใหม่แยกต่างหาก
    ignore_conflicts: ใบที่อยู่ในบัญชีดำอยู่แล้ว (หรือมีคำขออื่นบันทึกพร้อมกัน) ข้ามไปเฉย ๆ
    """
    outstanding = OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True)
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in outstanding], ignore_conflicts=True
    )


def claim_refresh_token(refresh: RefreshToken) -> bool:
    """
    "ใช้" refresh token ใบนี้ — ใบละครั้งเดียว แม้ยื่นพร้อมกันหลายคำขอ (ขั้น 1.4.1)

    ทำในจังหวะเดียว: บันทึกใบนี้ลงบัญชีดำ แล้วดูว่า "เราเป็นคนบันทึก" หรือมีคนบันทึกไปก่อนแล้ว
    ตารางบัญชีดำมีกฎห้ามซ้ำ (1 บัตร = 1 แถว) → ฐานข้อมูลยอมให้บันทึกสำเร็จได้แค่คำขอเดียว
    (แบบเดิม "ตรวจว่าใช้แล้วหรือยัง" แล้วค่อย "บันทึก" แยกจังหวะกัน คำขอที่มาพร้อมกันจึงผ่านได้หลายคำขอ)

    @returns True = คำขอนี้ได้สิทธิ์ใช้บัตร (ออกบัตรใหม่ได้) ; False = มีคำขออื่นใช้ไปก่อนแล้ว
    """
    _, created = refresh.blacklist()
    return created


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
