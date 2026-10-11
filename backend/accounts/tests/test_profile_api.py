"""
test ของ API ข้อมูลส่วนตัว (UC-02 — ขั้น 1.7): แก้ชื่อ/อีเมล และเปลี่ยนรหัสผ่าน
อ้างอิงพฤติกรรม: docs/api.md §6, การตัดสินใจก้อน 1 ใน CLAUDE.md
(รูปประจำตัวอยู่ใน test_avatars.py)
"""

import pytest
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
ME_URL = "/api/v1/auth/me/"
PASSWORD_URL = "/api/v1/auth/me/password/"
PASSWORD = "a-strong-pass-123"
NEW_PASSWORD = "another-strong-pass-456"
COOKIE = settings.REFRESH_COOKIE_NAME


@pytest.fixture
def student() -> User:
    """ผู้เรียนทดลอง (ข้อมูลสมมติ)"""
    return User.objects.create_user(
        email="student@example.com",
        password=PASSWORD,
        student_or_staff_id="690000001",
        first_name="ผู้เรียน",
        last_name="ทดลอง",
        role=User.Role.STUDENT,
    )


@pytest.fixture
def teacher() -> User:
    """ผู้สอนทดลอง — ใช้ทดสอบอีเมลซ้ำ"""
    return User.objects.create_user(
        email="teacher@example.com",
        password=PASSWORD,
        first_name="ผู้สอน",
        last_name="ทดลอง",
        role=User.Role.TEACHER,
    )


