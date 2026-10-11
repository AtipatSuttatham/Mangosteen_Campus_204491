"""
test ของ API เข้าสู่ระบบ / แลก token / ออกจากระบบ / ข้อมูลของฉัน (accounts/views.py)
อ้างอิงพฤติกรรมที่ต้องเป็น: docs/api.md §6
"""

import pytest
from django.conf import settings
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"
PASSWORD = "a-strong-pass-123"
COOKIE = settings.REFRESH_COOKIE_NAME


@pytest.fixture
def client() -> APIClient:
    """ตัวจำลองการเรียก API (เก็บ cookie ที่ได้รับไว้ส่งต่อในคำขอถัดไป เหมือนเบราว์เซอร์)"""
    return APIClient()


@pytest.fixture
def student() -> User:
    """ผู้เรียนทดลองที่มีทั้งอีเมลและรหัสนักศึกษา"""
    return User.objects.create_user(
        email="student@example.com",
        password=PASSWORD,
        student_or_staff_id="690000001",
        first_name="ผู้เรียน",
        last_name="ทดลอง",
        role=User.Role.STUDENT,
    )


def login(client: APIClient, identifier: str, password: str = PASSWORD):
    """ส่งคำขอเข้าสู่ระบบ"""
    return client.post(LOGIN_URL, {"identifier": identifier, "password": password}, format="json")


# ---------------------------------------------------------------- login


@pytest.mark.parametrize("identifier", ["student@example.com", "STUDENT@Example.com", "690000001"])
def test_login_with_email_or_id(client: APIClient, student: User, identifier: str) -> None:
    """เข้าสู่ระบบได้ทั้งอีเมล (ไม่สนตัวพิมพ์) และรหัสนักศึกษา → ได้ access + ข้อมูลผู้ใช้"""
    response = login(client, identifier)

    assert response.status_code == 200
    body = response.json()
    assert body["user"] == {
        "id": student.pk,
        "email": "student@example.com",
        "student_or_staff_id": "690000001",
        "role": "student",
        "first_name": "ผู้เรียน",
        "last_name": "ทดลอง",
        "avatar_url": None,
    }
    # access token ใช้ได้ และมีบทบาทอยู่ข้างใน
    token = AccessToken(body["access"])
    assert token["user_id"] == str(student.pk)
    assert token["role"] == "student"
    # refresh token ไม่อยู่ใน JSON (อยู่ใน cookie เท่านั้น)
    assert "refresh" not in body


def test_login_trims_identifier(client: APIClient, student: User) -> None:
    """เผลอพิมพ์ช่องว่างหัว-ท้ายช่องอีเมล/รหัส → ยังเข้าได้"""
    assert login(client, "  690000001 ").status_code == 200


def test_login_sets_secure_refresh_cookie(client: APIClient, student: User) -> None:
    """cookie ของ refresh token ตั้งค่าครบ: httpOnly, SameSite=Strict, Path, อายุ 7 วัน"""
    response = login(client, "student@example.com")

    cookie = response.cookies[COOKIE]
    assert cookie.value
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "Strict"
    assert cookie["path"] == "/api/v1/auth/"
    assert cookie["max-age"] == 7 * 24 * 60 * 60


@pytest.mark.parametrize("secure", [True, False])
def test_refresh_cookie_secure_flag_follows_setting(
    client: APIClient, student: User, secure: bool
) -> None:
    """ธง Secure ของ cookie ตามค่าตั้ง (เว็บจริง = เปิด, เครื่องพัฒนา http = ปิด)"""
    with override_settings(REFRESH_COOKIE_SECURE=secure):
        response = login(client, "student@example.com")

    assert bool(response.cookies[COOKIE]["secure"]) is secure


def test_login_updates_last_login(client: APIClient, student: User) -> None:
    """เข้าสู่ระบบสำเร็จ → บันทึกเวลาเข้าสู่ระบบล่าสุด"""
    assert student.last_login is None

    login(client, "student@example.com")

    student.refresh_from_db()
    assert student.last_login is not None


@pytest.mark.parametrize(
    ("identifier", "password"),
    [
        ("student@example.com", "wrong-password"),  # รหัสผ่านผิด
        ("nobody@example.com", PASSWORD),  # ไม่มีอีเมลนี้
        ("999999999", PASSWORD),  # ไม่มีรหัสนี้
    ],
)
def test_login_failure_gives_same_generic_error(
    client: APIClient, student: User, identifier: str, password: str
) -> None:
    """ไม่พบบัญชี หรือรหัสผ่านผิด → ข้อความรวมเหมือนกันทุกกรณี (ไม่บอกว่าผิดช่องไหน) + ไม่ตั้ง cookie"""
    response = login(client, identifier, password)

    assert response.status_code == 400
    assert response.json() == {
        "code": "invalid_credentials",
        "detail": "Invalid identifier or password.",
    }
    assert COOKIE not in response.cookies


