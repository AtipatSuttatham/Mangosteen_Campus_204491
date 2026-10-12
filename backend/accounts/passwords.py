"""
สุ่มรหัสผ่านชั่วคราวฝั่ง server (ใช้ตอนนำเข้า CSV — ขั้น 2.4)
(ฟอร์มเพิ่มผู้ใช้ทีละคนสุ่มในหน้าเว็บด้วย crypto.getRandomValues — ขั้น 2.6)
"""

import secrets

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from accounts.models import User

# อักขระที่ใช้: ตัดตัวที่สับสนง่ายออก (l / I / 1, o / O / 0) ; ไม่มีสัญลักษณ์
# (พิมพ์ง่ายบนมือถือ และไม่มีตัว = + - @ ที่ Excel อาจตีความเป็นสูตรเมื่อเปิดไฟล์รหัสผ่าน)
ALPHABET = "abcdefghijkmnpqrstuvwxyz" + "ABCDEFGHJKLMNPQRSTUVWXYZ" + "23456789"
# ความยาว 12 ตัว → 56^12 ≈ 2^69 แบบ
LENGTH = 12
# จำนวนครั้งสูงสุดที่ลองสุ่มใหม่ถ้าไม่ผ่านกฎรหัสผ่าน (แทบไม่เกิด — กันวนไม่รู้จบ)
MAX_ATTEMPTS = 100


def generate_temporary_password(user: User | None = None) -> str:
    """
    สุ่มรหัส 12 ตัวด้วย secrets (ตัวสุ่มสำหรับงานความปลอดภัย) แล้วตรวจด้วยกฎรหัสผ่าน 4 ข้อของระบบ
    (ข้อ "ไม่คล้ายชื่อ/อีเมล" เทียบกับ user ที่ส่งมา) — ไม่ผ่านก็สุ่มใหม่
    """
    for _ in range(MAX_ATTEMPTS):
        password = "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))
        try:
            validate_password(password, user)
        except ValidationError:
            continue
        return password
    raise RuntimeError("Could not generate a password that passes the validators.")
