#!/usr/bin/env python
"""
ตัวสั่งงาน Django ผ่าน command line
ตัวอย่าง:  uv run python manage.py runserver   (เปิดเซิร์ฟเวอร์พัฒนา)
           uv run python manage.py migrate     (สร้าง/อัปเดตตารางในฐานข้อมูล)
"""

import os
import sys


def main() -> None:
    """ตั้งค่าให้ใช้ไฟล์ settings ของโปรเจกต์ แล้วส่งคำสั่งต่อให้ Django ทำงาน"""
    # บอก Django ว่าไฟล์ตั้งค่าอยู่ที่ config/settings.py
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # หา Django ไม่เจอ → มักเกิดจากไม่ได้รันผ่าน "uv run"
        raise ImportError(
            "Couldn't import Django. Run commands with 'uv run' inside the backend folder."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