def test_suspended_account_with_correct_password(client: APIClient, student: User) -> None:
    """บัญชีถูกระงับ + รหัสผ่านถูก → 403 account_disabled (บอกว่าถูกระงับ)"""
    student.is_active = False
    student.save()

    response = login(client, "student@example.com")

    assert response.status_code == 403
    assert response.json()["code"] == "account_disabled"
    assert COOKIE not in response.cookies


def test_suspended_account_with_wrong_password_is_not_revealed(
    client: APIClient, student: User
) -> None:
    """บัญชีถูกระงับ + รหัสผ่านผิด → ข้อความรวมเหมือนรหัสผิด (ไม่เปิดเผยว่าบัญชีถูกระงับ)"""
    student.is_active = False
    student.save()

    response = login(client, "student@example.com", "wrong-password")

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_credentials"


def test_login_requires_both_fields(client: APIClient) -> None:
    """ไม่กรอกช่องใด → validation_error พร้อมรหัสรายช่อง"""
    response = client.post(LOGIN_URL, {}, format="json")

    assert response.status_code == 400
    assert response.json()["fields"] == {"identifier": ["required"], "password": ["required"]}


def test_login_ignores_stale_access_token(client: APIClient, student: User) -> None:
    """มี access token เก่า/เสียแนบมา → ไม่ทำให้ login ล้ม"""
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")

    assert login(client, "student@example.com").status_code == 200


# ---------------------------------------------------------------- refresh


def test_refresh_issues_new_tokens_and_rotates_cookie(client: APIClient, student: User) -> None:
    """แลก token ด้วย cookie → ได้ access ใหม่ + ข้อมูลผู้ใช้ + cookie ใบใหม่ (ไม่ซ้ำใบเดิม)"""
    old_cookie = login(client, "student@example.com").cookies[COOKIE].value

    response = client.post(REFRESH_URL)

    assert response.status_code == 200
    assert AccessToken(response.json()["access"])["user_id"] == str(student.pk)
    assert response.json()["user"]["email"] == "student@example.com"
    assert response.cookies[COOKIE].value != old_cookie


