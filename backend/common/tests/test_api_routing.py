"""
test ของเส้นทาง API ระดับระบบ (config/urls.py) และการตั้งค่า CORS
"""

import pytest
from django.test import override_settings
from rest_framework.test import APIClient


@pytest.fixture
def client() -> APIClient:
    """ตัวจำลองการเรียก API (ไม่ได้เข้าสู่ระบบ)"""
    return APIClient()


@pytest.mark.parametrize("url", ["/api/v1/does-not-exist/", "/api/unknown/", "/api/"])
def test_unknown_api_path_returns_json_404(client: APIClient, url: str) -> None:
    """ที่อยู่ใต้ /api/ ที่ไม่มีอยู่จริง → 404 ในรูปแบบ error กลาง (JSON ไม่ใช่หน้า HTML)"""
    response = client.get(url)

    assert response.status_code == 404
    assert response["Content-Type"].startswith("application/json")
    assert response.json()["code"] == "not_found"


def test_unknown_api_path_with_post_returns_json_404(client: APIClient) -> None:
    """ส่ง POST ไปที่อยู่ API ที่ไม่มีอยู่จริง → ยังได้ 404 แบบ JSON (ไม่ใช่ 405)"""
    response = client.post("/api/v1/does-not-exist/", {}, format="json")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


@pytest.mark.django_db
@override_settings(CORS_ALLOWED_ORIGINS=["https://campus.example.com"])
def test_cors_allows_configured_origin(client: APIClient) -> None:
    """โดเมนที่อยู่ในรายชื่อ → ได้ header อนุญาต CORS + อนุญาตส่ง cookie"""
    response = client.get("/api/health/", HTTP_ORIGIN="https://campus.example.com")

    assert response["Access-Control-Allow-Origin"] == "https://campus.example.com"
    assert response["Access-Control-Allow-Credentials"] == "true"


@pytest.mark.django_db
@override_settings(CORS_ALLOWED_ORIGINS=["https://campus.example.com"])
def test_cors_rejects_other_origin(client: APIClient) -> None:
    """โดเมนที่ไม่อยู่ในรายชื่อ → ไม่ได้ header อนุญาต (เบราว์เซอร์จะบล็อกเอง)"""
    response = client.get("/api/health/", HTTP_ORIGIN="https://evil.example.com")

    assert "Access-Control-Allow-Origin" not in response


@pytest.mark.django_db
def test_cors_default_allows_nobody(client: APIClient) -> None:
    """ค่าเริ่มต้น (ไม่ได้ตั้งใน .env) → ไม่อนุญาตโดเมนใดเลย"""
    response = client.get("/api/health/", HTTP_ORIGIN="http://localhost:5180")

    assert "Access-Control-Allow-Origin" not in response
