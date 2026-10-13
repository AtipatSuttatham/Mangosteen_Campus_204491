"""
test ของ API นำเข้าบัญชีจาก CSV (UC-04 — ขั้น 2.4)
อ้างอิงพฤติกรรม: docs/api.md §7.4, การตัดสินใจก้อน 2 ใน CLAUDE.md
ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
"""

import json

import pytest
from django.contrib.auth.hashers import identify_hasher
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts import csv_import, manage_views
from accounts.hashers import TemporaryPasswordHasher
from accounts.models import User
from accounts.passwords import ALPHABET, LENGTH
from accounts.tests.test_manage_users_api import client_for, make_user
from audit.models import AuditAction, AuditLog

pytestmark = pytest.mark.django_db

VALIDATE_URL = "/api/v1/admin/users/import/validate/"
IMPORT_URL = "/api/v1/admin/users/import/"
LOGIN_URL = "/api/v1/auth/login/"
ME_URL = "/api/v1/auth/me/"
HEADER = "email,student_or_staff_id,first_name,last_name,role"


def csv_file(*lines: str, encoding: str = "utf-8") -> SimpleUploadedFile:
    """ไฟล์ CSV จำลอง: หัวตารางมาตรฐาน + แถวที่ให้มา"""
    content = "\n".join([HEADER, *lines]) + "\n"
    return SimpleUploadedFile("users.csv", content.encode(encoding), content_type="text/csv")


def post_file(client: APIClient, url: str, upload: SimpleUploadedFile):
    """อัปโหลดไฟล์แบบ multipart ช่อง "file" """
    return client.post(url, {"file": upload}, format="multipart")


@pytest.fixture
def admin() -> User:
    return make_user("admin@example.com", User.Role.ADMIN, first_name="ผู้ดูแล", last_name="หลัก")


@pytest.fixture
def admin_client(admin: User) -> APIClient:
    return client_for(admin)


def validate(client: APIClient, *lines: str) -> dict:
    """ตรวจไฟล์แล้วคืนรายงาน (ต้องได้ 200)"""
    response = post_file(client, VALIDATE_URL, csv_file(*lines))
    assert response.status_code == 200, response.json()
    return response.json()


# --- สิทธิ์ ---


class TestPermissions:
    @pytest.mark.parametrize("url", [VALIDATE_URL, IMPORT_URL])
    def test_anonymous_gets_401(self, url: str) -> None:
        assert post_file(APIClient(), url, csv_file()).status_code == 401

    @pytest.mark.parametrize("url", [VALIDATE_URL, IMPORT_URL])
    @pytest.mark.parametrize("role", [User.Role.TEACHER, User.Role.STUDENT])
    def test_non_admin_gets_403(self, role: str, url: str) -> None:
        client = client_for(make_user("someone@example.com", role))
        response = post_file(client, url, csv_file("a@example.com,,ก,ข,student"))
        assert response.status_code == 403
        assert response.json()["code"] == "permission_denied"
        assert not User.objects.filter(email="a@example.com").exists()


# --- ตรวจไฟล์: ไฟล์ถูกทั้งหมด ---