def test_refresh_token_can_be_used_only_once(client: APIClient, student: User) -> None:
    """ใช้ refresh token ใบเดิมซ้ำ (หลังแลกไปแล้ว) → 401 + ลบ cookie"""
    old_cookie = login(client, "student@example.com").cookies[COOKIE].value
    client.post(REFRESH_URL)

    client.cookies[COOKIE] = old_cookie
    response = client.post(REFRESH_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"
    assert response.cookies[COOKIE].value == ""


def test_refresh_without_cookie(client: APIClient) -> None:
    """ไม่มี cookie (ยังไม่เคยเข้าสู่ระบบ) → 401 authentication_failed"""
    response = client.post(REFRESH_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"


def test_refresh_with_garbage_cookie(client: APIClient) -> None:
    """cookie ถูกแก้/ปลอม → 401 + ลบ cookie"""
    client.cookies[COOKIE] = "garbage"

    response = client.post(REFRESH_URL)

    assert response.status_code == 401
    assert response.cookies[COOKIE].value == ""


def test_refresh_rejected_after_account_suspended(client: APIClient, student: User) -> None:
    """บัญชีถูกระงับหลังเข้าสู่ระบบแล้ว → แลก token ไม่ได้ (คำขอถัดไปถูกปฏิเสธทันที)"""
    login(client, "student@example.com")
    User.objects.filter(pk=student.pk).update(is_active=False)

    response = client.post(REFRESH_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"


def test_refresh_picks_up_role_change(client: APIClient, student: User) -> None:
    """ผู้ดูแลระบบเปลี่ยนบทบาท → token ใหม่จากการแลกมีบทบาทล่าสุด"""
    login(client, "student@example.com")
    User.objects.filter(pk=student.pk).update(role=User.Role.TEACHER)

    response = client.post(REFRESH_URL)

    assert AccessToken(response.json()["access"])["role"] == "teacher"
    assert response.json()["user"]["role"] == "teacher"


# ---------------------------------------------------------------- logout


def test_logout_revokes_refresh_token(client: APIClient, student: User) -> None:
    """ออกจากระบบ → 204 + ลบ cookie + refresh token เดิมใช้แลกไม่ได้อีก"""
    old_cookie = login(client, "student@example.com").cookies[COOKIE].value

    response = client.post(LOGOUT_URL)

    assert response.status_code == 204
    assert response.cookies[COOKIE].value == ""
    client.cookies[COOKIE] = old_cookie
    assert client.post(REFRESH_URL).status_code == 401


@pytest.mark.parametrize("cookie_value", [None, "garbage"])
def test_logout_always_succeeds(client: APIClient, cookie_value: str | None) -> None:
    """ออกจากระบบโดยไม่มี cookie หรือ cookie เสีย → ยังสำเร็จ (ผลเหมือนกัน)"""
    if cookie_value is not None:
        client.cookies[COOKIE] = cookie_value
    client.credentials(HTTP_AUTHORIZATION="Bearer expired-or-broken")

    assert client.post(LOGOUT_URL).status_code == 204


# ---------------------------------------------------------------- me


def test_me_returns_current_user(client: APIClient, student: User) -> None:
    """ส่ง access token → ได้ข้อมูลของตัวเอง (ไม่มีข้อมูลภายใน เช่น รหัสผ่าน)"""
    access = login(client, "690000001").json()["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get(ME_URL)

    assert response.status_code == 200
    assert response.json()["email"] == "student@example.com"
    assert "password" not in response.json()
    assert "is_staff" not in response.json()


def test_me_without_token(client: APIClient) -> None:
    """ไม่ได้เข้าสู่ระบบ → 401 not_authenticated"""
    response = client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"


def test_me_with_invalid_token(client: APIClient) -> None:
    """access token ปลอม/เสีย → 401 authentication_failed (รหัสเดียว ไม่ใช่รหัสย่อยของ Simple JWT)"""
    client.credentials(HTTP_AUTHORIZATION="Bearer abc.def.ghi")

    response = client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"


def test_me_rejected_immediately_after_suspension(client: APIClient, student: User) -> None:
    """บัญชีถูกระงับ → access token ที่ยังไม่หมดอายุก็ใช้ไม่ได้ทันที (ตรวจทุกคำขอ)"""
    access = login(client, "student@example.com").json()["access"]
    User.objects.filter(pk=student.pk).update(is_active=False)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"


def test_me_accepts_only_get_and_patch(client: APIClient, student: User) -> None:
    """me/ รับแค่ GET (ดู) และ PATCH (แก้บางช่อง — ขั้น 1.7) ; แทนที่ทั้งก้อน/สร้าง/ลบบัญชีไม่ได้"""
    access = login(client, "student@example.com").json()["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    assert client.put(ME_URL, {}, format="json").status_code == 405
    assert client.post(ME_URL, {}, format="json").status_code == 405
    assert client.delete(ME_URL).status_code == 405


# ---------------------------------------------------------------- แลกบัตรพร้อมกัน (ขั้น 1.4.1)


@pytest.mark.django_db(transaction=True)
def test_concurrent_refresh_with_same_token_succeeds_only_once() -> None:
    """
    ยื่น refresh token ใบเดียวกันพร้อมกันหลายคำขอ (คนละ thread = คนละการเชื่อมต่อฐานข้อมูล)
    → ผ่านแค่ 1 คำขอ ที่เหลือ 401 — บัตรใช้ได้ครั้งเดียวจริงแม้ยื่นพร้อมกัน
    (ก่อนแก้: ผ่านทุกคำขอ เพราะ "ตรวจว่าใช้แล้วหรือยัง" กับ "บันทึกว่าใช้แล้ว" แยกจังหวะกัน)
    """
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import connection

    User.objects.create_user(
        email="race@example.com", password=PASSWORD, role=User.Role.STUDENT, first_name="ก"
    )
    raw_cookie = login(APIClient(), "race@example.com").cookies[COOKIE].value
    workers = 6
    # ให้ทุก thread รอกันแล้วยิงพร้อมกันจริง ๆ
    start_together = Barrier(workers)

    def refresh_once(_: int) -> tuple[int, str]:
        client = APIClient()
        client.cookies[COOKIE] = raw_cookie
        start_together.wait()
        try:
            response = client.post(REFRESH_URL)
            new_cookie = response.cookies[COOKIE].value if COOKIE in response.cookies else ""
            return response.status_code, new_cookie
        finally:
            # แต่ละ thread เปิดการเชื่อมต่อฐานข้อมูลของตัวเอง — ปิดให้เรียบร้อย
            connection.close()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(refresh_once, range(workers)))

    statuses = sorted(status for status, _ in results)
    assert statuses == [200] + [401] * (workers - 1)
    # บัตรใบใหม่ของคำขอที่ผ่าน ใช้แลกต่อได้ตามปกติ
    winner_cookie = next(cookie for status, cookie in results if status == 200)
    client = APIClient()
    client.cookies[COOKIE] = winner_cookie
    assert client.post(REFRESH_URL).status_code == 200
