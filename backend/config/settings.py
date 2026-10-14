"""
ไฟล์ตั้งค่าหลักของ Django สำหรับ backend ของ Mangosteen Campus

หลักการ:
- ค่าลับ/ค่าที่ต่างกันระหว่างเครื่อง (รหัสผ่านฐานข้อมูล, secret key, โหมด debug)
  อ่านจาก environment variable หรือไฟล์ .env ที่ root ของ repo เท่านั้น — ห้ามเขียนค่าจริงลงไฟล์นี้
- ใช้ไฟล์ตั้งค่าไฟล์เดียวกันทุกที่ (เครื่องพัฒนา / CI) ความต่างอยู่ที่ค่าใน environment
"""

from datetime import timedelta
from pathlib import Path

import environ

# --- ตำแหน่งโฟลเดอร์ ---
# BASE_DIR = โฟลเดอร์ backend/ (ที่มี manage.py)
BASE_DIR = Path(__file__).resolve().parent.parent
# REPO_ROOT = root ของ repo (ที่มีไฟล์ .env ใช้ร่วมกับ docker-compose.yml)
REPO_ROOT = BASE_DIR.parent

# --- อ่านค่าตั้งค่าจาก environment ---
# กำหนดชนิดข้อมูลและค่าเริ่มต้นของตัวแปรที่ไม่บังคับ
env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
)
# ถ้ามีไฟล์ .env ที่ root ของ repo ให้โหลดค่าจากไฟล์นั้น
# (บน CI ไม่มีไฟล์นี้ — ค่ามาจาก environment variable ที่ตั้งในไฟล์ workflow แทน)
env_file = REPO_ROOT / ".env"
if env_file.exists():
    environ.Env.read_env(env_file)

# --- ความปลอดภัย ---
# กุญแจลับที่ Django ใช้เข้ารหัสลายเซ็นต่าง ๆ — บังคับต้องตั้งค่า (ไม่มีค่าเริ่มต้น)
SECRET_KEY = env("DJANGO_SECRET_KEY")
# โหมด debug แสดงรายละเอียด error — เปิดเฉพาะตอนพัฒนา
DEBUG = env("DJANGO_DEBUG")
# host ที่อนุญาตให้เรียก backend ได้
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# --- app ที่ติดตั้งในระบบ ---
INSTALLED_APPS = [
    # app มาตรฐานของ Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # ไลบรารีภายนอก: Django REST Framework สำหรับสร้าง REST API
    "rest_framework",
    # ไลบรารีภายนอก: Simple JWT — บัญชีดำของ refresh token (ใช้ตอนออกจากระบบ/แลก token ใหม่)
    "rest_framework_simplejwt.token_blacklist",
    # ไลบรารีภายนอก: อนุญาตให้ frontend ที่อยู่คนละโดเมนเรียก API ได้ (CORS)
    "corsheaders",
    # app ของโปรเจกต์: ของใช้ร่วมกันทุก app (abstract model, endpoint ระบบ)
    "common",
    # app ของโปรเจกต์: บัญชีผู้ใช้และการเข้าสู่ระบบ (ก้อน 1)
    "accounts",
    # app ของโปรเจกต์: บันทึกประวัติการใช้งาน AuditLog (ก้อน 2)
    "audit",
    # app ของโปรเจกต์: รายวิชา Course (ก้อน 3)
    "academics",
]

# ใช้ตารางผู้ใช้ของเราเอง (accounts.User) แทนตารางผู้ใช้สำเร็จรูปของ Django
# — login ด้วยอีเมล/รหัส ไม่มี username, มี role (docs/database.md §3)
# ต้องตั้งก่อนสร้างตารางครั้งแรกเสมอ (เปลี่ยนทีหลังต้องรื้อฐานข้อมูล)
AUTH_USER_MODEL = "accounts.User"

# --- middleware: ตัวกลางที่ทุก request/response ต้องผ่าน (ค่ามาตรฐานของ Django) ---
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # ตรวจ/ใส่ header ของ CORS — ต้องอยู่ก่อน CommonMiddleware (ตามคู่มือของ django-cors-headers)
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ไฟล์ที่รวบรวมเส้นทาง URL ทั้งหมดของระบบ
ROOT_URLCONF = "config.urls"

