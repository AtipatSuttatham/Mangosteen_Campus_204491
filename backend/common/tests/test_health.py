"""
test ของ endpoint ตรวจสุขภาพระบบ GET /api/health/
"""

from unittest.mock import patch

import pytest
from django.db import OperationalError
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def client() -> APIClient:
    """ตัวจำลองการเรียก API (ไม่ได้เข้าสู่ระบบ)"""
    return APIClient()


@pytest.mark.django_db
def test_health_ok_when_database_available(client: APIClient) -> None:
    """ฐานข้อมูลปกติ → ต้องได้ 200 และสถานะ ok ทั้งระบบและฐานข้อมูล"""
    response = client.get(reverse("health-check"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.django_db
def test_health_returns_503_when_database_unavailable(client: APIClient) -> None:
    """จำลองว่าต่อฐานข้อมูลไม่ได้ → ต้องได้ 503 และบอกว่าฐานข้อมูลใช้งานไม่ได้"""
    # แทนที่คำสั่งเชื่อมต่อฐานข้อมูลด้วยตัวปลอมที่โยน error เสมอ
    with patch(
        "common.views.connection.ensure_connection",
        side_effect=OperationalError("จำลองฐานข้อมูลล่ม"),
    ):
        response = client.get(reverse("health-check"))

    assert response.status_code == 503
    assert response.json() == {"status": "error", "database": "unavailable"}


def test_health_rejects_post(client: APIClient) -> None:
    """endpoint นี้รับเฉพาะ GET — ส่ง POST มาต้องได้ 405 (Method Not Allowed)"""
    response = client.post(reverse("health-check"))

    assert response.status_code == 405
