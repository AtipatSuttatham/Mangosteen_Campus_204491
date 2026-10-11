"""
ตรวจและแปลงรูปประจำตัวก่อนบันทึก (UC-02 — การตัดสินใจก้อน 1 / docs/database.md §11 v2.3)

ขั้นตอน (process_avatar):
  1. ไฟล์ใหญ่เกิน 2 MB                              → AvatarError("avatar_too_large")
  2. เปิดด้วย Pillow — ไม่ใช่รูป / ไม่ใช่ JPG-PNG-WebP → AvatarError("avatar_invalid_type")
     (ดูชนิดจากเนื้อไฟล์จริง ไม่เชื่อนามสกุลหรือชนิดที่เบราว์เซอร์บอกมา)
  3. ภาพมีพิกเซลมากผิดปกติ (> 25 ล้าน)               → AvatarError("avatar_too_large")
     (ไฟล์เล็กแต่ขยายแล้วกินหน่วยความจำมาก — เครื่องฟรีมี RAM 512 MB)
  4. หมุนตามข้อมูลกล้อง (รูปจากมือถือไม่ตะแคง) → ย่อให้ด้านยาวไม่เกิน 512px (สัดส่วนเดิม, ไม่ขยายรูปเล็ก)
  5. วาดลงภาพใหม่แล้วบันทึกเป็น WebP → ข้อมูลแฝงทั้งหมด (GPS, รุ่นกล้อง ฯลฯ) ไม่ติดไปด้วย

ผลลัพธ์เป็นไฟล์ WebP เสมอ (เล็กที่สุด, รองรับพื้นโปร่งใสแบบ PNG) ; รูปเคลื่อนไหวใช้เฉพาะภาพแรก
"""

from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, ImageOps, UnidentifiedImageError

# ชนิดรูปที่รับ (ชื่อตามที่ Pillow อ่านได้จากเนื้อไฟล์)
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
# ความคมของ WebP ที่บันทึก (0–100) — 85 ชัดพอสำหรับรูปวงกลมเล็ก และไฟล์เล็ก
_WEBP_QUALITY = 85


class AvatarError(Exception):
    """รูปที่ส่งมาใช้ไม่ได้ — code คือรหัส error ที่ส่งให้หน้าเว็บ (docs/api.md)"""

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail


def _has_transparency(image: Image.Image) -> bool:
    """รูปมีพื้นโปร่งใสไหม (PNG/WebP บางรูป) — ถ้ามี ต้องเก็บช่องโปร่งใสไว้"""
    return image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )


def process_avatar(upload: UploadedFile) -> ContentFile:
    """
    ตรวจ + ย่อ + ล้างข้อมูลแฝงของรูปที่อัปโหลด
    @returns ไฟล์ WebP ใหม่ (ยังไม่ได้บันทึก — ผู้เรียกบันทึกผ่าน storage เอง)
    @raises AvatarError เมื่อรูปใช้ไม่ได้
    """
    if upload.size is None or upload.size > settings.AVATAR_MAX_BYTES:
        raise AvatarError("avatar_too_large", "Avatar file is larger than 2 MB.")

    try:
        with Image.open(upload) as source:
            if source.format not in ALLOWED_FORMATS:
                raise AvatarError(
                    "avatar_invalid_type", "Avatar must be a JPEG, PNG or WebP image."
                )
            if source.width * source.height > settings.AVATAR_MAX_PIXELS:
                raise AvatarError("avatar_too_large", "Avatar image dimensions are too large.")

            # ถอดรหัสภาพจริง (ไฟล์เสีย/ตัดครึ่งจะ error ตรงนี้) แล้วหมุนตามข้อมูลกล้อง
            source.load()
            image = ImageOps.exif_transpose(source)
            image = image.convert("RGBA" if _has_transparency(image) else "RGB")
            image.thumbnail(
                (settings.AVATAR_MAX_SIZE, settings.AVATAR_MAX_SIZE), Image.Resampling.LANCZOS
            )

            # วาดลงภาพใหม่ที่ไม่มีข้อมูลประกอบใด ๆ — กันข้อมูลแฝงหลุดไปกับไฟล์ที่บันทึก
            clean = Image.new(image.mode, image.size)
            clean.paste(image)
            output = BytesIO()
            clean.save(output, format="WEBP", quality=_WEBP_QUALITY)
    except AvatarError:
        raise
    except Image.DecompressionBombError as error:
        # Pillow ปฏิเสธเองเมื่อภาพใหญ่ระดับอันตราย (ก่อนถึงการตรวจของเรา)
        raise AvatarError("avatar_too_large", "Avatar image dimensions are too large.") from error
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as error:
        # ไม่ใช่รูป / ไฟล์เสีย / ชนิดที่ Pillow อ่านไม่ได้
        raise AvatarError("avatar_invalid_type", "Avatar is not a valid image.") from error

    return ContentFile(output.getvalue())
