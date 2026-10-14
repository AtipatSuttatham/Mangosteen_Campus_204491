"""
ตัวสุ่ม "รหัสเข้าร่วม" ของรายวิชา (Course.join_code) — ผู้เรียนกรอกรหัสนี้เพื่อเข้าร่วมเอง (UC-15)
อ้างอิง: CLAUDE.md "การตัดสินใจก้อน 3" ข้อรหัสเข้าร่วม, docs/database.md §4

- ยาว 8 ตัว ใช้ A–Z และ 2–9 แต่ตัดตัวที่อ่านสับสนง่ายออก (0 O 1 I L) — ผู้สอนอ่านออกเสียง/เขียนบนกระดานได้
- สุ่มด้วย secrets (ตัวสุ่มสำหรับงานความปลอดภัย) ไม่ใช้ random ที่เดาลำดับได้
- เก็บเป็นตัวพิมพ์ใหญ่เสมอ ; ผู้เรียนพิมพ์ตัวเล็กมาก็ได้ (normalize_join_code)
"""

import secrets
from collections.abc import Callable

# ตัวอักษรที่ใช้ได้: A–Z ตัด I, L, O + เลข 2–9 (ไม่มี 0 และ 1) = 31 ตัว
JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
# ความยาวรหัส — 31^8 ≈ 8.5 แสนล้านแบบ เดาสุ่มไม่ได้ในทางปฏิบัติ (ขั้น 3.4 จำกัดจำนวนครั้งที่ลองเพิ่มอีกชั้น)
JOIN_CODE_LENGTH = 8
# รูปแบบเดียวกับ JOIN_CODE_ALPHABET ในแบบที่ฐานข้อมูลใช้ตรวจ (constraint ใน academics/models.py)
JOIN_CODE_PATTERN = r"^[A-HJKMNP-Z2-9]{8}$"
# สุ่มซ้ำได้กี่ครั้งก่อนยอมแพ้ — โอกาสซ้ำต่ำมาก ถ้าซ้ำถึง 10 ครั้งแปลว่ามีอะไรผิดปกติ
MAX_ATTEMPTS = 10


def _course_has_code(code: str) -> bool:
    """มีรายวิชาไหนใช้รหัสนี้อยู่แล้วหรือไม่ (import ข้างในกัน import วนกับ models.py)"""
    from academics.models import Course

    return Course.objects.filter(join_code=code).exists()


def generate_join_code(is_taken: Callable[[str], bool] = _course_has_code) -> str:
    """
    สุ่มรหัสเข้าร่วมใหม่ที่ยังไม่มีรายวิชาใดใช้
    is_taken = ตัวตรวจว่ารหัสถูกใช้แล้วหรือยัง (ค่าเริ่มต้นถามฐานข้อมูล ; test ส่งตัวจำลองมาแทนได้)

    หมายเหตุ: ถ้ามี 2 คำขอสุ่มได้รหัสเดียวกันพร้อมกันพอดี ฐานข้อมูลจะกันไว้ด้วย unique
    ฝั่ง API (ขั้น 3.3) จึงต้องลองใหม่เมื่อบันทึกไม่ผ่าน
    """
    for _ in range(MAX_ATTEMPTS):
        code = "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(JOIN_CODE_LENGTH))
        if not is_taken(code):
            return code
    raise RuntimeError("could not generate a unique join code")


def normalize_join_code(value: str) -> str:
    """จัดรูปรหัสที่ผู้เรียนกรอก: ตัดช่องว่างหัว-ท้าย + แปลงเป็นตัวพิมพ์ใหญ่ (k7q2xm9a = K7Q2XM9A)"""
    return value.strip().upper()