class TestValidateOk:
    def test_valid_file_report(self, admin_client: APIClient) -> None:
        report = validate(
            admin_client,
            "a@example.com,690000001,สมชาย,ใจดี,student",
            "b@example.com,690000002,สมหญิง,รักเรียน,ผู้เรียน",
            "t@example.com,T-01,อาจารย์,ใจเย็น,Teacher",
        )
        assert report == {
            "valid": True,
            "total": 3,
            "by_role": {"teacher": 1, "student": 2},
            "errors": [],
            # ขั้น 2.7: ตัวอย่างใช้ค่าที่ตรวจแล้ว (บทบาท "ผู้เรียน" / "Teacher" → student / teacher)
            "preview": [
                {
                    "row": 2,
                    "email": "a@example.com",
                    "student_or_staff_id": "690000001",
                    "first_name": "สมชาย",
                    "last_name": "ใจดี",
                    "role": "student",
                },
                {
                    "row": 3,
                    "email": "b@example.com",
                    "student_or_staff_id": "690000002",
                    "first_name": "สมหญิง",
                    "last_name": "รักเรียน",
                    "role": "student",
                },
                {
                    "row": 4,
                    "email": "t@example.com",
                    "student_or_staff_id": "T-01",
                    "first_name": "อาจารย์",
                    "last_name": "ใจเย็น",
                    "role": "teacher",
                },
            ],
        }

    def test_preview_has_first_five_rows_with_normalized_values(
        self, admin_client: APIClient
    ) -> None:
        # 7 แถว (มีแถวว่างคั่น) → ตัวอย่างแค่ 5 แถวแรก ; เลขแถวนับแบบ Excel (แถวว่างยังนับ)
        lines = [f"User{n}@Example.com,,ชื่อ{n},สกุล{n},student" for n in range(1, 8)]
        report = validate(admin_client, lines[0], "", *lines[1:])
        preview = report["preview"]
        assert [item["row"] for item in preview] == [2, 4, 5, 6, 7]
        # อีเมลเก็บตัวพิมพ์เล็ก ; ไม่มีรหัส = null
        assert preview[0]["email"] == "user1@example.com"
        assert preview[0]["student_or_staff_id"] is None

    def test_preview_empty_when_any_row_invalid(self, admin_client: APIClient) -> None:
        report = validate(
            admin_client, "a@example.com,,สมชาย,ใจดี,student", "b@example.com,,ก,ข,admin"
        )
        assert report["valid"] is False
        assert report["preview"] == []

    def test_validate_does_not_create_anything(self, admin_client: APIClient) -> None:
        before = User.objects.count()
        validate(admin_client, "a@example.com,,สมชาย,ใจดี,student")
        assert User.objects.count() == before

    @pytest.mark.parametrize("role", ["teacher", "STUDENT", " ผู้สอน ", "ผู้เรียน"])
    def test_role_aliases_accepted(self, admin_client: APIClient, role: str) -> None:
        assert validate(admin_client, f"a@example.com,,ก,ข,{role}")["valid"] is True

    def test_student_id_is_optional(self, admin_client: APIClient) -> None:
        report = validate(admin_client, "a@example.com,,ก,ข,student", "b@example.com,,ค,ง,student")
        assert report["valid"] is True

    def test_tis620_file(self, admin_client: APIClient) -> None:
        response = post_file(
            admin_client,
            VALIDATE_URL,
            csv_file("a@example.com,,สมชาย,ใจดี,ผู้เรียน", encoding="cp874"),
        )
        assert response.json()["valid"] is True

    def test_email_case_matches_existing_account(self, admin_client: APIClient) -> None:
        make_user("taken@example.com")
        report = validate(admin_client, " TAKEN@Example.com ,,ก,ข,student")
        assert report["errors"] == [
            {"row": 2, "column": "email", "code": "unique", "value": "TAKEN@Example.com"}
        ]


# --- ตรวจไฟล์: รายงานแถวที่ผิด ---


