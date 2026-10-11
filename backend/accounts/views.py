"""
API เข้าสู่ระบบ / แลก token / ออกจากระบบ (UC-01) + ข้อมูลส่วนตัว (UC-02) — อ้างอิง docs/api.md §6

ที่อยู่ทั้งหมดอยู่ใต้ /api/v1/auth/ (accounts/urls.py)
"""

from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.avatars import AvatarError, process_avatar
from accounts.models import User, normalize_email
from accounts.serializers import (
    AvatarUploadSerializer,
    LoginSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    ProfileUpdateSerializer,
)
from accounts.tokens import (
    PASSWORD_CLAIM,
    claim_refresh_token,
    delete_refresh_cookie,
    issue_refresh_token,
    password_fingerprint_matches,
    revoke_all_refresh_tokens,
    set_refresh_cookie,
)
from common.exceptions import ApiError


def _find_user(identifier: str) -> User | None:
    """หาผู้ใช้จากช่องเดียว: มี "@" = อีเมล (ไม่สนตัวพิมพ์) ; ไม่มี = รหัสนักศึกษา/พนักงาน"""
    identifier = identifier.strip()
    if "@" in identifier:
        return User.objects.filter(email=normalize_email(identifier)).first()
    return User.objects.filter(student_or_staff_id=identifier).first()


def _token_response(
    user: User, request: Request, status_code: int = status.HTTP_200_OK
) -> Response:
    """
    ออก token ชุดใหม่ให้ผู้ใช้ แล้วสร้างคำตอบ:
    JSON = {access, user} ; refresh token แนบเป็น httpOnly cookie
    """
    refresh = issue_refresh_token(user)
    response = Response(
        {
            "access": str(refresh.access_token),
            "user": MeSerializer(user, context={"request": request}).data,
        },
        status=status_code,
    )
    set_refresh_cookie(response, refresh)
    return response


def _session_expired_response() -> Response:
    """
    คำตอบเมื่อแลก token ไม่ได้ (ไม่มี cookie / หมดอายุ / ถูกยกเลิก / บัญชีถูกระงับ)
    → 401 authentication_failed + ลบ cookie ที่ใช้ไม่ได้แล้วทิ้ง
    (สร้างเองแทนการโยน error เพราะต้องลบ cookie ไปพร้อมกัน)
    """
    response = Response(
        {"code": "authentication_failed", "detail": "Refresh token is missing or invalid."},
        status=status.HTTP_401_UNAUTHORIZED,
    )
    delete_refresh_cookie(response)
    return response


class LoginView(APIView):
    """
    POST /api/v1/auth/login/  {identifier, password}

    - สำเร็จ → 200 {access, user} + cookie refresh token
    - ไม่พบบัญชี / รหัสผ่านผิด → 400 invalid_credentials (ข้อความรวม ไม่บอกว่าผิดช่องไหน)
    - รหัสผ่านถูกแต่บัญชีถูกระงับ → 403 account_disabled
      (บอกว่าระงับ "เฉพาะเมื่อรหัสผ่านถูก" — คนเดารหัสจะไม่รู้สถานะบัญชี ; CLAUDE.md ก้อน 1)
    """

    # ไม่ต้องเข้าสู่ระบบก่อน และไม่อ่าน access token เก่า (ถ้าหมดอายุจะไม่ทำให้ login ล้ม)
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        password = serializer.validated_data["password"]

        user = _find_user(identifier)
        if user is None:
            # ไม่พบบัญชี → เสียเวลาเข้ารหัสรหัสผ่านเท่ากับกรณีพบบัญชี
            # (กันการเดาจากเวลาตอบว่าอีเมล/รหัสนี้มีอยู่ในระบบหรือไม่)
            User().set_password(password)
            raise ApiError("invalid_credentials", "Invalid identifier or password.")
        if not user.check_password(password):
            raise ApiError("invalid_credentials", "Invalid identifier or password.")
        if not user.is_active:
            raise ApiError(
                "account_disabled", "This account is disabled.", status.HTTP_403_FORBIDDEN
            )

        # บันทึกเวลาเข้าสู่ระบบล่าสุด (last_login)
        update_last_login(None, user)
        return _token_response(user, request)


