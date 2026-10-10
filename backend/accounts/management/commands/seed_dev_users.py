"""
คำสั่ง  uv run python manage.py seed_dev_users  — สร้างบัญชีทดลองสำหรับเครื่องพัฒนา

- สร้าง 3 บัญชี (ผู้ดูแลระบบ / ผู้สอน / ผู้เรียน) ด้วย**ข้อมูลสมมติ**เท่านั้น
  อีเมลใช้โดเมน example.com (สงวนไว้สำหรับตัวอย่าง — ไม่ชนกับอีเมลของคนจริง)
- สุ่มรหัสผ่านแล้วแสดงบนหน้าจอครั้งเดียว — ไม่บันทึกลงไฟล์ใด ๆ
- รันซ้ำได้: บัญชีที่มีอยู่แล้วจะข้าม ; ใส่ --reset-passwords เพื่อสุ่มรหัสใหม่ให้บัญชีเดิม
- ทำงานเฉพาะโหมดพัฒนา (DEBUG=True) — กันเผลอสร้างบัญชีทดลองบนเว็บจริง
"""

import secrets

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from accounts.models import User

# ข้อมูลบัญชีทดลอง (สมมติทั้งหมด) — เรียงให้ผู้ดูแลระบบมาก่อน เพราะเป็น "ผู้สร้าง" ของบัญชีอื่น
SEED_USERS = [
    {
        "email": "admin@example.com",
        "student_or_staff_id": None,
        "first_name": "ผู้ดูแล",
        "last_name": "ทดลองระบบ",
        "role": User.Role.ADMIN,
    },
    {
        "email": "teacher@example.com",
        "student_or_staff_id": "T00001",
        "first_name": "ผู้สอน",
        "last_name": "ทดลองระบบ",
        "role": User.Role.TEACHER,
    },
    {
        "email": "student@example.com",
        "student_or_staff_id": "690000001",
        "first_name": "ผู้เรียน",
        "last_name": "ทดลองระบบ",
        "role": User.Role.STUDENT,
    },
]


def generate_password() -> str:
    """สุ่มรหัสผ่านยาว 16 ตัวอักษร (ตัวอักษร + ตัวเลข + - _) — ผ่านกฎรหัสผ่านของ Django"""
    return secrets.token_urlsafe(12)


class Command(BaseCommand):
    help = "สร้างบัญชีทดลอง (ผู้ดูแลระบบ / ผู้สอน / ผู้เรียน) สำหรับเครื่องพัฒนาเท่านั้น"

    def add_arguments(self, parser: CommandParser) -> None:
        """ตัวเลือกของคำสั่ง"""
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="สุ่มรหัสผ่านใหม่ให้บัญชีทดลองที่มีอยู่แล้ว (ใช้เมื่อลืมรหัส)",
        )

    def handle(self, *args, **options) -> None:
        """สร้างบัญชีทดลองทีละบัญชี แล้วแสดงสรุปพร้อมรหัสผ่าน"""
        # ป้องกัน: ห้ามรันบนเซิร์ฟเวอร์จริง
        if not settings.DEBUG:
            raise CommandError("seed_dev_users runs only when DJANGO_DEBUG=True (development).")

        reset_passwords: bool = options["reset_passwords"]
        admin_user: User | None = None
        # แถวสรุปที่จะแสดงท้ายคำสั่ง: (อีเมล, รหัส, บทบาท, รหัสผ่าน หรือข้อความแทน)
        rows: list[tuple[str, str, str, str]] = []

        for data in SEED_USERS:
            user = User.objects.filter(email=data["email"]).first()
            if user is None:
                # ยังไม่มี → สร้างใหม่ (ผู้สอน/ผู้เรียน บันทึกว่าผู้ดูแลระบบทดลองเป็นผู้สร้าง)
                password = generate_password()
                user = User.objects.create_user(
                    password=password,
                    created_by=admin_user,
                    # ผู้ดูแลระบบทดลองเข้าหน้า /admin/ ได้ (สะดวกตอนพัฒนา)
                    is_staff=data["role"] == User.Role.ADMIN,
                    **data,
                )
                shown_password = password
            elif reset_passwords:
                # มีอยู่แล้ว + สั่งรีเซ็ต → สุ่มรหัสใหม่
                password = generate_password()
                user.set_password(password)
                user.save(update_fields=["password", "updated_at"])
                shown_password = password
            else:
                # มีอยู่แล้ว → ข้าม (ไม่แตะรหัสผ่านเดิม)
                shown_password = "(มีอยู่แล้ว — ใช้ --reset-passwords เพื่อสุ่มรหัสใหม่)"

            if user.role == User.Role.ADMIN:
                admin_user = user
            rows.append((user.email, user.student_or_staff_id or "-", user.role, shown_password))

        # แสดงสรุปบนหน้าจอ (ครั้งเดียว — ไม่บันทึกลงไฟล์)
        self.stdout.write(self.style.SUCCESS("บัญชีทดลอง (ข้อมูลสมมติ — ใช้ในเครื่องพัฒนาเท่านั้น):"))
        for email, student_or_staff_id, role, password in rows:
            self.stdout.write(
                f"  {role:<8} {email:<22} รหัส: {student_or_staff_id:<10} รหัสผ่าน: {password}"
            )