class TestValidateRowErrors:
    def test_each_problem_reported_with_row_column_code_value(
        self, admin_client: APIClient
    ) -> None:
        make_user("taken@example.com", student_or_staff_id="690000009")
        report = validate(
            admin_client,
            "ok@example.com,,สมชาย,ใจดี,student",  # แถว 2 ถูก
            "not-an-email,,ก,ข,student",  # แถว 3
            "taken@example.com,690000009,ก,ข,student",  # แถว 4
            "c@example.com,,,ข,student",  # แถว 5
            "d@example.com,,ก,ข,admin",  # แถว 6
            "e@example.com,,ก,ข,boss",  # แถว 7
            "f@example.com,,ก,ข,",  # แถว 8
        )
        assert report["valid"] is False
        assert report["total"] == 7
        assert report["errors"] == [
            {"row": 3, "column": "email", "code": "invalid", "value": "not-an-email"},
            {"row": 4, "column": "email", "code": "unique", "value": "taken@example.com"},
            {"row": 4, "column": "student_or_staff_id", "code": "unique", "value": "690000009"},
            {"row": 5, "column": "first_name", "code": "blank", "value": ""},
            {"row": 6, "column": "role", "code": "csv_admin_not_allowed", "value": "admin"},
            {"row": 7, "column": "role", "code": "invalid_choice", "value": "boss"},
            {"row": 8, "column": "role", "code": "blank", "value": ""},
        ]
        # นับบทบาทเฉพาะแถวที่ระบุบทบาทถูก (แถว 2–5)
        assert report["by_role"] == {"teacher": 0, "student": 4}

    def test_thai_admin_alias_not_allowed(self, admin_client: APIClient) -> None:
        report = validate(admin_client, "a@example.com,,ก,ข,ผู้ดูแลระบบ")
        assert report["errors"][0]["code"] == "csv_admin_not_allowed"

    def test_duplicates_within_file_point_to_first_row(self, admin_client: APIClient) -> None:
        report = validate(
            admin_client,
            "a@example.com,690000001,ก,ข,student",  # แถว 2
            "b@example.com,690000002,ก,ข,student",  # แถว 3
            "A@EXAMPLE.COM,690000003,ก,ข,student",  # แถว 4: อีเมลซ้ำแถว 2
            "c@example.com,690000002,ก,ข,student",  # แถว 5: รหัสซ้ำแถว 3
        )
        assert report["errors"] == [
            {
                "row": 4,
                "column": "email",
                "code": "duplicate_in_file",
                "value": "A@EXAMPLE.COM",
                "duplicate_of": 2,
            },
            {
                "row": 5,
                "column": "student_or_staff_id",
                "code": "duplicate_in_file",
                "value": "690000002",
                "duplicate_of": 3,
            },
        ]

    def test_empty_ids_are_not_duplicates(self, admin_client: APIClient) -> None:
        report = validate(admin_client, "a@example.com,,ก,ข,student", "b@example.com, ,ค,ง,student")
        assert report["valid"] is True

    def test_row_numbers_follow_excel_with_blank_rows(self, admin_client: APIClient) -> None:
        report = validate(admin_client, "a@example.com,,ก,ข,student", ",,,,", "bad,,ก,ข,student")
        assert report["errors"][0]["row"] == 4

    def test_too_long_values(self, admin_client: APIClient) -> None:
        long_name = "ก" * 151
        report = validate(admin_client, f"a@example.com,{'9' * 21},{long_name},ข,student")
        codes = {(item["column"], item["code"]) for item in report["errors"]}
        assert codes == {("student_or_staff_id", "max_length"), ("first_name", "max_length")}

    def test_report_value_is_truncated(self, admin_client: APIClient) -> None:
        report = validate(admin_client, f"a@example.com,,{'ก' * 500},ข,student")
        assert len(report["errors"][0]["value"]) == 200


# --- ตรวจไฟล์: ปัญหาระดับไฟล์ ---


class TestValidateFileErrors:
    def test_missing_file(self, admin_client: APIClient) -> None:
        response = admin_client.post(VALIDATE_URL, {}, format="multipart")
        assert response.status_code == 400
        assert response.json()["fields"] == {"file": ["required"]}

    def test_missing_columns(self, admin_client: APIClient) -> None:
        upload = SimpleUploadedFile("u.csv", b"email,role\na@example.com,student\n")
        response = post_file(admin_client, VALIDATE_URL, upload)
        assert response.status_code == 400
        assert response.json() == {
            "code": "csv_missing_columns",
            "detail": "Missing columns: student_or_staff_id, first_name, last_name",
            "fields": {
                "student_or_staff_id": ["required"],
                "first_name": ["required"],
                "last_name": ["required"],
            },
        }

    @pytest.mark.parametrize(
        ("content", "code"),
        [
            (b"", "csv_empty"),
            (b"PK\x03\x04\x14\x00", "csv_unreadable"),
        ],
    )
    def test_file_level_codes(self, admin_client: APIClient, content: bytes, code: str) -> None:
        response = post_file(admin_client, VALIDATE_URL, SimpleUploadedFile("u.csv", content))
        assert response.status_code == 400
        assert response.json()["code"] == code


# --- นำเข้าจริง ---

