"""
API จัดการบัญชีผู้ใช้สำหรับผู้ดูแลระบบ (UC-04 — ขั้น 2.3) — อ้างอิง docs/api.md §7

ที่อยู่ทั้งหมดอยู่ใต้ /api/v1/admin/users/ (accounts/manage_urls.py) และใช้ได้เฉพาะผู้ดูแลระบบ
"""

from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet, Value
from django.db.models.functions import Concat
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.manage_serializers import (
    AdminPasswordResetSerializer,
    AdminUserCreateSerializer,
    AdminUserFilterSerializer,
    AdminUserSerializer,
    AdminUserWriteSerializer,
)
from accounts.models import User
from accounts.permissions import IsAdminRole
from accounts.tokens import revoke_all_refresh_tokens
from audit.models import AuditAction
from audit.services import created_changes, diff_changes, field_values, log_action
from common.exceptions import ApiError
from common.pagination import StandardPagination

# ช่องที่ผู้ดูแลระบบตั้ง/แก้ได้ — ใช้เทียบค่าก่อน-หลังเพื่อจดลง AuditLog
EDITABLE_FIELDS = ["email", "student_or_staff_id", "first_name", "last_name", "role"]


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


def _duplicate_error(email: str | None, student_or_staff_id: str | None, exclude_pk=None):
    """
    สร้าง error "ข้อมูลซ้ำ" รายช่อง หลังฐานข้อมูลปฏิเสธเพราะกฎห้ามซ้ำ
    (เกิดเมื่อ 2 คำขอใช้อีเมล/รหัสเดียวกันในจังหวะเดียวกัน — ผ่านการตรวจทั้งคู่ แต่ฐานข้อมูลกันไว้ได้)
    ตอบเป็น validation_error ปกติแทน 500 ; ตรวจซ้ำว่าช่องไหนชนจริง
    """
    others = User.objects.exclude(pk=exclude_pk) if exclude_pk else User.objects.all()
    fields: dict[str, list[ErrorDetail]] = {}
    if email and others.filter(email=email).exists():
        fields["email"] = [ErrorDetail("This email is already in use.", code="unique")]
    if student_or_staff_id and others.filter(student_or_staff_id=student_or_staff_id).exists():
        fields["student_or_staff_id"] = [ErrorDetail("This ID is already in use.", code="unique")]
    # หาช่องที่ชนไม่เจอ (ไม่ควรเกิด) → ใส่ไว้ที่อีเมลซึ่งเป็นช่องหลัก
    return ValidationError(fields or {"email": [ErrorDetail("Duplicate.", code="unique")]})


def cannot_modify_self_error() -> ApiError:
    """ผู้ดูแลระบบระงับ / เปลี่ยนบทบาท / รีเซ็ตรหัสของตัวเองไม่ได้ (การตัดสินใจก้อน 2 "กันล็อกตัวเอง")"""
    return ApiError(
        "cannot_modify_self",
        "Admins cannot suspend, change the role of, or reset the password of their own account.",
        status_code=status.HTTP_403_FORBIDDEN,
    )


def lock_active_admins() -> list[int]:
    """
    ล็อกแถวผู้ดูแลระบบที่ใช้งานได้ทั้งหมด (SELECT ... FOR UPDATE) จนจบ transaction แล้วคืนรหัสของพวกเขา

    ใช้ก่อนการกระทำที่อาจลดจำนวนผู้ดูแลระบบ (ระงับ / เปลี่ยนบทบาท) — ต้องเรียกใน transaction.atomic()
    ทำไมต้องล็อก: admin A กับ B กดระงับอีกฝ่ายพร้อมกัน ถ้าไม่ล็อก ทั้งสองคำขอนับได้ "2 คน" แล้วผ่านทั้งคู่
    → ไม่เหลือผู้ดูแลระบบเลย ; เมื่อล็อก คำขอที่สองต้องรอคิว แล้วนับใหม่ได้ "1 คน" จึงถูกปฏิเสธ
    ล็อกเรียงตามรหัสเสมอ และล็อกก่อนแถวเป้าหมาย → ทุกคำขอล็อกตามลำดับเดียวกัน ไม่เกิดการรอกันเป็นวง (deadlock)
    """
    return list(
        User.objects.select_for_update()
        .filter(role=User.Role.ADMIN, is_active=True)
        .order_by("pk")
        .values_list("pk", flat=True)
    )


def ensure_not_last_active_admin(user: User, active_admin_ids: list[int]) -> None:
    """
    ถ้า user เป็นผู้ดูแลระบบที่ใช้งานได้ และไม่มีผู้ดูแลระบบที่ใช้งานได้คนอื่นเหลือ → 409 last_active_admin
    (active_admin_ids มาจาก lock_active_admins() ใน transaction เดียวกัน)
    """
    if user.role != User.Role.ADMIN or not user.is_active:
        return
    if not any(pk != user.pk for pk in active_admin_ids):
        raise ApiError(
            "last_active_admin",
            "At least one active admin must remain.",
            status_code=status.HTTP_409_CONFLICT,
        )