class RefreshView(APIView):
    """
    POST /api/v1/auth/refresh/  (ไม่มี body — อ่าน refresh token จาก cookie)

    ใช้ตอนเปิดหน้าเว็บใหม่ และเมื่อ access token หมดอายุ
    - สำเร็จ → 200 {access, user} + cookie refresh token ใบใหม่ (ใบเก่าขึ้นบัญชีดำ ใช้ซ้ำไม่ได้)
    - ไม่มี cookie / ใช้ไม่ได้ / บัญชีถูกระงับ → 401 authentication_failed + ลบ cookie
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request: Request) -> Response:
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw_token:
            return _session_expired_response()

        try:
            # ตรวจลายเซ็น + วันหมดอายุ + บัญชีดำ (ใบที่เคยใช้/ออกจากระบบแล้ว ใช้ไม่ได้)
            refresh = RefreshToken(raw_token)
        except TokenError:
            return _session_expired_response()

        user = User.objects.filter(pk=refresh.get("user_id")).first()
        # "ใช้" ใบเดิม — ใบละครั้งเดียว แม้ยื่นพร้อมกันหลายคำขอ (ขั้น 1.4.1)
        # ถ้ามีคำขออื่นใช้ไปก่อนแล้ว (หรือมีคนขโมยไปใช้ก่อน) → ไม่ออกบัตรใหม่
        if not claim_refresh_token(refresh):
            return _session_expired_response()
        if user is None or not user.is_active:
            # บัญชีถูกระงับระหว่างใช้งาน → ไม่ออก token ใหม่ (คำขอถัดไปถูกปฏิเสธทันที — UC-04)
            return _session_expired_response()
        if not password_fingerprint_matches(user, refresh.get(PASSWORD_CLAIM)):
            # บัตรออกก่อนการเปลี่ยนรหัสผ่าน → ไม่ออกบัตรใหม่ (ชั้นป้องกันที่ 2 นอกจากบัญชีดำ — ขั้น 1.7)
            return _session_expired_response()

        # ออกชุดใหม่ (อ่านบทบาทล่าสุดจากฐานข้อมูล — ถ้าผู้ดูแลระบบเปลี่ยนบทบาท จะมีผลทันที)
        return _token_response(user, request)


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/  (อ่าน refresh token จาก cookie)

    ยกเลิก refresh token (ขึ้นบัญชีดำ) + ลบ cookie → 204
    ทำได้เสมอแม้ access token หมดอายุแล้ว หรือไม่มี cookie (ผลเหมือนกัน: ออกจากระบบ)
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request: Request) -> Response:
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_token:
            try:
                RefreshToken(raw_token).blacklist()
            except TokenError:
                # token หมดอายุ/ถูกยกเลิกไปแล้ว — ไม่ต้องทำอะไรเพิ่ม
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        delete_refresh_cookie(response)
        return response


class MeView(APIView):
    """
    GET   /api/v1/auth/me/  ข้อมูลของผู้ใช้ที่เข้าสู่ระบบอยู่
    PATCH /api/v1/auth/me/  แก้ชื่อ-นามสกุล / อีเมลของตัวเอง (UC-02 — ขั้น 1.7)

    ต้องเข้าสู่ระบบ (access token ใน header Authorization) ; บัญชีที่ถูกระงับ → 401 (ตรวจทุกคำขอ)
    """

    def get(self, request: Request) -> Response:
        return Response(MeSerializer(request.user).data)

    def patch(self, request: Request) -> Response:
        """
        ส่งเฉพาะช่องที่แก้ก็ได้ → 200 ข้อมูลผู้ใช้ล่าสุด
        ไม่ผ่าน → 400 validation_error เช่น {"email": ["unique"]}, {"first_name": ["blank"]}
        """
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as error:
            # อีกคนเปลี่ยนเป็นอีเมลเดียวกันในจังหวะเดียวกัน (ผ่านการตรวจทั้งคู่) → กฎห้ามซ้ำของ
            # ฐานข้อมูลกันไว้ได้ ; ตอบเป็น error ปกติแทนที่จะเป็น 500
            raise ValidationError(
                {"email": [ErrorDetail("This email is already in use.", code="unique")]}
            ) from error
        return Response(MeSerializer(request.user).data)


class PasswordChangeView(APIView):
    """
    POST /api/v1/auth/me/password/  {current_password, new_password}  (UC-02 — ขั้น 1.7)

    - สำเร็จ → 200 {access, user} + cookie refresh token ใบใหม่ (เหมือนตอน login)
      เครื่องที่ใช้อยู่จึงยังอยู่ในระบบ ; **อุปกรณ์อื่นออกจากระบบทันที** เพราะ
        1) refresh token ทุกใบของผู้ใช้ขึ้นบัญชีดำ → แลกบัตรใหม่ไม่ได้
        2) access token ที่ค้างอยู่มีลายนิ้วมือของรหัสเดิม → ถูกปฏิเสธในคำขอถัดไป
           (accounts/authentication.py — ผู้ใช้เลือกแบบ ก)
    - รหัสเดิมผิด / รหัสใหม่ไม่ผ่านกฎ → 400 validation_error พร้อมรหัสรายช่อง
    """

    def post(self, request: Request) -> Response:
        user = request.user
        serializer = PasswordChangeSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user.set_password(serializer.validated_data["new_password"])
            user.save(update_fields=["password", "updated_at"])
            revoke_all_refresh_tokens(user)
        return _token_response(user, request)


class AvatarView(APIView):
    """
    POST   /api/v1/auth/me/avatar/  อัปโหลด/เปลี่ยนรูปประจำตัว (multipart ช่อง avatar) — ขั้น 1.7
    DELETE /api/v1/auth/me/avatar/  ลบรูปประจำตัว (กลับไปแสดงตัวอักษรย่อ)

    ทั้งสองแบบตอบ 200 ข้อมูลผู้ใช้ล่าสุด (avatar_url ใหม่ หรือ null)
    รูปใช้ไม่ได้ → 400 avatar_too_large / avatar_invalid_type (รายละเอียดใน accounts/avatars.py)
    ไฟล์รูปเดิมถูกลบจากที่เก็บไฟล์หลังบันทึกสำเร็จ (ไม่ทิ้งไฟล์ค้าง)
    """

    # รับไฟล์แบบ multipart เท่านั้น (แบบที่เบราว์เซอร์ใช้ส่งไฟล์)
    parser_classes = [MultiPartParser]

    # เผื่อขนาดส่วนหัวของ multipart (ชื่อช่อง, ชื่อไฟล์, เส้นคั่น) นอกจากตัวไฟล์
    _MULTIPART_OVERHEAD = 16 * 1024

    def post(self, request: Request) -> Response:
        # ปฏิเสธคำขอที่ใหญ่เกินตั้งแต่ดูขนาดที่แจ้งมา — ไม่ต้องรับไฟล์ใหญ่ทั้งไฟล์ก่อน
        declared_size = int(request.META.get("CONTENT_LENGTH") or 0)
        if declared_size > settings.AVATAR_MAX_BYTES + self._MULTIPART_OVERHEAD:
            raise ApiError("avatar_too_large", "Avatar file is larger than 2 MB.")

        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            content = process_avatar(serializer.validated_data["avatar"])
        except AvatarError as error:
            raise ApiError(error.code, error.detail) from error

        user = request.user
        old_name = user.avatar_url.name
        # ชื่อไฟล์สุ่ม: เดาลิงก์รูปของคนอื่นไม่ได้ และเปลี่ยนรูปแล้วเบราว์เซอร์ไม่แสดงรูปเก่าค้าง
        user.avatar_url.save(f"{uuid4().hex}.webp", content, save=False)
        try:
            user.save(update_fields=["avatar_url", "updated_at"])
        except Exception:
            # บันทึกฐานข้อมูลไม่สำเร็จ → ลบไฟล์ใหม่ที่เพิ่งเขียน ไม่ให้ค้างในที่เก็บไฟล์
            user.avatar_url.storage.delete(user.avatar_url.name)
            raise
        _delete_file_later(user, old_name)
        return Response(MeSerializer(user).data)

    def delete(self, request: Request) -> Response:
        user = request.user
        old_name = user.avatar_url.name
        if old_name:
            user.avatar_url = ""
            user.save(update_fields=["avatar_url", "updated_at"])
            _delete_file_later(user, old_name)
        return Response(MeSerializer(user).data)


def _delete_file_later(user: User, name: str) -> None:
    """
    ลบไฟล์รูปเดิมออกจากที่เก็บไฟล์ หลังฐานข้อมูลบันทึกเสร็จจริง (on_commit)
    ถ้าการบันทึกถูกยกเลิก ไฟล์เดิมยังอยู่ → ข้อมูลกับไฟล์ไม่หลุดกัน
    """
    if name:
        storage = user.avatar_url.storage
        transaction.on_commit(lambda: storage.delete(name))