VALID_LINES = (
    "a@example.com,690000001,สมชาย,ใจดี,student",
    "b@example.com,,สมหญิง,รักเรียน,ผู้เรียน",
    "t@example.com,T-01,อาจารย์,ใจเย็น,teacher",
)


def do_import(client: APIClient, *lines: str):
    """นำเข้าไฟล์ (หัวตารางมาตรฐาน + แถวที่ให้มา)"""
    return post_file(client, IMPORT_URL, csv_file(*lines))


class TestImportSuccess:
    def test_creates_all_rows_and_returns_passwords_once(self, admin_client: APIClient) -> None:
        response = do_import(admin_client, *VALID_LINES)
        assert response.status_code == 201
        assert response["Cache-Control"] == "no-store"
        body = response.json()
        assert body["created"] == 3
        assert body["by_role"] == {"teacher": 1, "student": 2}

        first = body["users"][0]
        user = User.objects.get(email="a@example.com")
        assert {key: value for key, value in first.items() if key != "password"} == {
            "row": 2,
            "id": user.pk,
            "email": "a@example.com",
            "student_or_staff_id": "690000001",
            "first_name": "สมชาย",
            "last_name": "ใจดี",
            "role": "student",
        }
        assert [item["row"] for item in body["users"]] == [2, 3, 4]
        assert body["users"][1]["student_or_staff_id"] is None
        assert body["users"][1]["role"] == "student"
        assert body["users"][2]["role"] == "teacher"

    def test_created_accounts_settings(self, admin_client: APIClient, admin: User) -> None:
        do_import(admin_client, *VALID_LINES)
        for user in User.objects.filter(email__in=["a@example.com", "t@example.com"]):
            assert user.is_active is True
            assert user.is_staff is False
            assert user.is_superuser is False
            assert user.created_by == admin

    def test_passwords_are_random_and_stored_with_temporary_hasher(
        self, admin_client: APIClient
    ) -> None:
        users = do_import(admin_client, *VALID_LINES).json()["users"]
        assert len({item["password"] for item in users}) == 3
        for item in users:
            password = item["password"]
            assert len(password) == LENGTH
            assert set(password) <= set(ALPHABET)
            user = User.objects.get(pk=item["id"])
            # ระบบเก็บเฉพาะค่าที่เข้ารหัสแล้ว (ไม่มีรหัสตัวจริงในฐานข้อมูล)
            assert password not in user.password
            assert identify_hasher(user.password).algorithm == TemporaryPasswordHasher.algorithm

    def test_audit_log_per_account_without_password(
        self, admin_client: APIClient, admin: User
    ) -> None:
        users = do_import(admin_client, *VALID_LINES).json()["users"]
        logs = list(AuditLog.objects.filter(action=AuditAction.CREATE).order_by("id"))
        assert len(logs) == 3
        assert all(log.actor == admin for log in logs)
        assert logs[0].object_id == str(users[0]["id"])
        assert logs[0].changes == {
            "email": [None, "a@example.com"],
            "student_or_staff_id": [None, "690000001"],
            "first_name": [None, "สมชาย"],
            "last_name": [None, "ใจดี"],
            "role": [None, "student"],
            "is_active": [None, True],
            "password": ["***", "***"],
        }
        # รหัสตัวจริงไม่อยู่ในบันทึกใดเลย
        dumped = json.dumps([log.changes for log in logs], ensure_ascii=False)
        assert not any(item["password"] in dumped for item in users)


