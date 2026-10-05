"""
จุดเริ่มต้นของแอปแบบ ASGI — ใช้เมื่อรันบนเซิร์ฟเวอร์ที่รองรับการทำงานแบบ asynchronous
(ตอนพัฒนาในเครื่องไม่ได้ใช้ไฟล์นี้โดยตรง)
"""

import os

from django.core.asgi import get_asgi_application

# บอก Django ว่าไฟล์ตั้งค่าอยู่ที่ config/settings.py
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# ตัวแอปที่เซิร์ฟเวอร์ ASGI จะเรียกใช้
application = get_asgi_application()
