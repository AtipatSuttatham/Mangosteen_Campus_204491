"""
ไฟล์ตั้งค่าหลักของ Django สำหรับ backend ของ Mangosteen Campus

หลักการ:
- ค่าลับ/ค่าที่ต่างกันระหว่างเครื่อง (รหัสผ่านฐานข้อมูล, secret key, โหมด debug)
  อ่านจาก environment variable หรือไฟล์ .env ที่ root ของ repo เท่านั้น — ห้ามเขียนค่าจริงลงไฟล์นี้
- ใช้ไฟล์ตั้งค่าไฟล์เดียวกันทุกที่ (เครื่องพัฒนา / CI) ความต่างอยู่ที่ค่าใน environment
"""

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
    # app ของโปรเจกต์: ของใช้ร่วมกันทุก app (abstract model, endpoint ระบบ)
    "common",
]

# --- middleware: ตัวกลางที่ทุก request/response ต้องผ่าน (ค่ามาตรฐานของ Django) ---
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
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

# --- Django REST Framework ---
REST_FRAMEWORK = {
    # ส่งข้อมูลกลับเป็น JSON เท่านั้น (frontend เป็น React ไม่ใช้หน้า HTML ของ DRF)
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}
