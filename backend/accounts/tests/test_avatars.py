"""
test ของรูปประจำตัว (UC-02 — ขั้น 1.7): การตรวจ/ย่อ/ล้างข้อมูลแฝง (accounts/avatars.py)
และ API อัปโหลด/ลบ (POST/DELETE /api/v1/auth/me/avatar/)

รูปทดสอบสร้างในหน่วยความจำด้วย Pillow ; ไฟล์ที่บันทึกไปอยู่ในโฟลเดอร์ชั่วคราวของ test (ไม่ใช่ media/)
"""

from io import BytesIO
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import ExifTags, Image
from rest_framework.test import APIClient

from accounts.avatars import AvatarError, process_avatar
from accounts.models import User

AVATAR_URL = "/api/v1/auth/me/avatar/"
LOGIN_URL = "/api/v1/auth/login/"
PASSWORD = "a-strong-pass-123"


def make_image(
    fmt: str = "JPEG",
    size: tuple[int, int] = (800, 600),
    mode: str = "RGB",
    exif: Image.Exif | None = None,
) -> bytes:
    """สร้างไฟล์รูปในหน่วยความจำ"""
    color = (94, 34, 80, 128) if mode == "RGBA" else (94, 34, 80)
    image = Image.new(mode, size, color)
    output = BytesIO()
    image.save(output, format=fmt, **({"exif": exif} if exif is not None else {}))
    return output.getvalue()


def upload(data: bytes, name: str = "photo.jpg", content_type: str = "image/jpeg"):
    """ห่อข้อมูลให้เป็นไฟล์อัปโหลด (แบบที่ Django ได้รับจากเบราว์เซอร์)"""
    return SimpleUploadedFile(name, data, content_type=content_type)


def open_result(data: bytes) -> Image.Image:
    """เปิดไฟล์ผลลัพธ์ที่ระบบบันทึก"""
    image = Image.open(BytesIO(data))
    image.load()
    return image


@pytest.fixture(autouse=True)
def media_in_tmp(settings, tmp_path: Path) -> Path:
    """ให้ไฟล์ที่บันทึกระหว่าง test ไปอยู่ในโฟลเดอร์ชั่วคราว (ลบเองหลัง test)"""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


# ---------------------------------------------------------------- process_avatar (ตรวจ/ย่อรูป)


@pytest.mark.parametrize(("fmt", "name"), [("JPEG", "a.jpg"), ("PNG", "a.png"), ("WEBP", "a.webp")])
def test_accepts_jpeg_png_webp_and_outputs_webp(fmt: str, name: str) -> None:
    """รับ JPG / PNG / WebP → ได้ไฟล์ WebP เสมอ"""
    result = open_result(process_avatar(upload(make_image(fmt), name)).read())

    assert result.format == "WEBP"


def test_resizes_to_fit_512_keeping_ratio() -> None:
    """รูป 2000×1000 → ย่อเหลือ 512×256 (สัดส่วนเดิม)"""
    result = open_result(process_avatar(upload(make_image(size=(2000, 1000)))).read())

    assert result.size == (512, 256)


def test_small_image_is_not_enlarged() -> None:
    """รูปเล็กกว่า 512 → ขนาดเดิม (ไม่ขยาย)"""
    result = open_result(process_avatar(upload(make_image(size=(120, 80)))).read())

    assert result.size == (120, 80)


def test_strips_metadata_including_gps() -> None:
    """ข้อมูลแฝง (รุ่นกล้อง, ตำแหน่ง GPS) ไม่ติดไปกับไฟล์ที่บันทึก"""
    exif = Image.Exif()
    exif[ExifTags.Base.Make] = "FakeCamera"
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps[ExifTags.GPS.GPSLatitudeRef] = "N"
    gps[ExifTags.GPS.GPSLatitude] = (18.0, 47.0, 30.0)
    original = make_image(exif=exif)
    # ยืนยันว่ารูปต้นฉบับมี GPS จริง (test มีความหมาย)
    assert Image.open(BytesIO(original)).getexif().get_ifd(ExifTags.IFD.GPSInfo)

    result_bytes = process_avatar(upload(original)).read()
    result = open_result(result_bytes)

    assert len(result.getexif()) == 0
    assert "exif" not in result.info
    assert "xmp" not in result.info
    assert b"FakeCamera" not in result_bytes


def test_rotates_by_camera_orientation() -> None:
    """รูปจากมือถือที่กล้องบันทึกว่า "หมุน 90°" → บันทึกเป็นแนวตั้งที่ถูกต้อง"""
    exif = Image.Exif()
    exif[ExifTags.Base.Orientation] = 6  # ต้องหมุนตามเข็มนาฬิกา 90° ตอนแสดง
    result = open_result(process_avatar(upload(make_image(size=(800, 400), exif=exif))).read())

    assert result.size == (256, 512)


def test_keeps_transparency() -> None:
    """PNG พื้นโปร่งใส → ยังโปร่งใส"""
    data = make_image("PNG", mode="RGBA")
    result = open_result(process_avatar(upload(data, "a.png", "image/png")).read())

    assert result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] == 128


@pytest.mark.parametrize(
    ("data", "name"),
    [
        (b"this is not an image", "fake.jpg"),
        (make_image("GIF"), "anim.gif"),
        (make_image("BMP"), "old.bmp"),
        (make_image("JPEG")[:400], "broken.jpg"),
    ],
    ids=["text-renamed-jpg", "gif", "bmp", "truncated-jpeg"],
)
def test_rejects_non_images_and_other_types(data: bytes, name: str) -> None:
    """ไม่ใช่รูป / ชนิดอื่น / ไฟล์เสีย → avatar_invalid_type (ดูจากเนื้อไฟล์ ไม่ใช่นามสกุล)"""
    with pytest.raises(AvatarError) as error:
        process_avatar(upload(data, name))

    assert error.value.code == "avatar_invalid_type"


