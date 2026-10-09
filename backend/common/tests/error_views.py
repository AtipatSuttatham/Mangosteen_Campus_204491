"""
view และเส้นทาง URL สำหรับ test รูปแบบ error เท่านั้น (ไม่ได้อยู่ในระบบจริง)
test ใช้ไฟล์นี้แทน config/urls.py ผ่าน @pytest.mark.urls("common.tests.error_views")
แต่ละ view โยน error คนละชนิด เพื่อตรวจว่า api_exception_handler แปลงได้ถูกต้อง
"""

from django.core.exceptions import PermissionDenied
from django.http import Http404
from django.urls import path
from rest_framework import exceptions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from common.exceptions import ApiError


class _AddressSerializer(serializers.Serializer):
    """ฟอร์มย่อยซ้อนชั้น (ใช้ทดสอบชื่อช่องแบบ address.city)"""

    city = serializers.CharField()


class _SampleSerializer(serializers.Serializer):
    """ฟอร์มตัวอย่าง: ชื่อ (บังคับ, ยาวไม่เกิน 5) + ที่อยู่ (ฟอร์มย่อย ไม่บังคับ)"""

    name = serializers.CharField(max_length=5)
    address = _AddressSerializer(required=False)


@api_view(["POST"])
@permission_classes([AllowAny])
def validation_view(request: Request) -> Response:
    """ตรวจข้อมูลที่ส่งมาด้วยฟอร์มตัวอย่าง (ผิด → ValidationError)"""
    serializer = _SampleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.validated_data)


@api_view(["GET"])
@permission_classes([AllowAny])
def non_field_view(request: Request) -> Response:
    """error จากการตรวจที่ไม่ผูกกับช่องใด"""
    raise exceptions.ValidationError("Start date must be before end date.", code="date_range")


@api_view(["GET"])
@permission_classes([AllowAny])
def not_found_view(request: Request) -> Response:
    """ไม่พบข้อมูล (แบบ Django)"""
    raise Http404("Course 99 does not exist")


@api_view(["GET"])
@permission_classes([AllowAny])
def permission_view(request: Request) -> Response:
    """ไม่มีสิทธิ์ (แบบ Django)"""
    raise PermissionDenied


@api_view(["GET"])
@permission_classes([AllowAny])
def not_authenticated_view(request: Request) -> Response:
    """ยังไม่เข้าสู่ระบบ"""
    raise exceptions.NotAuthenticated


@api_view(["GET"])
@permission_classes([AllowAny])
def api_error_view(request: Request) -> Response:
    """error เฉพาะเรื่องของระบบ พร้อม HTTP status ที่กำหนดเอง"""
    raise ApiError("course_code_duplicate", "Course code already exists.", status_code=409)


@api_view(["GET"])
@permission_classes([AllowAny])
def api_error_default_view(request: Request) -> Response:
    """error เฉพาะเรื่องของระบบ ใช้ค่าเริ่มต้น (HTTP 400 + คำอธิบายเริ่มต้น)"""
    raise ApiError("quiz_closed")


@api_view(["GET"])
@permission_classes([AllowAny])
def crash_view(request: Request) -> Response:
    """บั๊กที่ไม่คาดคิด — ข้อความภายในต้องไม่หลุดออกไปถึงผู้ใช้"""
    raise RuntimeError("secret internal detail: database password is hunter2")


urlpatterns = [
    path("validation/", validation_view),
    path("non-field/", non_field_view),
    path("not-found/", not_found_view),
    path("permission/", permission_view),
    path("not-authenticated/", not_authenticated_view),
    path("api-error/", api_error_view),
    path("api-error-default/", api_error_default_view),
    path("crash/", crash_view),
]