# --- template: ใช้เฉพาะหน้า Django admin (หน้าจอหลักของระบบอยู่ฝั่ง React) ---
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# จุดเริ่มต้นของแอปเมื่อรันบนเซิร์ฟเวอร์ (WSGI / ASGI)
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- ฐานข้อมูล ---
# อ่านที่อยู่ฐานข้อมูล PostgreSQL จาก DATABASE_URL (ดูรูปแบบใน .env.example)
DATABASES = {
    "default": env.db("DATABASE_URL"),
}

# ชนิด primary key เริ่มต้นของทุกตาราง = BigAutoField (ตาม docs/database.md §1)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- การตรวจความแข็งแรงของรหัสผ่าน (ค่ามาตรฐานของ Django) ---
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- ตัวเข้ารหัสรหัสผ่าน ---
# ตัวแรก = ตัวหลักที่ใช้กับรหัสทุกตัว (ค่ามาตรฐานของ Django) ; ตัวอื่นใช้อ่านรหัสที่เก็บแบบนั้นไว้
# แล้ว Django เปลี่ยนเป็นตัวหลักให้อัตโนมัติตอนผู้ใช้เข้าสู่ระบบ
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
    # รหัสชั่วคราวจากการนำเข้า CSV (เข้ารหัสแบบเบา — เหตุผลใน accounts/hashers.py ; ขั้น 2.4)
    "accounts.hashers.TemporaryPasswordHasher",
]

# --- ภาษาและเวลา ---
# ภาษาเริ่มต้นของข้อความระบบฝั่ง Django (หน้าจอหลักแปลภาษาที่ฝั่ง frontend)
LANGUAGE_CODE = "th"
# เขตเวลาที่ใช้แสดงผล/คำนวณเรื่อง "วัน" (เช่น ส่งงานช้า) = เวลาไทย
TIME_ZONE = "Asia/Bangkok"
USE_I18N = True
# เก็บเวลาในฐานข้อมูลเป็น UTC เสมอ (ตาม docs/database.md §1)
USE_TZ = True

# --- ไฟล์ static (CSS/JS ของหน้า Django admin) ---
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- ไฟล์ที่ผู้ใช้อัปโหลด (รูปประจำตัว ฯลฯ) — CLAUDE.md "ฟิลด์ไฟล์", docs/database.md §1 ---
# โค้ดทุกจุดเก็บ/อ่านไฟล์ผ่านระบบ storage ของ Django (FileField / default_storage) เท่านั้น
# ช่วงพัฒนา: เก็บในโฟลเดอร์ backend/media/ ของเครื่อง (อยู่ใน .gitignore)
# ตอน deploy: ติดตั้ง django-storages แล้วเปลี่ยน "default" เป็น Backblaze B2 (แบบ S3) — แก้แค่ตรงนี้
#   ไม่ต้องแก้โค้ดหรือข้อมูล (ผู้ใช้เลือกแบบ ก ขั้น 1.7: ติดตั้ง django-storages ตอนต่อ cloud)
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- รูปประจำตัว (การตัดสินใจก้อน 1 / docs/database.md §11 v2.3) ---
# ขนาดไฟล์สูงสุดที่รับ: 2 MB
AVATAR_MAX_BYTES = 2 * 1024 * 1024
# ย่อให้ด้านยาวไม่เกิน 512px (ไม่ขยายรูปเล็ก)
AVATAR_MAX_SIZE = 512
# จำนวนพิกเซลสูงสุดของรูปต้นฉบับ (25 ล้าน ≈ 5000×5000) — กันไฟล์เล็กที่ขยายแล้วกินหน่วยความจำมาก
# (เครื่องฟรีตอน deploy มี RAM 512 MB — ข้อควรระวังข้อ 3 ใน CLAUDE.md)
AVATAR_MAX_PIXELS = 25_000_000

# --- นำเข้าบัญชีจากไฟล์ CSV (การตัดสินใจก้อน 2 / docs/api.md §7.4) ---
# ขนาดไฟล์สูงสุด: 1 MB
CSV_IMPORT_MAX_BYTES = 1024 * 1024
# จำนวนแถวข้อมูลสูงสุด (ไม่นับแถวหัวตารางและแถวว่าง)
CSV_IMPORT_MAX_ROWS = 500

