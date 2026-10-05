"""
จุดเริ่มต้นของแอปแบบ WSGI — ใช้เมื่อนำระบบขึ้นเซิร์ฟเวอร์จริง (เช่น ผ่าน gunicorn)
(ตอนพัฒนาในเครื่องไม่ได้ใช้ไฟล์นี้โดยตรง)
"""

import os

from django.core.wsgi import get_wsgi_application

# บอก Django ว่าไฟล์ตั้งค่าอยู่ที่ config/settings.py
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# ตัวแอปที่เซิร์ฟเวอร์ WSGI จะเรียกใช้
application = get_wsgi_application()
