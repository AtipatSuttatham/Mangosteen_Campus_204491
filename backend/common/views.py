"""
view (ตัวรับ request) ระดับระบบที่ไม่ผูกกับฟีเจอร์ใด
"""

from django.db import DatabaseError, connection
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request: Request) -> Response:
    """
    ตรวจสุขภาพระบบ: GET /api/health/

    ใช้ตรวจว่า backend ทำงานอยู่ และเชื่อมต่อฐานข้อมูลได้
    - ปกติ            → 200 {"status": "ok", "database": "ok"}
    - ต่อฐานข้อมูลไม่ได้ → 503 {"status": "error", "database": "unavailable"}
    เปิดให้เรียกได้โดยไม่ต้องเข้าสู่ระบบ และไม่เปิดเผยรายละเอียดภายในของระบบ
    """
    try:
        # ลองเปิดการเชื่อมต่อฐานข้อมูล แล้วส่งคำสั่งง่ายที่สุดเพื่อยืนยันว่าตอบสนองได้จริง
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        # ต่อฐานข้อมูลไม่ได้ → ตอบ 503 (Service Unavailable)
        return Response(
            {"status": "error", "database": "unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # ทุกอย่างปกติ
    return Response({"status": "ok", "database": "ok"})
