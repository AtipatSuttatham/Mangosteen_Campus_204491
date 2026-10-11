"""
ตัวยืนยันตัวตนของทุก API (ตั้งใน settings.REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"])

ทำงานเหมือนตัวมาตรฐานของ Simple JWT (ตรวจลายเซ็น, วันหมดอายุ, บัญชีถูกระงับ) แล้วตรวจเพิ่ม 1 อย่าง:
"บัตรนี้ออกก่อนการเปลี่ยนรหัสผ่านครั้งล่าสุดหรือไม่" — ถ้าใช่ ปฏิเสธทันที

ทำไมต้องมี (ผู้ใช้เลือกแบบ ก ขั้น 1.7): access token อายุ 15 นาทีไม่ได้ถูกจดไว้ในฐานข้อมูล จึงยกเลิก
รายใบไม่ได้ — ถ้าไม่ตรวจตรงนี้ อุปกรณ์อื่น (เช่น คนที่ขโมยรหัสไป) ยังใช้งานต่อได้อีกสูงสุด 15 นาที
หลังเจ้าของเปลี่ยนรหัส ; ผลพลอยได้: ผู้ดูแลระบบรีเซ็ตรหัสให้ใคร (ก้อน 2) อุปกรณ์เดิมก็หลุดทันที
ไม่ช้าลง: ทุกคำขอโหลดข้อมูลผู้ใช้จากฐานข้อมูลอยู่แล้ว (ตรวจ is_active) — แค่เทียบค่าเพิ่ม
"""

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.models import User
from accounts.tokens import PASSWORD_CLAIM, password_fingerprint_matches


class PasswordAwareJWTAuthentication(JWTAuthentication):
    """ตัวตรวจ access token ที่ปฏิเสธบัตรซึ่งออกก่อนการเปลี่ยนรหัสผ่าน"""

    def get_user(self, validated_token) -> User:
        # ตัวมาตรฐาน: หาผู้ใช้จาก user_id ในบัตร + ปฏิเสธบัญชีที่ถูกระงับ
        user = super().get_user(validated_token)
        if not password_fingerprint_matches(user, validated_token.get(PASSWORD_CLAIM)):
            # ตัวแปลง error กลางรวมเป็นรหัส authentication_failed → หน้าเว็บพาไปเข้าสู่ระบบใหม่
            raise AuthenticationFailed(
                "Token was issued before the password was changed.", code="password_changed"
            )
        return user
