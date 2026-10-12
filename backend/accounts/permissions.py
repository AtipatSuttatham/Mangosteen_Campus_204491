"""
ตัวตรวจสิทธิ์ของ API (ใช้ใน permission_classes ของแต่ละ view)
"""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from accounts.models import User


class IsAdminRole(BasePermission):
    """
    ผ่านเฉพาะผู้ใช้ที่มีบทบาท "ผู้ดูแลระบบ" (role = admin)

    อ่านบทบาทจากข้อมูลผู้ใช้ที่ตัวยืนยันตัวตนเพิ่งโหลดจากฐานข้อมูลในคำขอนี้ — ไม่เชื่อค่า role ในบัตร
    → ถ้าผู้ดูแลระบบถูกเปลี่ยนบทบาท คำขอถัดไปของคนนั้นถูกปฏิเสธทันที (ผู้ใช้เลือกแบบ ก ขั้น 2.3)
    ไม่ผ่าน → 403 permission_denied ; ยังไม่เข้าสู่ระบบ → 401 (DRF ตัดสินให้)
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.ADMIN)