def logged_in_client(identifier: str = "student@example.com", password: str = PASSWORD):
    """เครื่องหนึ่งเครื่องที่เข้าสู่ระบบแล้ว: คืน (client ที่แนบ access token, access token)"""
    client = APIClient()
    response = client.post(
        LOGIN_URL, {"identifier": identifier, "password": password}, format="json"
    )
    assert response.status_code == 200
    access = response.json()["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return client, access


# ---------------------------------------------------------------- แก้ชื่อ / อีเมล


def test_patch_names_trims_and_saves(student: User) -> None:
    """แก้ชื่อ-นามสกุล → ตัดช่องว่างหัวท้าย บันทึก และคืนข้อมูลล่าสุด"""
    client, _ = logged_in_client()

    response = client.patch(ME_URL, {"first_name": " สมใจ ", "last_name": "รักเรียน"}, format="json")

    assert response.status_code == 200
    assert response.json()["first_name"] == "สมใจ"
    assert response.json()["last_name"] == "รักเรียน"
    student.refresh_from_db()
    assert (student.first_name, student.last_name) == ("สมใจ", "รักเรียน")


def test_patch_partial_keeps_other_fields(student: User) -> None:
    """ส่งเฉพาะช่องที่แก้ → ช่องอื่นเหมือนเดิม"""
    client, _ = logged_in_client()

    response = client.patch(ME_URL, {"last_name": "ใหม่"}, format="json")

    assert response.status_code == 200
    assert response.json()["first_name"] == "ผู้เรียน"
    assert response.json()["email"] == "student@example.com"


def test_patch_blank_name_is_rejected(student: User) -> None:
    """ชื่อว่าง (หรือมีแต่ช่องว่าง) → validation_error รหัส blank"""
    client, _ = logged_in_client()

    response = client.patch(ME_URL, {"first_name": "   "}, format="json")

    assert response.status_code == 400
    assert response.json()["fields"] == {"first_name": ["blank"]}


def test_patch_email_is_stored_lowercase(student: User) -> None:
    """แก้อีเมล (ไม่ต้องกรอกรหัสผ่าน) → เก็บเป็นตัวพิมพ์เล็ก ; เข้าสู่ระบบด้วยอีเมลใหม่ได้"""
    client, _ = logged_in_client()

    response = client.patch(ME_URL, {"email": " New.Mail@Example.COM "}, format="json")

    assert response.status_code == 200
    assert response.json()["email"] == "new.mail@example.com"
    logged_in_client("new.mail@example.com")


def test_patch_email_duplicate_ignores_case(student: User, teacher: User) -> None:
    """อีเมลซ้ำกับบัญชีอื่น (แม้ตัวพิมพ์ต่างกัน) → รหัส unique และไม่เปลี่ยน"""
    client, _ = logged_in_client()

    response = client.patch(ME_URL, {"email": "TEACHER@example.com"}, format="json")

    assert response.status_code == 400
    assert response.json()["fields"] == {"email": ["unique"]}
    student.refresh_from_db()
    assert student.email == "student@example.com"


def test_patch_own_email_is_not_duplicate(student: User) -> None:
    """ส่งอีเมลเดิมของตัวเองมา (ตัวพิมพ์ต่างกัน) → ไม่นับว่าซ้ำ"""
    client, _ = logged_in_client()

    response = client.patch(ME_URL, {"email": "Student@Example.com"}, format="json")

    assert response.status_code == 200


def test_patch_invalid_email(student: User) -> None:
    """รูปแบบอีเมลผิด → รหัส invalid"""
    client, _ = logged_in_client()

    response = client.patch(ME_URL, {"email": "not-an-email"}, format="json")

    assert response.status_code == 400
    assert response.json()["fields"] == {"email": ["invalid"]}


def test_patch_cannot_change_role_or_id(student: User) -> None:
    """ส่ง role / รหัสนักศึกษา / is_staff มาด้วย → ไม่มีผล (แก้เองไม่ได้)"""
    client, _ = logged_in_client()

    response = client.patch(
        ME_URL,
        {"role": "admin", "student_or_staff_id": "999", "is_staff": True, "last_name": "ใหม่"},
        format="json",
    )

    assert response.status_code == 200
    student.refresh_from_db()
    assert student.role == User.Role.STUDENT
    assert student.student_or_staff_id == "690000001"
    assert student.is_staff is False
    assert student.last_name == "ใหม่"


def test_patch_requires_login(student: User) -> None:
    """ไม่ได้เข้าสู่ระบบ → 401"""
    response = APIClient().patch(ME_URL, {"first_name": "x"}, format="json")

    assert response.status_code == 401


# ---------------------------------------------------------------- เปลี่ยนรหัสผ่าน


def change_password(client: APIClient, current: str = PASSWORD, new: str = NEW_PASSWORD):
    return client.post(
        PASSWORD_URL, {"current_password": current, "new_password": new}, format="json"
    )


def test_change_password_wrong_current(student: User) -> None:
    """รหัสเดิมผิด → รหัสช่อง password_incorrect และรหัสผ่านไม่เปลี่ยน"""
    client, _ = logged_in_client()

    response = change_password(client, current="wrong-password")

    assert response.status_code == 400
    assert response.json()["fields"] == {"current_password": ["password_incorrect"]}
    student.refresh_from_db()
    assert student.check_password(PASSWORD)


@pytest.mark.parametrize(
    ("new_password", "expected_codes"),
    [
        ("Ab1-x", ["password_too_short"]),
        ("password123", ["password_too_common"]),
        ("90817263544", ["password_entirely_numeric"]),
        ("student-example", ["password_too_similar"]),
    ],
)
def test_change_password_rules(student: User, new_password: str, expected_codes: list) -> None:
    """รหัสใหม่ไม่ผ่านกฎของ Django → รหัสของกฎข้อนั้น (frontend แปลเป็นข้อความไทย)"""
    client, _ = logged_in_client()

    response = change_password(client, new=new_password)

    assert response.status_code == 400
    assert response.json()["fields"] == {"new_password": expected_codes}


def test_change_password_success_keeps_this_device(student: User) -> None:
    """สำเร็จ → 200 {access, user} + cookie ใบใหม่ ; เครื่องนี้ใช้บัตรใหม่ต่อได้ทั้ง 2 ใบ"""
    client, _ = logged_in_client()

    response = change_password(client)

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "student@example.com"
    assert response.cookies[COOKIE].value
    student.refresh_from_db()
    assert student.check_password(NEW_PASSWORD)

    # บัตรผ่านชั่วคราวใบใหม่ใช้ได้
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    assert client.get(ME_URL).status_code == 200
    # บัตรสมาชิกใบใหม่ (cookie) แลกต่อได้
    assert client.post(REFRESH_URL).status_code == 200


def test_change_password_logs_out_other_devices_immediately(student: User) -> None:
    """
    อุปกรณ์อื่นออกจากระบบทันที (ผู้ใช้เลือกแบบ ก):
    บัตรผ่านชั่วคราวที่ยังไม่หมดอายุใช้ไม่ได้ทันที และบัตรสมาชิกแลกใหม่ไม่ได้
    """
    other_device, _ = logged_in_client()
    this_device, old_access = logged_in_client()
    assert other_device.get(ME_URL).status_code == 200

    assert change_password(this_device).status_code == 200

    # access token เดิม (ทั้งของเครื่องอื่นและของเครื่องนี้ก่อนเปลี่ยน) ถูกปฏิเสธ
    response = other_device.get(ME_URL)
    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"
    stale = APIClient()
    stale.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
    assert stale.get(ME_URL).status_code == 401
    # refresh token ของเครื่องอื่นแลกไม่ได้
    assert other_device.post(REFRESH_URL).status_code == 401


def test_new_password_works_for_login(student: User) -> None:
    """เปลี่ยนแล้ว → เข้าสู่ระบบด้วยรหัสใหม่ได้ ; รหัสเดิมไม่ได้"""
    client, _ = logged_in_client()
    change_password(client)

    logged_in_client(password=NEW_PASSWORD)
    response = APIClient().post(
        LOGIN_URL, {"identifier": "690000001", "password": PASSWORD}, format="json"
    )
    assert response.json()["code"] == "invalid_credentials"


def test_change_password_requires_login(student: User) -> None:
    """ไม่ได้เข้าสู่ระบบ → 401"""
    assert change_password(APIClient()).status_code == 401


# ---------------------------------------------------------------- ลายนิ้วมือของรหัสผ่านในบัตร


def test_token_without_password_fingerprint_is_rejected(student: User) -> None:
    """บัตรที่ไม่มีลายนิ้วมือ (ออกก่อนขั้น 1.7) → ใช้ไม่ได้ ต้องเข้าสู่ระบบใหม่"""
    legacy = RefreshToken.for_user(student)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {legacy.access_token}")

    assert client.get(ME_URL).status_code == 401

    client.credentials()
    client.cookies[COOKIE] = str(legacy)
    assert client.post(REFRESH_URL).status_code == 401


def test_password_reset_elsewhere_invalidates_tokens(student: User) -> None:
    """รหัสผ่านถูกเปลี่ยนจากที่อื่น (เช่น ผู้ดูแลระบบรีเซ็ตให้ — ก้อน 2) → บัตรเดิมใช้ไม่ได้ทันที"""
    client, _ = logged_in_client()
    student.set_password("reset-by-admin-789")
    student.save()

    assert client.get(ME_URL).status_code == 401
    assert client.post(REFRESH_URL).status_code == 401