def test_rejects_file_over_size_limit(settings) -> None:
    """ไฟล์ใหญ่เกินที่กำหนด → avatar_too_large"""
    data = make_image()
    settings.AVATAR_MAX_BYTES = len(data) - 1

    with pytest.raises(AvatarError) as error:
        process_avatar(upload(data))

    assert error.value.code == "avatar_too_large"


def test_rejects_too_many_pixels(settings) -> None:
    """ภาพพิกเซลมากเกิน (กันไฟล์เล็กที่ขยายแล้วกินหน่วยความจำ) → avatar_too_large"""
    settings.AVATAR_MAX_PIXELS = 100 * 100

    with pytest.raises(AvatarError) as error:
        process_avatar(upload(make_image(size=(101, 100))))

    assert error.value.code == "avatar_too_large"


# ---------------------------------------------------------------- API อัปโหลด / ลบ


@pytest.fixture
def student(db) -> User:
    return User.objects.create_user(
        email="student@example.com",
        password=PASSWORD,
        first_name="ผู้เรียน",
        last_name="ทดลอง",
        role=User.Role.STUDENT,
    )


@pytest.fixture
def client(student: User) -> APIClient:
    """เครื่องที่เข้าสู่ระบบเป็นผู้เรียนแล้ว"""
    api = APIClient()
    response = api.post(
        LOGIN_URL, {"identifier": "student@example.com", "password": PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return api


def post_avatar(client: APIClient, data: bytes, name: str = "photo.jpg"):
    return client.post(AVATAR_URL, {"avatar": upload(data, name)}, format="multipart")


def test_upload_saves_webp_and_returns_url(
    client: APIClient, student: User, media_in_tmp: Path
) -> None:
    """อัปโหลดสำเร็จ → 200 + avatar_url ใหม่ (ชื่อไฟล์สุ่ม .webp) และไฟล์อยู่ในที่เก็บไฟล์จริง"""
    response = post_avatar(client, make_image(size=(1200, 1200)))

    assert response.status_code == 200
    url = response.json()["avatar_url"]
    assert url.startswith("/media/avatars/")
    assert url.endswith(".webp")
    student.refresh_from_db()
    saved = media_in_tmp / student.avatar_url.name
    assert saved.exists()
    assert Image.open(saved).size == (512, 512)


def test_replacing_avatar_deletes_old_file(
    client: APIClient, student: User, media_in_tmp: Path, django_capture_on_commit_callbacks
) -> None:
    """เปลี่ยนรูป → ไฟล์รูปเดิมถูกลบ (ไม่ค้างในที่เก็บไฟล์) และได้ลิงก์ใหม่"""
    with django_capture_on_commit_callbacks(execute=True):
        first_url = post_avatar(client, make_image()).json()["avatar_url"]
    student.refresh_from_db()
    first_file = media_in_tmp / student.avatar_url.name

    with django_capture_on_commit_callbacks(execute=True):
        second_url = post_avatar(client, make_image("PNG"), "b.png").json()["avatar_url"]

    assert second_url != first_url
    assert not first_file.exists()


def test_delete_avatar(
    client: APIClient, student: User, media_in_tmp: Path, django_capture_on_commit_callbacks
) -> None:
    """ลบรูป → 200 avatar_url = null และไฟล์ถูกลบ ; ลบซ้ำตอนไม่มีรูปก็ได้ 200"""
    post_avatar(client, make_image())
    student.refresh_from_db()
    saved = media_in_tmp / student.avatar_url.name

    with django_capture_on_commit_callbacks(execute=True):
        response = client.delete(AVATAR_URL)

    assert response.status_code == 200
    assert response.json()["avatar_url"] is None
    assert not saved.exists()
    assert client.delete(AVATAR_URL).json()["avatar_url"] is None


def test_upload_invalid_image_returns_code(client: APIClient, student: User) -> None:
    """ไฟล์ที่ไม่ใช่รูป → 400 avatar_invalid_type และไม่เปลี่ยนรูป"""
    response = post_avatar(client, b"not an image at all", "fake.jpg")

    assert response.status_code == 400
    assert response.json()["code"] == "avatar_invalid_type"
    student.refresh_from_db()
    assert not student.avatar_url


def test_upload_over_2mb_is_rejected_early(client: APIClient, student: User) -> None:
    """คำขอใหญ่เกิน 2 MB → 400 avatar_too_large (ปฏิเสธจากขนาดที่แจ้งมา ไม่ต้องอ่านทั้งไฟล์)"""
    response = post_avatar(client, b"0" * (2 * 1024 * 1024 + 20 * 1024))

    assert response.status_code == 400
    assert response.json()["code"] == "avatar_too_large"


def test_upload_without_file(client: APIClient) -> None:
    """ไม่ได้แนบไฟล์ → validation_error รหัส required"""
    response = client.post(AVATAR_URL, {}, format="multipart")

    assert response.status_code == 400
    assert response.json()["fields"] == {"avatar": ["required"]}


def test_avatar_requires_login(student: User) -> None:
    """ไม่ได้เข้าสู่ระบบ → 401 ทั้งอัปโหลดและลบ"""
    anonymous = APIClient()

    assert post_avatar(anonymous, make_image()).status_code == 401
    assert anonymous.delete(AVATAR_URL).status_code == 401