class TestImportRejected:
    def test_invalid_rows_create_nothing(self, admin_client: APIClient) -> None:
        before = User.objects.count()
        response = do_import(admin_client, "a@example.com,,ก,ข,student", "b@example.com,,ก,ข,admin")
        assert response.status_code == 400
        body = response.json()
        assert body["code"] == "csv_invalid"
        assert body["report"] == {
            "valid": False,
            "total": 2,
            "by_role": {"teacher": 0, "student": 1},
            "errors": [
                {"row": 3, "column": "role", "code": "csv_admin_not_allowed", "value": "admin"}
            ],
            "preview": [],
        }
        assert User.objects.count() == before
        assert not AuditLog.objects.exists()

    def test_file_level_error(self, admin_client: APIClient) -> None:
        response = post_file(admin_client, IMPORT_URL, SimpleUploadedFile("u.csv", b""))
        assert response.status_code == 400
        assert response.json()["code"] == "csv_empty"

    def test_failure_midway_rolls_back_everything(
        self, admin_client: APIClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """จดบันทึกแถวที่ 2 ไม่สำเร็จ → บัญชีแถวแรกที่สร้างไปแล้วต้องหายด้วย (ทั้งหมดหรือไม่เลย)"""
        real_log_action = csv_import.log_action
        calls = {"count": 0}

        def failing_log_action(**kwargs):
            calls["count"] += 1
            if calls["count"] == 2:
                raise RuntimeError("simulated failure")
            return real_log_action(**kwargs)

        monkeypatch.setattr(csv_import, "log_action", failing_log_action)
        before = User.objects.count()
        response = do_import(admin_client, *VALID_LINES)
        assert response.status_code == 500
        assert User.objects.count() == before
        assert not AuditLog.objects.exists()

    def test_duplicate_created_between_validate_and_save(
        self, admin_client: APIClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        อีกคำขอสร้างอีเมลเดียวกันหลังตรวจผ่านแต่ก่อนบันทึก → ฐานข้อมูลปฏิเสธ
        → ยกเลิกทั้งไฟล์ แล้วตอบ csv_invalid บอกแถวที่ชน (ไม่ใช่ 500)
        """
        real_validate_rows = manage_views.validate_rows
        calls = {"count": 0}

        def validate_then_race(rows):
            result = real_validate_rows(rows)
            calls["count"] += 1
            if calls["count"] == 1:
                make_user("b@example.com")
            return result

        monkeypatch.setattr(manage_views, "validate_rows", validate_then_race)
        response = do_import(admin_client, *VALID_LINES)
        assert response.status_code == 400
        body = response.json()
        assert body["code"] == "csv_invalid"
        assert body["report"]["errors"] == [
            {"row": 3, "column": "email", "code": "unique", "value": "b@example.com"}
        ]
        # แถวแรก (a@) ที่สร้างไปก่อนชนต้องถูกยกเลิกด้วย
        assert not User.objects.filter(email="a@example.com").exists()
        assert not AuditLog.objects.exists()


class TestTemporaryPasswordLogin:
    def test_first_login_upgrades_hash_and_keeps_session(self, admin_client: APIClient) -> None:
        """
        เข้าสู่ระบบด้วยรหัสชั่วคราวได้ → Django เปลี่ยนเป็นตัวเข้ารหัสหลักให้อัตโนมัติ
        และบัตรที่ได้จากการเข้าสู่ระบบครั้งนั้นยังใช้ได้ (ลายนิ้วมือ pwd ตรงกับรหัสหลังเปลี่ยน)
        """
        item = do_import(admin_client, *VALID_LINES).json()["users"][0]

        client = APIClient()
        login = client.post(
            LOGIN_URL, {"identifier": item["email"], "password": item["password"]}, format="json"
        )
        assert login.status_code == 200

        user = User.objects.get(pk=item["id"])
        assert identify_hasher(user.password).algorithm == "pbkdf2_sha256"
        assert user.check_password(item["password"])

        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
        assert client.get(ME_URL).status_code == 200

    def test_login_with_student_id(self, admin_client: APIClient) -> None:
        item = do_import(admin_client, *VALID_LINES).json()["users"][0]
        login = APIClient().post(
            LOGIN_URL, {"identifier": "690000001", "password": item["password"]}, format="json"
        )
        assert login.status_code == 200

    def test_wrong_password_does_not_upgrade(self, admin_client: APIClient) -> None:
        item = do_import(admin_client, *VALID_LINES).json()["users"][0]
        login = APIClient().post(
            LOGIN_URL, {"identifier": item["email"], "password": "wrong-pass-123"}, format="json"
        )
        assert login.status_code == 400
        user = User.objects.get(pk=item["id"])
        assert identify_hasher(user.password).algorithm == TemporaryPasswordHasher.algorithm
