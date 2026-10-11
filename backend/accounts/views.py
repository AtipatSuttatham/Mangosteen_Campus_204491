"""
API เข้าสู่ระบบ / แลก token / ออกจากระบบ / ข้อมูลของฉัน (UC-01) — อ้างอิง docs/api.md §6

ที่อยู่ทั้งหมดอยู่ใต้ /api/v1/auth/ (accounts/urls.py)
"""

from django.conf import settings
from django.contrib.auth.models import update_last_login
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, normalize_email
from accounts.serializers import LoginSerializer, MeSerializer
from accounts.tokens import delete_refresh_cookie, issue_refresh_token, set_refresh_cookie
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
        # ยกเลิกใบเดิมเสมอ — ใบละครั้งเดียว (ถ้ามีคนขโมยไปใช้ก่อน เจ้าของจะถูกบังคับ login ใหม่)
        refresh.blacklist()
        if user is None or not user.is_active:
            # บัญชีถูกระงับระหว่างใช้งาน → ไม่ออก token ใหม่ (คำขอถัดไปถูกปฏิเสธทันที — UC-04)
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
    GET /api/v1/auth/me/  (ต้องเข้าสู่ระบบ — ส่ง access token ใน header Authorization)

    คืนข้อมูลของผู้ใช้ที่เข้าสู่ระบบอยู่ ; บัญชีที่ถูกระงับ → 401 (ตรวจทุกคำขอ)
    """

    def get(self, request: Request) -> Response:
        return Response(MeSerializer(request.user, context={"request": request}).data)
