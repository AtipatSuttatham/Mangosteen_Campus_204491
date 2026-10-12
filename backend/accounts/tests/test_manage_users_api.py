"""
test ของ API จัดการบัญชีผู้ใช้สำหรับผู้ดูแลระบบ (UC-04 — ขั้น 2.3)
อ้างอิงพฤติกรรม: docs/api.md §7, การตัดสินใจก้อน 2 ใน CLAUDE.md
ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
"""

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tokens import issue_refresh_token

pytestmark = pytest.mark.django_db

USERS_URL = "/api/v1/admin/users/"
PASSWORD = "a-strong-pass-123"


def detail_url(user: User) -> str:
    """ที่อยู่ของบัญชี 1 คน"""
    return f"{USERS_URL}{user.pk}/"


def make_user(email: str, role: str = User.Role.STUDENT, **extra) -> User:
    """สร้างบัญชีทดลอง (ข้อมูลสมมติ)"""
    extra.setdefault("first_name", "ทดลอง")
    extra.setdefault("last_name", "ระบบ")
    return User.objects.create_user(email=email, password=PASSWORD, role=role, **extra)


def client_for(user: User) -> APIClient:
    """เครื่องที่เข้าสู่ระบบเป็นผู้ใช้คนนี้ (แนบ access token จริง — ผ่านตัวตรวจ pwd ด้วย)"""
    client = APIClient()
    access = issue_refresh_token(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return client


@pytest.fixture
def admin() -> User:
    """ผู้ดูแลระบบที่ใช้ทดสอบ"""
    return make_user("admin@example.com", User.Role.ADMIN, first_name="ผู้ดูแล", last_name="หลัก")


@pytest.fixture
def admin_client(admin: User) -> APIClient:
    return client_for(admin)


@pytest.fixture
def student() -> User:
    return make_user(
        "somchai@example.com",
        first_name="สมชาย",
        last_name="ใจดี",
        student_or_staff_id="690000001",
    )


# --- สิทธิ์: ทุกที่อยู่ใช้ได้เฉพาะผู้ดูแลระบบ ---


class TestPermissions:
    def test_anonymous_gets_401(self, student: User) -> None:
        client = APIClient()
        assert client.get(USERS_URL).status_code == 401
        assert client.get(detail_url(student)).status_code == 401

    @pytest.mark.parametrize("role", [User.Role.TEACHER, User.Role.STUDENT])
    def test_non_admin_gets_403(self, role: str, student: User) -> None:
        client = client_for(make_user("someone@example.com", role))
        for response in (client.get(USERS_URL), client.get(detail_url(student))):
            assert response.status_code == 403
            assert response.json()["code"] == "permission_denied"

    def test_role_is_read_from_database_not_token(self, admin: User) -> None:
        # บัตรออกตอนยังเป็นผู้ดูแลระบบ แล้วถูกลดบทบาท → คำขอถัดไปถูกปฏิเสธทันที (ข้อ 1.ก)
        client = client_for(admin)
        User.objects.filter(pk=admin.pk).update(role=User.Role.TEACHER)
        assert client.get(USERS_URL).status_code == 403


# --- รายชื่อ: ค้นหา / กรอง / แบ่งหน้า ---


class TestList:
    def test_newest_first_with_public_fields_only(
        self, admin_client: APIClient, admin: User, student: User
    ) -> None:
        body = admin_client.get(USERS_URL).json()
        assert body["count"] == 2
        assert body["previous"] is None and body["next"] is None
        # student สร้างทีหลัง admin → ขึ้นก่อน
        assert [row["id"] for row in body["results"]] == [student.pk, admin.pk]
        assert set(body["results"][0]) == {
            "id",
            "email",
            "student_or_staff_id",
            "role",
            "first_name",
            "last_name",
            "is_active",
            "avatar_url",
            "date_joined",
            "last_login",
        }

    def test_pages_of_twenty(self, admin_client: APIClient) -> None:
        for index in range(24):
            make_user(f"user{index}@example.com")
        first = admin_client.get(USERS_URL).json()
        assert first["count"] == 25
        assert len(first["results"]) == 20
        assert first["next"] is not None
        second = admin_client.get(USERS_URL, {"page": 2}).json()
        assert len(second["results"]) == 5
        assert second["next"] is None

    def test_page_out_of_range_is_404(self, admin_client: APIClient) -> None:
        response = admin_client.get(USERS_URL, {"page": 99})
        assert response.status_code == 404
        assert response.json()["code"] == "not_found"

    @pytest.mark.parametrize("search", ["สมชาย", "ใจดี", "สมชาย ใจดี", "SOMCHAI@EXAMPLE", "69000000"])
    def test_search_name_full_name_email_and_id(
        self, admin_client: APIClient, student: User, search: str
    ) -> None:
        make_user("other@example.com", first_name="สมหญิง", last_name="รักเรียน")
        results = admin_client.get(USERS_URL, {"search": search}).json()["results"]
        assert [row["id"] for row in results] == [student.pk]

    def test_blank_search_returns_everyone(self, admin_client: APIClient, student: User) -> None:
        assert admin_client.get(USERS_URL, {"search": "  "}).json()["count"] == 2

    def test_filter_by_role_and_status(
        self, admin_client: APIClient, admin: User, student: User
    ) -> None:
        suspended = make_user("suspended@example.com", is_active=False)
        by_role = admin_client.get(USERS_URL, {"role": "admin"}).json()["results"]
        assert [row["id"] for row in by_role] == [admin.pk]
        inactive = admin_client.get(USERS_URL, {"is_active": "false"}).json()["results"]
        assert [row["id"] for row in inactive] == [suspended.pk]
        active_students = admin_client.get(
            USERS_URL, {"role": "student", "is_active": "true"}
        ).json()["results"]
        assert [row["id"] for row in active_students] == [student.pk]

    def test_unknown_filter_value_is_validation_error(self, admin_client: APIClient) -> None:
        response = admin_client.get(USERS_URL, {"role": "boss", "is_active": "maybe"})
        assert response.status_code == 400
        assert response.json()["fields"] == {
            "role": ["invalid_choice"],
            "is_active": ["invalid_choice"],
        }


# --- ดูบัญชี 1 คน ---


class TestDetail:
    def test_returns_user(self, admin_client: APIClient, student: User) -> None:
        body = admin_client.get(detail_url(student)).json()
        assert body["email"] == "somchai@example.com"
        assert body["student_or_staff_id"] == "690000001"
        assert "password" not in body

    def test_unknown_user_is_404(self, admin_client: APIClient) -> None:
        response = admin_client.get(f"{USERS_URL}999999/")
        assert response.status_code == 404
        assert response.json()["code"] == "not_found"
