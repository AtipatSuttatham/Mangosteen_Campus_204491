"""
test ของ API นำเข้าบัญชีจาก CSV (UC-04 — ขั้น 2.4)
อ้างอิงพฤติกรรม: docs/api.md §7.4, การตัดสินใจก้อน 2 ใน CLAUDE.md
ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tests.test_manage_users_api import client_for, make_user

pytestmark = pytest.mark.django_db

VALIDATE_URL = "/api/v1/admin/users/import/validate/"
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
    def test_anonymous_gets_401(self) -> None:
        assert post_file(APIClient(), VALIDATE_URL, csv_file()).status_code == 401

    @pytest.mark.parametrize("role", [User.Role.TEACHER, User.Role.STUDENT])
    def test_non_admin_gets_403(self, role: str) -> None:
        client = client_for(make_user("someone@example.com", role))
        response = post_file(client, VALIDATE_URL, csv_file("a@example.com,,ก,ข,student"))
        assert response.status_code == 403
        assert response.json()["code"] == "permission_denied"


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
        }

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
