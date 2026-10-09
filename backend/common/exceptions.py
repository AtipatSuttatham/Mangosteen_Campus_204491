"""
รูปแบบ error กลางของ API ทั้งระบบ (อ้างอิง: docs/api.md)

ทุก error จาก API ออกมาหน้าตาเดียวกัน:
    {
        "code": "validation_error",          ← รหัส error (frontend ใช้แปลเป็นข้อความไทย)
        "detail": "Invalid input.",          ← คำอธิบายภาษาอังกฤษสำหรับนักพัฒนา (ห้ามแสดงให้ผู้ใช้)
        "fields": {"name": ["required"]}     ← รหัส error รายช่อง (มีเฉพาะ validation_error)
    }

ไฟล์นี้มี 2 ส่วน:
- ApiError: ใช้โยน error เฉพาะเรื่องของระบบ เช่น raise ApiError("course_code_duplicate")
- api_exception_handler: ตัวแปลง error ทุกชนิดให้เป็นรูปแบบข้างบน (ตั้งใน settings.REST_FRAMEWORK)
"""

import logging
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# คำอธิบายสำหรับนักพัฒนาของ error ที่ไม่ได้ระบุไว้เอง
_VALIDATION_DETAIL = "Invalid input."
_SERVER_ERROR_DETAIL = "Internal server error."
# ชื่อช่องสำหรับ error ที่ไม่ได้ผูกกับช่องใดช่องหนึ่ง (เช่น ตรวจหลายช่องร่วมกัน)
NON_FIELD_ERRORS_KEY = "non_field_errors"


class ApiError(exceptions.APIException):
    """
    error เฉพาะเรื่องของระบบ (business rule) ที่ frontend ต้องแสดงข้อความเฉพาะ

    ตัวอย่าง:
        raise ApiError("course_code_duplicate", "Course code already exists in this term.")
        raise ApiError("quiz_time_over", status_code=409)

    - code: รหัส error (ตัวเล็ก คั่นด้วย _) — ต้องเพิ่มข้อความไทยใน th.ts ฝั่ง frontend ด้วย
    - detail: คำอธิบายภาษาอังกฤษสำหรับนักพัฒนา (ไม่แสดงให้ผู้ใช้)
    - status_code: HTTP status (ค่าเริ่มต้น 400)
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The request could not be processed."
    default_code = "error"

    def __init__(self, code: str, detail: str | None = None, status_code: int | None = None):
        super().__init__(detail=detail or self.default_detail, code=code)
        if status_code is not None:
            self.status_code = status_code


def _flatten_field_codes(codes: Any, prefix: str = "") -> dict[str, list[str]]:
    """
    แปลงรหัส error รายช่องของ DRF ให้เป็นรูปแบบเรียบ {ชื่อช่อง: [รหัส, ...]}

    - ช่องธรรมดา:           {"name": ["required"]}
    - ช่องซ้อนชั้น:          {"address": {"city": ["required"]}} → {"address.city": ["required"]}
    - รายการหลายแถว:        {"items": [{}, {"qty": ["invalid"]}]} → {"items.1.qty": ["invalid"]}
    - error ที่ไม่ผูกกับช่อง: ["invalid"] → {"non_field_errors": ["invalid"]}
    """
    # error แบบรายการรหัสตรง ๆ (ไม่ผูกกับช่อง หรือเป็นรหัสของช่องปัจจุบัน)
    if isinstance(codes, list) and all(isinstance(code, str) for code in codes):
        return {prefix or NON_FIELD_ERRORS_KEY: [str(code) for code in codes]}
    # รหัสเดียว (กรณีพิเศษ)
    if isinstance(codes, str):
        return {prefix or NON_FIELD_ERRORS_KEY: [codes]}

    flat: dict[str, list[str]] = {}
    # dict = ช่องต่าง ๆ ; list (ที่มี dict ข้างใน) = หลายแถว → ใช้ลำดับแถวเป็นชื่อ
    items = codes.items() if isinstance(codes, dict) else enumerate(codes)
    for key, value in items:
        name = f"{prefix}.{key}" if prefix else str(key)
        flat.update(_flatten_field_codes(value, name))
    return flat


def _code_of(exc: Exception) -> str:
    """หารหัส error ของ exception (ที่ไม่ใช่ validation error)"""
    if isinstance(exc, Http404):
        return exceptions.NotFound.default_code
    if isinstance(exc, DjangoPermissionDenied):
        return exceptions.PermissionDenied.default_code
    if isinstance(exc, exceptions.APIException):
        codes = exc.get_codes()
        # error ทั่วไปมีรหัสเดียวเป็นข้อความ ; ถ้าไม่ใช่ (กรณีแปลก) ใช้รหัสเริ่มต้นของชนิดนั้น
        return codes if isinstance(codes, str) else str(exc.default_code)
    return "error"


def _detail_of(exc: Exception) -> str:
    """คำอธิบายภาษาอังกฤษสำหรับนักพัฒนา"""
    if isinstance(exc, exceptions.APIException) and isinstance(exc.detail, str):
        return str(exc.detail)
    if isinstance(exc, Http404):
        return str(exceptions.NotFound.default_detail)
    if isinstance(exc, DjangoPermissionDenied):
        return str(exceptions.PermissionDenied.default_detail)
    return str(exc)


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    """
    แปลง error ทุกชนิดที่เกิดใน API view ให้เป็นรูปแบบกลาง {code, detail, fields?}
    ตั้งไว้ใน settings: REST_FRAMEWORK["EXCEPTION_HANDLER"]
    """
    # ให้ DRF จัดการขั้นแรก (ตั้ง HTTP status และ header ที่ถูกต้อง เช่น Retry-After ของ 429)
    response = drf_exception_handler(exc, context)

    # error ที่ไม่คาดคิด (บั๊กในโค้ด) — DRF ไม่จัดการให้
    if response is None:
        # บันทึกรายละเอียดเต็มลง log ของเซิร์ฟเวอร์ แต่ไม่ส่งรายละเอียดภายในออกไปให้ผู้ใช้
        logger.exception("Unhandled error in API view", exc_info=exc)
        return Response(
            {"code": "server_error", "detail": _SERVER_ERROR_DETAIL},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # error จากการกรอกข้อมูล → รหัสกลาง validation_error + รหัสรายช่อง
    if isinstance(exc, exceptions.ValidationError):
        response.data = {
            "code": "validation_error",
            "detail": _VALIDATION_DETAIL,
            "fields": _flatten_field_codes(exc.get_codes()),
        }
        return response

    # ยังไม่เข้าสู่ระบบ / ยืนยันตัวตนไม่ผ่าน → บังคับเป็น 401 เสมอ
    # (DRF จะตอบ 403 แทนถ้าวิธียืนยันตัวตนตัวแรกส่ง header WWW-Authenticate ไม่ได้ เช่น session
    #  แต่ frontend ใช้ 401 เป็นสัญญาณว่า "ต้องเข้าสู่ระบบ / ขอ token ใหม่" จึงต้องคงที่)
    if isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        response.status_code = status.HTTP_401_UNAUTHORIZED

    # error อื่น ๆ (ไม่ได้เข้าสู่ระบบ, ไม่มีสิทธิ์, ไม่พบ, ApiError ฯลฯ)
    response.data = {"code": _code_of(exc), "detail": _detail_of(exc)}
    return response
