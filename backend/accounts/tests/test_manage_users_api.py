"""
test ของ API จัดการบัญชีผู้ใช้สำหรับผู้ดูแลระบบ (UC-04 — ขั้น 2.3)
อ้างอิงพฤติกรรม: docs/api.md §7, การตัดสินใจก้อน 2 ใน CLAUDE.md
ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
"""

import pytest
from django.conf import settings
from django.db import transaction
from rest_framework.test import APIClient

from accounts.manage_views import ensure_not_last_active_admin, lock_active_admins
from accounts.models import User
from accounts.tokens import issue_refresh_token
from audit.models import AuditAction, AuditLog
from common.exceptions import ApiError

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


# --- เพิ่มบัญชี ---


def new_user_payload(**overrides) -> dict:
    """ข้อมูลบัญชีใหม่ที่ถูกต้อง (ข้อมูลสมมติ)"""
    payload = {
        "email": "  New.Teacher@Example.com ",
        "student_or_staff_id": " T-0001 ",
        "first_name": "  มานี ",
        "last_name": "มีสุข",
        "role": "teacher",
        "password": "temp-pass-4821",
    }
    payload.update(overrides)
    return payload


class TestCreate:
    def test_creates_user_and_normalizes_fields(self, admin_client: APIClient, admin: User) -> None:
        response = admin_client.post(USERS_URL, new_user_payload(), format="json")
        assert response.status_code == 201
        body = response.json()
        assert body["email"] == "new.teacher@example.com"
        assert body["student_or_staff_id"] == "T-0001"
        assert body["first_name"] == "มานี"
        assert body["is_active"] is True
        assert "password" not in body

        user = User.objects.get(pk=body["id"])
        assert user.check_password("temp-pass-4821")
        assert user.created_by == admin
        # สร้างผ่าน API ไม่ได้สิทธิ์เข้าหน้า Django admin
        assert user.is_staff is False and user.is_superuser is False

    def test_new_user_can_log_in(self, admin_client: APIClient) -> None:
        admin_client.post(USERS_URL, new_user_payload(), format="json")
        response = APIClient().post(
            "/api/v1/auth/login/",
            {"identifier": "T-0001", "password": "temp-pass-4821"},
            format="json",
        )
        assert response.status_code == 200

    def test_id_is_optional(self, admin_client: APIClient) -> None:
        for index, value in enumerate([None, "", "   "]):
            payload = new_user_payload(email=f"noid{index}@example.com", student_or_staff_id=value)
            response = admin_client.post(USERS_URL, payload, format="json")
            assert response.status_code == 201
            assert response.json()["student_or_staff_id"] is None
        missing = new_user_payload(email="missing@example.com")
        del missing["student_or_staff_id"]
        assert admin_client.post(USERS_URL, missing, format="json").status_code == 201

    def test_can_create_admin(self, admin_client: APIClient) -> None:
        response = admin_client.post(USERS_URL, new_user_payload(role="admin"), format="json")
        assert response.status_code == 201
        assert User.objects.get(pk=response.json()["id"]).is_staff is False

    def test_required_fields(self, admin_client: APIClient) -> None:
        response = admin_client.post(USERS_URL, {}, format="json")
        assert response.status_code == 400
        assert response.json()["fields"] == {
            "email": ["required"],
            "first_name": ["required"],
            "last_name": ["required"],
            "role": ["required"],
            "password": ["required"],
        }

    def test_invalid_values(self, admin_client: APIClient) -> None:
        payload = new_user_payload(email="not-an-email", first_name="   ", role="boss")
        fields = admin_client.post(USERS_URL, payload, format="json").json()["fields"]
        assert fields == {
            "email": ["invalid"],
            "first_name": ["blank"],
            "role": ["invalid_choice"],
        }

    def test_duplicate_email_ignores_case_and_duplicate_id(
        self, admin_client: APIClient, student: User
    ) -> None:
        payload = new_user_payload(email="SOMCHAI@example.com", student_or_staff_id="690000001")
        response = admin_client.post(USERS_URL, payload, format="json")
        assert response.status_code == 400
        assert response.json()["fields"] == {
            "email": ["unique"],
            "student_or_staff_id": ["unique"],
        }

    @pytest.mark.parametrize(
        ("password", "code"),
        [
            ("short1", "password_too_short"),
            ("password123", "password_too_common"),
            ("8392017465", "password_entirely_numeric"),
            ("new.teacher", "password_too_similar"),
        ],
    )
    def test_password_rules(self, admin_client: APIClient, password: str, code: str) -> None:
        response = admin_client.post(USERS_URL, new_user_payload(password=password), format="json")
        assert response.status_code == 400
        assert code in response.json()["fields"]["password"]
        assert not User.objects.filter(email="new.teacher@example.com").exists()

    def test_writes_audit_log_without_password(self, admin_client: APIClient, admin: User) -> None:
        response = admin_client.post(USERS_URL, new_user_payload(), format="json")
        log = AuditLog.objects.get()
        assert log.actor == admin
        assert log.action == AuditAction.CREATE
        assert log.object_id == str(response.json()["id"])
        assert log.changes == {
            "email": [None, "new.teacher@example.com"],
            "student_or_staff_id": [None, "T-0001"],
            "first_name": [None, "มานี"],
            "last_name": [None, "มีสุข"],
            "role": [None, "teacher"],
            "is_active": [None, True],
            "password": ["***", "***"],
        }
        assert "temp-pass-4821" not in str(log.changes)

    def test_failed_create_writes_no_log(self, admin_client: APIClient) -> None:
        admin_client.post(USERS_URL, new_user_payload(role="boss"), format="json")
        assert not AuditLog.objects.exists()

    def test_database_duplicate_becomes_validation_error(
        self, admin_client: APIClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # จำลองจังหวะ "2 คำขอพร้อมกัน": ผ่านการตรวจแล้ว แต่มีบัญชีอีเมลเดียวกันถูกสร้างก่อนบันทึก
        original = User.objects.create_user

        def create_twice(**kwargs):
            # สร้างบัญชีที่ชนกันด้วยตัวดั้งเดิม (ไม่ผ่านตัวจำลองนี้ซ้ำ)
            original(email=kwargs["email"], password=PASSWORD, role="student")
            return original(**kwargs)

        monkeypatch.setattr(User.objects, "create_user", create_twice)
        response = admin_client.post(USERS_URL, new_user_payload(), format="json")
        assert response.status_code == 400
        assert response.json()["fields"] == {"email": ["unique"]}
        assert not AuditLog.objects.exists()


# --- แก้ไขบัญชี ---


class TestUpdate:
    def test_updates_given_fields_only(self, admin_client: APIClient, student: User) -> None:
        response = admin_client.patch(
            detail_url(student),
            {"email": " Somchai.J@Example.com ", "role": "teacher"},
            format="json",
        )
        assert response.status_code == 200
        body = response.json()
        assert body["email"] == "somchai.j@example.com"
        assert body["role"] == "teacher"
        # ช่องที่ไม่ได้ส่งมาคงเดิม
        assert body["first_name"] == "สมชาย"
        assert body["student_or_staff_id"] == "690000001"

    def test_can_clear_id(self, admin_client: APIClient, student: User) -> None:
        response = admin_client.patch(
            detail_url(student), {"student_or_staff_id": ""}, format="json"
        )
        assert response.json()["student_or_staff_id"] is None

    def test_ignores_status_staff_and_password_fields(
        self, admin_client: APIClient, student: User
    ) -> None:
        admin_client.patch(
            detail_url(student),
            {"is_active": False, "is_staff": True, "password": "x-new-pass-999"},
            format="json",
        )
        student.refresh_from_db()
        assert student.is_active is True
        assert student.is_staff is False
        assert student.check_password(PASSWORD)

    def test_keeping_own_email_is_not_duplicate(
        self, admin_client: APIClient, student: User
    ) -> None:
        response = admin_client.patch(
            detail_url(student), {"email": "SOMCHAI@example.com"}, format="json"
        )
        assert response.status_code == 200

    def test_duplicate_email_and_id(
        self, admin_client: APIClient, admin: User, student: User
    ) -> None:
        make_user("other@example.com", student_or_staff_id="690000002")
        response = admin_client.patch(
            detail_url(student),
            {"email": "ADMIN@example.com", "student_or_staff_id": "690000002"},
            format="json",
        )
        assert response.status_code == 400
        assert response.json()["fields"] == {
            "email": ["unique"],
            "student_or_staff_id": ["unique"],
        }

    def test_blank_name_and_unknown_role(self, admin_client: APIClient, student: User) -> None:
        response = admin_client.patch(
            detail_url(student), {"last_name": " ", "role": "boss"}, format="json"
        )
        assert response.json()["fields"] == {"last_name": ["blank"], "role": ["invalid_choice"]}

    def test_unknown_user_is_404(self, admin_client: APIClient) -> None:
        response = admin_client.patch(f"{USERS_URL}999999/", {"role": "teacher"}, format="json")
        assert response.status_code == 404

    def test_audit_log_has_changed_fields_only(
        self, admin_client: APIClient, admin: User, student: User
    ) -> None:
        admin_client.patch(
            detail_url(student),
            {"first_name": "สมชาย", "last_name": "ใจงาม", "role": "teacher"},
            format="json",
        )
        log = AuditLog.objects.get()
        assert log.actor == admin
        assert log.action == AuditAction.UPDATE
        assert log.object_id == str(student.pk)
        assert log.changes == {"last_name": ["ใจดี", "ใจงาม"], "role": ["student", "teacher"]}

    def test_no_change_writes_no_log(self, admin_client: APIClient, student: User) -> None:
        response = admin_client.patch(
            detail_url(student), {"first_name": "สมชาย", "role": "student"}, format="json"
        )
        assert response.status_code == 200
        assert not AuditLog.objects.exists()


class TestSelfEdit:
    def test_admin_can_edit_own_name_email_and_id_with_audit(
        self, admin_client: APIClient, admin: User
    ) -> None:
        response = admin_client.patch(
            detail_url(admin),
            {"first_name": "ผู้ดูแลใหม่", "email": "admin2@example.com", "student_or_staff_id": "S1"},
            format="json",
        )
        assert response.status_code == 200
        # ผู้ใช้เลือกข้อ 2.ก: แก้บัญชีตัวเองผ่านหน้าจัดการผู้ใช้ → จดบันทึก
        assert AuditLog.objects.get().changes == {
            "email": ["admin@example.com", "admin2@example.com"],
            "student_or_staff_id": [None, "S1"],
            "first_name": ["ผู้ดูแล", "ผู้ดูแลใหม่"],
        }

    def test_sending_own_unchanged_role_is_allowed(
        self, admin_client: APIClient, admin: User
    ) -> None:
        response = admin_client.patch(
            detail_url(admin), {"role": "admin", "last_name": "ใหม่"}, format="json"
        )
        assert response.status_code == 200

    def test_cannot_change_own_role(self, admin_client: APIClient, admin: User) -> None:
        make_user("admin2@example.com", User.Role.ADMIN)
        response = admin_client.patch(
            detail_url(admin), {"role": "teacher", "first_name": "x"}, format="json"
        )
        assert response.status_code == 403
        assert response.json()["code"] == "cannot_modify_self"
        admin.refresh_from_db()
        # ทั้งคำขอถูกยกเลิก — ชื่อไม่เปลี่ยนด้วย
        assert admin.role == User.Role.ADMIN and admin.first_name == "ผู้ดูแล"
        assert not AuditLog.objects.exists()


class TestLastActiveAdmin:
    def test_can_demote_another_admin_when_one_remains(
        self, admin_client: APIClient, admin: User
    ) -> None:
        other = make_user("admin2@example.com", User.Role.ADMIN)
        response = admin_client.patch(detail_url(other), {"role": "teacher"}, format="json")
        assert response.status_code == 200

    def test_guard_rejects_removing_the_last_active_admin(self, admin: User) -> None:
        # เกิดได้จริงเฉพาะตอน admin 2 คนกดพร้อมกัน — ทดสอบตัวตรวจโดยตรงกับสภาพ "เหลือคนเดียว"
        make_user("suspended-admin@example.com", User.Role.ADMIN, is_active=False)
        with transaction.atomic():
            active_admin_ids = lock_active_admins()
            assert active_admin_ids == [admin.pk]
            with pytest.raises(ApiError) as caught:
                ensure_not_last_active_admin(admin, active_admin_ids)
        assert caught.value.get_codes() == "last_active_admin"
        assert caught.value.status_code == 409

    def test_guard_allows_when_another_active_admin_exists(self, admin: User) -> None:
        make_user("admin2@example.com", User.Role.ADMIN)
        with transaction.atomic():
            ensure_not_last_active_admin(admin, lock_active_admins())

    def test_guard_ignores_non_admins_and_suspended_admins(self, admin: User) -> None:
        suspended = make_user("off@example.com", User.Role.ADMIN, is_active=False)
        teacher = make_user("t@example.com", User.Role.TEACHER)
        for user in (suspended, teacher):
            ensure_not_last_active_admin(user, [])


# --- ระงับ / เปิดใช้งาน ---


def suspend_url(user: User) -> str:
    return f"{detail_url(user)}suspend/"


def activate_url(user: User) -> str:
    return f"{detail_url(user)}activate/"


class TestSuspendActivate:
    def test_suspend_logs_and_returns_user(
        self, admin_client: APIClient, admin: User, student: User
    ) -> None:
        response = admin_client.post(suspend_url(student))
        assert response.status_code == 200
        assert response.json()["is_active"] is False
        log = AuditLog.objects.get()
        assert log.actor == admin
        assert log.action == AuditAction.UPDATE
        assert log.changes == {"is_active": [True, False]}

    def test_suspended_user_is_locked_out_immediately(
        self, admin_client: APIClient, student: User
    ) -> None:
        student_client = client_for(student)
        refresh = issue_refresh_token(student)
        assert student_client.get("/api/v1/auth/me/").status_code == 200

        admin_client.post(suspend_url(student))

        # บัตรผ่านเดิมใช้ไม่ได้ทันที
        assert student_client.get("/api/v1/auth/me/").status_code == 401
        # แลกบัตรใหม่ไม่ได้
        refresher = APIClient()
        refresher.cookies[settings.REFRESH_COOKIE_NAME] = str(refresh)
        assert refresher.post("/api/v1/auth/refresh/").status_code == 401
        # เข้าสู่ระบบใหม่ → บอกว่าถูกระงับ (รหัสผ่านถูก)
        login = APIClient().post(
            "/api/v1/auth/login/",
            {"identifier": "somchai@example.com", "password": PASSWORD},
            format="json",
        )
        assert login.json()["code"] == "account_disabled"

    def test_activate_restores_access(self, admin_client: APIClient, student: User) -> None:
        admin_client.post(suspend_url(student))
        response = admin_client.post(activate_url(student))
        assert response.status_code == 200
        assert response.json()["is_active"] is True
        assert AuditLog.objects.order_by("id").last().changes == {"is_active": [False, True]}
        login = APIClient().post(
            "/api/v1/auth/login/",
            {"identifier": "somchai@example.com", "password": PASSWORD},
            format="json",
        )
        assert login.status_code == 200

    def test_repeating_writes_no_extra_log(self, admin_client: APIClient, student: User) -> None:
        admin_client.post(suspend_url(student))
        assert admin_client.post(suspend_url(student)).status_code == 200
        assert admin_client.post(activate_url(student)).status_code == 200
        assert admin_client.post(activate_url(student)).status_code == 200
        assert AuditLog.objects.count() == 2

    def test_cannot_suspend_or_activate_self(self, admin_client: APIClient, admin: User) -> None:
        make_user("admin2@example.com", User.Role.ADMIN)
        for url in (suspend_url(admin), activate_url(admin)):
            response = admin_client.post(url)
            assert response.status_code == 403
            assert response.json()["code"] == "cannot_modify_self"
        admin.refresh_from_db()
        assert admin.is_active is True

    def test_can_suspend_another_admin(self, admin_client: APIClient) -> None:
        other = make_user("admin2@example.com", User.Role.ADMIN)
        assert admin_client.post(suspend_url(other)).status_code == 200
        other.refresh_from_db()
        assert other.is_active is False

    def test_unknown_user_is_404(self, admin_client: APIClient) -> None:
        assert admin_client.post(f"{USERS_URL}999999/suspend/").status_code == 404
        assert admin_client.post(f"{USERS_URL}999999/activate/").status_code == 404

    def test_non_admin_gets_403(self, student: User) -> None:
        teacher_client = client_for(make_user("t@example.com", User.Role.TEACHER))
        assert teacher_client.post(suspend_url(student)).status_code == 403
        student.refresh_from_db()
        assert student.is_active is True
