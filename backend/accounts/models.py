"""
ตาราง User — บัญชีผู้ใช้ทุกคนในระบบ (ผู้ดูแลระบบ / ผู้สอน / ผู้เรียน)
อ้างอิง: docs/database.md §3 "Accounts" (รายงานตาราง 4.3) และ §11 v2.3

หลักสำคัญ:
- ไม่มีการสมัครเอง — ผู้ดูแลระบบสร้างทุกบัญชี
- เข้าสู่ระบบด้วยอีเมล หรือ รหัสนักศึกษา/รหัสพนักงาน (ตัวตรวจรหัสอยู่ในขั้น 1.2)
- ไม่ลบบัญชีจริง — ระงับด้วย is_active=False
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from common.models import TimeStampedModel


def normalize_email(value: str) -> str:
    """
    จัดรูปอีเมลให้เป็นแบบเดียวกันเสมอ: ตัดช่องว่างหัว-ท้าย + แปลงเป็นตัวพิมพ์เล็กทั้งหมด
    (A@CMU.ac.th กับ a@cmu.ac.th = คนเดียวกัน — §11 v2.3)
    """
    return value.strip().lower()


def normalize_student_or_staff_id(value: str | None) -> str | None:
    """
    จัดรูปรหัสนักศึกษา/รหัสพนักงาน: ตัดช่องว่างหัว-ท้าย ; ไม่มีรหัส (ว่าง) → None
    เก็บเป็น NULL แทนข้อความว่าง เพราะ NULL ไม่นับว่า "ซ้ำกัน" — หลายคนไม่มีรหัสได้
    """
    if value is None:
        return None
    value = value.strip()
    return value or None


class UserManager(BaseUserManager["User"]):
    """ตัวช่วยสร้าง/ค้นหาผู้ใช้ (ใช้แทนตัวเดิมของ Django ที่อิง username)"""

    def get_by_natural_key(self, username: str | None) -> "User":
        """
        หาผู้ใช้จากอีเมล — Django เรียกตอนเข้าสู่ระบบหน้า /admin/
        จัดรูปอีเมลก่อนค้น จึงพิมพ์ตัวพิมพ์ใหญ่มาก็หาเจอ
        """
        return self.get(email=normalize_email(username or ""))

    def _create_user(self, email: str, password: str | None, **extra_fields) -> "User":
        """สร้างผู้ใช้ 1 คน: ตรวจอีเมล/บทบาท แล้วเข้ารหัสรหัสผ่านก่อนบันทึก"""
        if not email:
            raise ValueError("email is required")
        if extra_fields.get("role") not in User.Role.values:
            raise ValueError("role must be one of: " + ", ".join(User.Role.values))
        user = self.model(email=email, **extra_fields)
        # set_password เก็บเฉพาะค่าที่เข้ารหัสแล้ว (hash) ; ถ้า password=None → บัญชีนั้น login ไม่ได้
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields) -> "User":
        """สร้างผู้ใช้ทั่วไป — ต้องระบุ role ; ไม่มีสิทธิ์เข้าหน้า /admin/"""
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields) -> "User":
        """
        สร้างผู้ดูแลระบบที่เข้าหน้า /admin/ ได้ทุกอย่าง (ใช้โดยคำสั่ง createsuperuser)
        บทบาทในระบบ = admin เสมอ
        """
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields["role"] != User.Role.ADMIN:
            raise ValueError("superuser must have role=admin")
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("superuser must have is_staff=True and is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """
    บัญชีผู้ใช้ 1 คน (1 บัญชี = 1 บทบาท)

    สิทธิ์ในรายวิชาไม่ได้ดูจาก role อย่างเดียว — ดูจาก Course.teacher และ Enrollment
    ส่วน is_staff / is_superuser ใช้กับหน้า Django admin เท่านั้น แยกจาก role
    """

    class Role(models.TextChoices):
        """บทบาทระดับระบบ (รายงานตาราง 3.1)"""

        ADMIN = "admin", "ผู้ดูแลระบบ"
        TEACHER = "teacher", "ผู้สอน"
        STUDENT = "student", "ผู้เรียน"

    # อีเมล — ใช้เข้าสู่ระบบได้ ; เก็บเป็นตัวพิมพ์เล็กเสมอ (จัดรูปใน save())
    email = models.EmailField("อีเมล", unique=True)
    # รหัสนักศึกษา/รหัสพนักงาน — ใช้เข้าสู่ระบบได้ ; ไม่มีรหัส = NULL
    student_or_staff_id = models.CharField(
        "รหัสนักศึกษา/รหัสพนักงาน", max_length=20, unique=True, null=True, blank=True
    )
    # บทบาทระดับระบบ — จะใส่ไว้ใน token ตอนเข้าสู่ระบบด้วย (ขั้น 1.2)
    role = models.CharField("บทบาท", max_length=10, choices=Role.choices)
    # ชื่อ-นามสกุล (ภาษาใดก็ได้)
    first_name = models.CharField("ชื่อ", max_length=150)
    last_name = models.CharField("นามสกุล", max_length=150)
    # False = ผู้ดูแลระบบระงับบัญชี → เข้าสู่ระบบไม่ได้ (ไม่ลบบัญชีจริง)
    is_active = models.BooleanField("ใช้งานได้", default=True)
    # สิทธิ์เข้าหน้า Django admin (สำหรับนักพัฒนา) — ไม่เกี่ยวกับ role
    is_staff = models.BooleanField("เข้าหน้า Django admin ได้", default=False)
    # รูปประจำตัว — เก็บ "ตำแหน่งไฟล์" (เช่น avatars/xxx.webp) ไม่เก็บลิงก์เต็ม ;
    # ระบบสร้างลิงก์ตอนเรียกใช้ ; การตรวจ/ย่อรูปทำตอนอัปโหลด (ขั้น 1.7)
    avatar_url = models.FileField("รูปประจำตัว", upload_to="avatars/", max_length=255, blank=True)
    # ผู้ดูแลระบบที่สร้างบัญชีนี้ — ว่าง = บัญชีผู้ดูแลระบบเริ่มต้น ;
    # ถ้าผู้สร้างถูกลบ (ปกติไม่ลบ) ช่องนี้กลายเป็นว่าง ไม่ลบบัญชีตามไปด้วย
    created_by = models.ForeignKey(
        "self",
        verbose_name="สร้างโดย",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_users",
    )
    # วันที่สร้างบัญชี (ชื่อมาตรฐานของ Django ตามสเปก) — last_login มาจาก AbstractBaseUser
    date_joined = models.DateTimeField("วันที่สร้างบัญชี", default=timezone.now)

    objects = UserManager()

    # ช่องที่ใช้เป็น "ชื่อผู้ใช้" ตอนเข้าสู่ระบบหน้า /admin/ และใน createsuperuser
    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    # ช่องที่ createsuperuser ถามเพิ่ม (นอกจากอีเมลและรหัสผ่าน)
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        verbose_name = "ผู้ใช้"
        verbose_name_plural = "ผู้ใช้"
        ordering = ["id"]
        constraints = [
            # ชั้นป้องกันที่ 2: กันอีเมลซ้ำแบบไม่สนตัวพิมพ์ใหญ่/เล็กในระดับฐานข้อมูล
            # (เผื่อมีการเขียนข้อมูลที่ไม่ผ่าน save() เช่น bulk update)
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs) -> None:
        """จัดรูปอีเมลและรหัสก่อนบันทึกทุกครั้ง (ไม่ว่าจะสร้างจากที่ไหน)"""
        self.email = normalize_email(self.email or "")
        self.student_or_staff_id = normalize_student_or_staff_id(self.student_or_staff_id)
        super().save(*args, **kwargs)

    def clean(self) -> None:
        """จัดรูปก่อนตรวจความถูกต้องในฟอร์ม (เช่น หน้า /admin/) เพื่อให้ตรวจซ้ำได้ถูกต้อง"""
        super().clean()
        self.email = normalize_email(self.email or "")
        self.student_or_staff_id = normalize_student_or_staff_id(self.student_or_staff_id)

    def get_full_name(self) -> str:
        """ชื่อเต็ม "ชื่อ นามสกุล" """
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self) -> str:
        """ชื่อสั้น (ชื่อจริง)"""
        return self.first_name
