"""
API จัดการบัญชีผู้ใช้สำหรับผู้ดูแลระบบ (UC-04 — ขั้น 2.3) — อ้างอิง docs/api.md §7

ที่อยู่ทั้งหมดอยู่ใต้ /api/v1/admin/users/ (accounts/manage_urls.py) และใช้ได้เฉพาะผู้ดูแลระบบ
"""

from django.db.models import Q, QuerySet, Value
from django.db.models.functions import Concat
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.manage_serializers import AdminUserFilterSerializer, AdminUserSerializer
from accounts.models import User
from accounts.permissions import IsAdminRole
from common.pagination import StandardPagination


def _filter_users(params: dict) -> QuerySet[User]:
    """
    รายชื่อผู้ใช้ตามตัวกรอง เรียงบัญชีใหม่สุดขึ้นก่อน (ตาม wireframe รายชื่อผู้ใช้)
    คำค้นเทียบแบบ "มีคำนี้อยู่ในข้อความ" ไม่สนตัวพิมพ์ — รวมชื่อเต็ม จึงพิมพ์ "สมชาย ใจดี" แล้วเจอ
    """
    users = User.objects.order_by("-date_joined", "-id")

    search = params.get("search", "").strip()
    if search:
        users = users.annotate(full_name=Concat("first_name", Value(" "), "last_name")).filter(
            Q(full_name__icontains=search)
            | Q(email__icontains=search)
            | Q(student_or_staff_id__icontains=search)
        )
    if "role" in params:
        users = users.filter(role=params["role"])
    if "is_active" in params:
        users = users.filter(is_active=params["is_active"] == "true")
    return users


class AdminUserListView(APIView):
    """
    GET /api/v1/admin/users/?search=&role=&is_active=&page=   รายชื่อผู้ใช้ หน้าละ 20

    - สำเร็จ → 200 {count, next, previous, results: [ผู้ใช้, ...]}
    - ตัวกรองผิด → 400 validation_error ; หน้าที่ไม่มีอยู่ → 404 not_found
    - ไม่ใช่ผู้ดูแลระบบ → 403 permission_denied
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: Request) -> Response:
        filters = AdminUserFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            _filter_users(filters.validated_data), request, view=self
        )
        return paginator.get_paginated_response(AdminUserSerializer(page, many=True).data)


class AdminUserDetailView(APIView):
    """
    GET /api/v1/admin/users/{id}/   ข้อมูลบัญชี 1 คน

    - ไม่พบ → 404 not_found
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: Request, pk: int) -> Response:
        user = get_object_or_404(User, pk=pk)
        return Response(AdminUserSerializer(user).data)