# --- Django REST Framework ---
REST_FRAMEWORK = {
    # ส่งข้อมูลกลับเป็น JSON เท่านั้น (frontend เป็น React ไม่ใช้หน้า HTML ของ DRF)
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    # แปลง error ทุกชนิดให้เป็นรูปแบบกลาง {code, detail, fields?} (ดู common/exceptions.py, docs/api.md)
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    # ยืนยันตัวตนด้วย access token (JWT) ใน header "Authorization: Bearer <token>" เท่านั้น
    # ตัวตรวจของเราเพิ่มการตรวจ "บัตรออกก่อนเปลี่ยนรหัสผ่านหรือไม่" (accounts/authentication.py — ขั้น 1.7)
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.PasswordAwareJWTAuthentication",
    ],
    # ค่าเริ่มต้น = ต้องเข้าสู่ระบบก่อนเสมอ ; ที่อยู่ที่เปิดให้ทุกคน (เช่น login, health) ระบุ AllowAny เอง
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    # รายการที่แบ่งหน้าใช้รูปแบบเดียวกันทั้งระบบ: {count, next, previous, results} หน้าละ 20 (ขั้น 2.3)
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
}

# --- Simple JWT: token สำหรับเข้าสู่ระบบ (CLAUDE.md หัวข้อ "Token", docs/api.md §6) ---
SIMPLE_JWT = {
    # access token อายุ 15 นาที (หน้าเว็บถือไว้ในหน่วยความจำ)
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    # refresh token อายุ 7 วัน (อยู่ใน httpOnly cookie)
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    # แลก token ทุกครั้ง → ได้ refresh token ใบใหม่ และใบเก่าขึ้นบัญชีดำทันที (ใช้ซ้ำไม่ได้)
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # ลงลายเซ็น token ด้วยกุญแจลับของ Django
    "SIGNING_KEY": SECRET_KEY,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- cookie ที่เก็บ refresh token ---
# ชื่อ cookie
REFRESH_COOKIE_NAME = "refresh_token"
# ส่ง cookie ไปเฉพาะที่อยู่ของการยืนยันตัวตน (/api/v1/auth/...) ไม่แนบไปกับทุกคำขอ
REFRESH_COOKIE_PATH = "/api/v1/auth/"
# Strict = เว็บอื่นส่ง cookie นี้มาไม่ได้เลย (กันการปลอมคำขอข้ามเว็บ — ทำได้เพราะโดเมนเดียวกัน)
REFRESH_COOKIE_SAMESITE = "Strict"
# ส่งผ่าน HTTPS เท่านั้นเมื่อไม่ใช่โหมดพัฒนา (เครื่องพัฒนาใช้ http://localhost)
REFRESH_COOKIE_SECURE = not DEBUG

# --- CORS: frontend ที่อยู่คนละโดเมนกับ backend ---
# ตอนพัฒนาในเครื่องไม่ได้ใช้ (frontend เรียก /api ผ่าน proxy ของ Vite จึงเหมือนอยู่ที่เดียวกัน)
# ตั้งไว้เผื่อตอน deploy ต้องแยกโดเมน — รายชื่อโดเมนที่อนุญาตอ่านจาก .env (ค่าเริ่มต้น = ไม่อนุญาตใคร)
# ตัวอย่างใน .env:  CORS_ALLOWED_ORIGINS=https://campus.example.com
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
# อนุญาตให้ส่ง cookie ข้ามโดเมน (จำเป็นสำหรับ refresh token ใน httpOnly cookie — ก้อน 1)
CORS_ALLOW_CREDENTIALS = True
# ใช้กฎ CORS เฉพาะที่อยู่ใต้ /api/ เท่านั้น
CORS_URLS_REGEX = r"^/api/.*$"

# --- การบันทึก log ---
# แสดง error ที่ไม่คาดคิดใน API (พร้อมรายละเอียดเต็ม) ทางหน้าจอ console ของเซิร์ฟเวอร์
# (ผู้ใช้ไม่เห็นรายละเอียดนี้ — API ตอบกลับแค่ {"code": "server_error"})
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "loggers": {
        "common": {"handlers": ["console"], "level": "ERROR"},
    },
}
