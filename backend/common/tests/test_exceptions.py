"""
test ของรูปแบบ error กลาง (common/exceptions.py) — ทุก error ต้องออกมาเป็น {code, detail, fields?}
ใช้ view ตัวอย่างใน error_views.py แทนเส้นทางจริงของระบบ
"""

import logging

import pytest
from rest_framework.test import APIClient

# ทุก test ในไฟล์นี้ใช้เส้นทาง URL จาก error_views.py
pytestmark = pytest.mark.urls("common.tests.error_views")


@pytest.fixture
def client() -> APIClient:
    """ตัวจำลองการเรียก API (ไม่ได้เข้าสู่ระบบ)"""
    return APIClient()


def test_validation_error_lists_field_codes(client: APIClient) -> None:
    """กรอกข้อมูลผิดหลายช่อง → 400 + validation_error + รหัสรายช่อง (ไม่ใช่ข้อความภาษาอังกฤษ)"""
    response = client.post("/validation/", {"name": "too-long-name"}, format="json")

    assert response.status_code == 400
    assert response.json() == {
        "code": "validation_error",
        "detail": "Invalid input.",
        "fields": {"name": ["max_length"]},
    }


def test_validation_error_missing_required_field(client: APIClient) -> None:
    """ไม่ส่งช่องที่บังคับ → รหัส required"""
    response = client.post("/validation/", {}, format="json")

    assert response.status_code == 400
    assert response.json()["fields"] == {"name": ["required"]}


def test_validation_error_nested_field_uses_dotted_name(client: APIClient) -> None:
    """ช่องในฟอร์มย่อยซ้อนชั้น → ชื่อช่องแบบมีจุด เช่น address.city"""
    response = client.post("/validation/", {"name": "ok", "address": {}}, format="json")

    assert response.status_code == 400
    assert response.json()["fields"] == {"address.city": ["required"]}


def test_non_field_validation_error(client: APIClient) -> None:
    """error ที่ไม่ผูกกับช่องใด → อยู่ใต้ non_field_errors"""
    response = client.get("/non-field/")

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"
    assert response.json()["fields"] == {"non_field_errors": ["date_range"]}


@pytest.mark.parametrize(
    ("url", "status_code", "code"),
    [
        ("/not-found/", 404, "not_found"),
        ("/permission/", 403, "permission_denied"),
        ("/not-authenticated/", 401, "not_authenticated"),
    ],
)
def test_standard_errors_use_standard_codes(
    client: APIClient, url: str, status_code: int, code: str
) -> None:
    """error มาตรฐาน (ไม่พบ / ไม่มีสิทธิ์ / ยังไม่เข้าสู่ระบบ) → รหัสมาตรฐาน ไม่มีช่อง fields"""
    response = client.get(url)

    assert response.status_code == status_code
    body = response.json()
    assert body["code"] == code
    assert isinstance(body["detail"], str)
    assert "fields" not in body


def test_not_found_does_not_leak_internal_message(client: APIClient) -> None:
    """Http404 ที่มีข้อความภายใน (เช่น รหัสแถวในฐานข้อมูล) → ไม่ส่งข้อความนั้นออกไป"""
    response = client.get("/not-found/")

    assert "Course 99" not in response.content.decode()


def test_api_error_with_custom_status(client: APIClient) -> None:
    """ApiError เฉพาะเรื่อง + HTTP status ที่กำหนดเอง"""
    response = client.get("/api-error/")

    assert response.status_code == 409
    assert response.json() == {
        "code": "course_code_duplicate",
        "detail": "Course code already exists.",
    }


def test_api_error_defaults(client: APIClient) -> None:
    """ApiError ที่ไม่ระบุ status/คำอธิบาย → 400 + คำอธิบายเริ่มต้น"""
    response = client.get("/api-error-default/")

    assert response.status_code == 400
    assert response.json() == {
        "code": "quiz_closed",
        "detail": "The request could not be processed.",
    }


def test_unexpected_error_returns_500_without_internal_details(
    client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
    """บั๊กที่ไม่คาดคิด → 500 + server_error ; ข้อความภายในไม่หลุดถึงผู้ใช้ แต่ถูกบันทึกใน log"""
    with caplog.at_level(logging.ERROR, logger="common.exceptions"):
        response = client.get("/crash/")

    assert response.status_code == 500
    assert response.json() == {"code": "server_error", "detail": "Internal server error."}
    assert "hunter2" not in response.content.decode()
    # รายละเอียดเต็มอยู่ใน log ของเซิร์ฟเวอร์สำหรับนักพัฒนา
    assert "Unhandled error in API view" in caplog.text