class AdminUserListView(APIView):
    """
    GET  /api/v1/admin/users/?search=&role=&is_active=&page=   รายชื่อผู้ใช้ หน้าละ 20
    POST /api/v1/admin/users/   เพิ่มบัญชี 1 คน

    - GET สำเร็จ → 200 {count, next, previous, results: [ผู้ใช้, ...]}
      ตัวกรองผิด → 400 validation_error ; หน้าที่ไม่มีอยู่ → 404 not_found
    - POST สำเร็จ → 201 ผู้ใช้ใหม่ ; ข้อมูลผิด/ซ้ำ/รหัสผ่านไม่ผ่านกฎ → 400 validation_error
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

    def post(self, request: Request) -> Response:
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        password = data.pop("password")

        try:
            # สร้างบัญชี + จดบันทึกใน transaction เดียว → จดไม่สำเร็จ บัญชีก็ไม่ถูกสร้าง
            with transaction.atomic():
                # create_user เข้ารหัสรหัสผ่าน (hash) และตั้ง is_staff=False — ไม่เข้าหน้า Django admin
                user = User.objects.create_user(password=password, created_by=request.user, **data)
                # สร้าง = ค่าที่ตั้งทุกช่อง ; รหัสผ่านถูกปิดเป็น "***" โดย log_action
                changes = created_changes(field_values(user, [*EDITABLE_FIELDS, "is_active"]))
                changes["password"] = None
                log_action(
                    actor=request.user, action=AuditAction.CREATE, target=user, changes=changes
                )
        except IntegrityError as error:
            raise _duplicate_error(data.get("email"), data.get("student_or_staff_id")) from error
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    """
    GET   /api/v1/admin/users/{id}/   ข้อมูลบัญชี 1 คน
    PATCH /api/v1/admin/users/{id}/   แก้ชื่อ / นามสกุล / อีเมล / รหัส / บทบาท (ส่งเฉพาะช่องที่แก้ก็ได้)

    - ไม่พบ → 404 not_found
    - PATCH สำเร็จ → 200 ผู้ใช้หลังแก้ ; ข้อมูลผิด/ซ้ำ → 400 validation_error
      เปลี่ยนบทบาทของตัวเอง → 403 cannot_modify_self (แก้ชื่อ/อีเมล/รหัสของตัวเองได้)
      ลดบทบาทผู้ดูแลระบบที่ใช้งานได้คนสุดท้าย → 409 last_active_admin
    - ช่อง is_active / is_staff / password ส่งมาก็ไม่มีผล (ระงับ/รีเซ็ตรหัสมีที่อยู่ของตัวเอง)
    - จด AuditLog action=update เฉพาะช่องที่เปลี่ยนจริง — รวมกรณีผู้ดูแลระบบแก้บัญชีตัวเองผ่านหน้านี้
      (ผู้ใช้เลือกข้อ 2.ก ; ต่างจากหน้าข้อมูลส่วนตัว UC-02 ที่ไม่จด) ; ไม่มีอะไรเปลี่ยน → ไม่จด
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: Request, pk: int) -> Response:
        user = get_object_or_404(User, pk=pk)
        return Response(AdminUserSerializer(user).data)

    def patch(self, request: Request, pk: int) -> Response:
        changing_role = "role" in request.data
        with transaction.atomic():
            # เปลี่ยนบทบาทอาจลดจำนวนผู้ดูแลระบบ → ล็อกแถวผู้ดูแลระบบก่อน แล้วค่อยล็อกแถวเป้าหมาย
            active_admin_ids = lock_active_admins() if changing_role else []
            user = get_object_or_404(User.objects.select_for_update(), pk=pk)

            serializer = AdminUserWriteSerializer(user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            new_role = serializer.validated_data.get("role", user.role)
            if new_role != user.role:
                if user.pk == request.user.pk:
                    raise cannot_modify_self_error()
                ensure_not_last_active_admin(user, active_admin_ids)

            before = field_values(user, EDITABLE_FIELDS)
            try:
                # savepoint ย่อย: ถ้าฐานข้อมูลปฏิเสธเพราะข้อมูลซ้ำ ย้อนเฉพาะส่วนนี้แล้วตอบ error ปกติ
                with transaction.atomic():
                    serializer.save()
            except IntegrityError as error:
                data = serializer.validated_data
                raise _duplicate_error(
                    data.get("email"), data.get("student_or_staff_id"), exclude_pk=user.pk
                ) from error

            changes = diff_changes(before, field_values(user, EDITABLE_FIELDS))
            if changes:
                log_action(
                    actor=request.user, action=AuditAction.UPDATE, target=user, changes=changes
                )
        return Response(AdminUserSerializer(user).data)


class AdminUserStatusView(APIView):
    """
    POST /api/v1/admin/users/{id}/suspend/    ระงับบัญชี (is_active → False)
    POST /api/v1/admin/users/{id}/activate/   เปิดใช้งานบัญชี (is_active → True)
    (ไม่มี body — ที่อยู่ไหนใช้ค่าไหนกำหนดด้วย is_active_after ใน manage_urls.py)

    - สำเร็จ → 200 ผู้ใช้หลังเปลี่ยน ; จด AuditLog {"is_active": [ค่าเดิม, ค่าใหม่]}
      สถานะเป็นแบบนั้นอยู่แล้ว → 200 เหมือนกัน แต่ไม่จด (ไม่มีอะไรเปลี่ยน)
    - บัญชีของตัวเอง → 403 cannot_modify_self
    - ระงับผู้ดูแลระบบที่ใช้งานได้คนสุดท้าย → 409 last_active_admin
    - ไม่พบ → 404 not_found
    ผลกับผู้ถูกระงับ: คำขอถัดไปถูกปฏิเสธทันที (ตัวยืนยันตัวตนตรวจ is_active ทุกคำขอ)
    และแลกบัตรใหม่ไม่ได้ — กลไกจากก้อน 1 ไม่ต้องเขียนเพิ่ม
    """

    permission_classes = [IsAuthenticated, IsAdminRole]
    # สถานะหลังทำรายการ: False = ระงับ, True = เปิดใช้งาน
    is_active_after: bool = False

    def post(self, request: Request, pk: int) -> Response:
        if pk == request.user.pk:
            raise cannot_modify_self_error()

        target_status = self.is_active_after
        with transaction.atomic():
            # ระงับอาจลดจำนวนผู้ดูแลระบบ → ล็อกแถวผู้ดูแลระบบก่อน (ดู lock_active_admins)
            active_admin_ids = [] if target_status else lock_active_admins()
            user = get_object_or_404(User.objects.select_for_update(), pk=pk)
            if user.is_active != target_status:
                if not target_status:
                    ensure_not_last_active_admin(user, active_admin_ids)
                user.is_active = target_status
                user.save(update_fields=["is_active", "updated_at"])
                log_action(
                    actor=request.user,
                    action=AuditAction.UPDATE,
                    target=user,
                    changes={"is_active": [not target_status, target_status]},
                )
        return Response(AdminUserSerializer(user).data)


class AdminPasswordResetView(APIView):
    """
    POST /api/v1/admin/users/{id}/password/  {new_password}   รีเซ็ตรหัสผ่านให้ผู้ใช้ที่ลืมรหัส

    - สำเร็จ → 204 (ไม่ส่งรหัสกลับ — ผู้ดูแลระบบรู้รหัสอยู่แล้วเพราะพิมพ์/สุ่มเอง)
      ผลกับผู้ใช้: refresh token ทุกใบขึ้นบัญชีดำ + บัตรเดิมทุกใบมีลายนิ้วมือรหัสเก่า (pwd)
      → **ทุกอุปกรณ์ของผู้ใช้ออกจากระบบทันที** (กลไกจากขั้น 1.7)
    - รหัสไม่ผ่านกฎ 4 ข้อ → 400 validation_error ช่อง new_password (เทียบความคล้ายกับเจ้าของบัญชี)
    - บัญชีของตัวเอง → 403 cannot_modify_self (ใช้หน้าข้อมูลส่วนตัวซึ่งต้องกรอกรหัสเดิม)
    - ไม่พบ → 404 not_found ; รีเซ็ตให้บัญชีที่ถูกระงับได้ (เตรียมรหัสไว้ก่อนเปิดใช้งาน)
    - จด AuditLog {"password": ["***", "***"]} — ไม่เก็บรหัสผ่านเด็ดขาด
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request: Request, pk: int) -> Response:
        if pk == request.user.pk:
            raise cannot_modify_self_error()

        with transaction.atomic():
            user = get_object_or_404(User.objects.select_for_update(), pk=pk)
            serializer = AdminPasswordResetSerializer(data=request.data, context={"user": user})
            serializer.is_valid(raise_exception=True)

            user.set_password(serializer.validated_data["new_password"])
            user.save(update_fields=["password", "updated_at"])
            revoke_all_refresh_tokens(user)
            # ค่าในช่อง password ถูกแทนเป็น ["***", "***"] โดย log_action เสมอ
            log_action(
                actor=request.user,
                action=AuditAction.UPDATE,
                target=user,
                changes={"password": None},
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
