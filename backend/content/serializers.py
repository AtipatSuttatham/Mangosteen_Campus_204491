"""
ตัวแปลง / ตรวจข้อมูล (serializer) ของ API เนื้อหารายวิชา (ขั้น 4.3) — อ้างอิง docs/api.md §10

ขาออก:
- ContentSerializer: เนื้อหา 1 ชิ้น (+ รหัส YouTube, ลิงก์ดูไฟล์, ลิงก์ดาวน์โหลด)
- ModuleSerializer: หน่วย 1 หน่วย + เนื้อหาทุกชิ้นในหน่วย (ผู้สอน / ผู้ดูแลระบบเห็นทุกสถานะ)
- StudentContentSerializer / StudentModuleSerializer: ฉบับของผู้เรียน (ขั้น 4.4) — เฉพาะที่จำเป็น,
  ลิงก์ดาวน์โหลดตาม allow_download
ขาเข้า:
- ModuleWriteSerializer: เพิ่ม / แก้หน่วย
- TextWriteSerializer / LinkWriteSerializer: เพิ่มเนื้อหาแบบข้อความ / ลิงก์
- ContentUpdateSerializer: แก้เนื้อหา (ส่งเฉพาะช่องที่แก้)
- FileUploadSerializer / FileReplaceSerializer: อัปโหลด / เปลี่ยนไฟล์ (ขั้น 4.3 ข)
- MoveSerializer: ทิศทางการเลื่อน
"""

from django.core.validators import URLValidator
from rest_framework import serializers

from content.models import Content, Module
from content.services import download_url
from content.youtube import youtube_video_id

# ความยาวสูงสุดตามตาราง (models.py)
TITLE_MAX = 200
URL_MAX = 500


def content_youtube_id(content: Content) -> str | None:
    """รหัสวิดีโอ YouTube ของเนื้อหาชนิดวิดีโอที่เป็นลิงก์ ; อื่น ๆ = None (ใช้ทั้งฉบับผู้สอน / ผู้เรียน)"""
    if content.content_type == Content.Kind.VIDEO and content.external_url:
        return youtube_video_id(content.external_url)
    return None


class ContentSerializer(serializers.ModelSerializer):
    """เนื้อหา 1 ชิ้นที่ผู้สอน / ผู้ดูแลระบบเห็น"""

    # รหัสหน่วยที่อยู่
    module = serializers.IntegerField(source="module_id", read_only=True)
    # รหัสวิดีโอ YouTube (frontend ใช้ฝังผ่าน youtube-nocookie.com) ; ไม่ใช่ YouTube = null
    youtube_id = serializers.SerializerMethodField()
    # ลิงก์ดูไฟล์ (ตอนพัฒนา /media/… ; ตอน deploy ลิงก์ชั่วคราวของ B2) ; ไม่มีไฟล์ = null
    file_link = serializers.SerializerMethodField()
    # ลิงก์ดาวน์โหลดที่ได้ชื่อไฟล์เดิม (ผู้สอนได้เสมอ — allow_download มีผลกับผู้เรียนในขั้น 4.4)
    download_link = serializers.SerializerMethodField()
    # ค่าที่มีผลจริง (กพ1) — ไฟล์ชนิดที่ปิดดาวน์โหลดไม่ได้ = True เสมอ
    allow_download = serializers.BooleanField(source="effective_allow_download", read_only=True)
    # หน้าต่างแก้ไขแสดงสวิตช์ "ให้ผู้เรียนดาวน์โหลดได้" ไหม (กพ1 — เฉพาะ PDF / รูป / เสียง / วิดีโอ / .txt)
    can_disable_download = serializers.BooleanField(read_only=True)

    class Meta:
        model = Content
        fields = [
            "id",
            "module",
            "title",
            "content_type",
            "body",
            "order",
            "is_published",
            "file_name",
            "file_size",
            "mime_type",
            "file_link",
            "download_link",
            "external_url",
            "youtube_id",
            "allow_download",
            "can_disable_download",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_youtube_id(self, content: Content) -> str | None:
        return content_youtube_id(content)

    def get_file_link(self, content: Content) -> str | None:
        return content.file_url.url if content.file_url else None

    def get_download_link(self, content: Content) -> str | None:
        return download_url(content)


class ModuleSerializer(serializers.ModelSerializer):
    """หน่วย 1 หน่วย + เนื้อหาเรียงตามลำดับ"""

    contents = ContentSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ["id", "title", "description", "order", "is_published", "contents"]
        read_only_fields = fields


class StudentContentSerializer(serializers.ModelSerializer):
    """
    เนื้อหา 1 ชิ้นที่ผู้เรียนเห็น (ขั้น 4.4) — ไม่มีข้อมูลภายใน (สถานะเผยแพร่ / ลำดับ / เวลา)
    download_link: ผู้สอนปิดการดาวน์โหลด (allow_download=False — กฑ2) → null เสมอ
    (ปิดได้เฉพาะไฟล์ที่เบราว์เซอร์เปิดดูได้ — กพ1 ; ชนิดอื่นดาวน์โหลดได้เสมอ)
    (backend ไม่ส่งลิงก์ดาวน์โหลดเลย ไม่ใช่แค่ซ่อนปุ่ม) ; file_link ยังมีไว้เปิดดู / เล่นในหน้า
    """

    youtube_id = serializers.SerializerMethodField()
    file_link = serializers.SerializerMethodField()
    download_link = serializers.SerializerMethodField()
    # ค่าที่มีผลจริง (กพ1) — หน้าจอใช้แสดง "ผู้สอนปิดการดาวน์โหลดไฟล์นี้"
    allow_download = serializers.BooleanField(source="effective_allow_download", read_only=True)

    class Meta:
        model = Content
        fields = [
            "id",
            "title",
            "content_type",
            "body",
            "file_name",
            "file_size",
            "mime_type",
            "file_link",
            "download_link",
            "external_url",
            "youtube_id",
            "allow_download",
        ]
        read_only_fields = fields

    def get_youtube_id(self, content: Content) -> str | None:
        return content_youtube_id(content)

    def get_file_link(self, content: Content) -> str | None:
        return content.file_url.url if content.file_url else None

    def get_download_link(self, content: Content) -> str | None:
        return download_url(content) if content.effective_allow_download else None


class StudentModuleSerializer(serializers.ModelSerializer):
    """
    หน่วยที่ผู้เรียนเห็น + เนื้อหาที่เผยแพร่แล้ว (views.py กรองมาให้)
    หน่วยที่เผยแพร่แต่ยังไม่มีเนื้อหาที่เผยแพร่ → contents ว่าง (กฝ1: ยังแสดงหน่วย)
    """

    contents = StudentContentSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ["id", "title", "description", "contents"]
        read_only_fields = fields


class ModuleWriteSerializer(serializers.Serializer):
    """เพิ่ม / แก้หน่วย: ชื่อ (บังคับ ห้ามว่าง) + คำอธิบาย (ไม่บังคับ)"""

    title = serializers.CharField(max_length=TITLE_MAX)
    description = serializers.CharField(required=False, allow_blank=True)


class TextWriteSerializer(serializers.Serializer):
    """เพิ่มเนื้อหาแบบข้อความ: หัวข้อบังคับ (ไม่มีชื่อไฟล์ให้ใช้แทน) + เนื้อความ Markdown"""

    title = serializers.CharField(max_length=TITLE_MAX)
    body = serializers.CharField(required=False, allow_blank=True)


class HttpUrlField(serializers.CharField):
    """ลิงก์ http / https เท่านั้น (กัน javascript: / ftp: ฯลฯ) — ผิดรูปแบบ = รหัส invalid"""

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", URL_MAX)
        super().__init__(**kwargs)
        self.validators.append(URLValidator(schemes=["http", "https"]))


class LinkWriteSerializer(serializers.Serializer):
    """เพิ่มลิงก์: ลิงก์บังคับ ; หัวข้อ / คำอธิบายไม่บังคับ (ไม่กรอก → ระบบตั้งหัวข้อให้)"""

    url = HttpUrlField()
    title = serializers.CharField(max_length=TITLE_MAX, required=False, allow_blank=True)
    body = serializers.CharField(required=False, allow_blank=True)


class ContentUpdateSerializer(serializers.Serializer):
    """แก้เนื้อหา — ส่งเฉพาะช่องที่แก้ ; หัวข้อห้ามว่าง ; module = รหัสหน่วยปลายทาง (ย้ายหน่วย)"""

    title = serializers.CharField(max_length=TITLE_MAX, required=False)
    body = serializers.CharField(required=False, allow_blank=True)
    allow_download = serializers.BooleanField(required=False)
    url = HttpUrlField(required=False)
    module = serializers.IntegerField(required=False, min_value=1)


class FileUploadSerializer(serializers.Serializer):
    """
    อัปโหลด 1 ไฟล์ (multipart): file บังคับ ; หัวข้อ / คำอธิบายไม่บังคับ (ไม่กรอก → ชื่อไฟล์ตัดนามสกุล)
    ไฟล์ว่าง / ชนิด / ขนาด / เนื้อไฟล์ ตรวจใน file_types.py (ให้ได้รหัส error เฉพาะเรื่อง)
    """

    file = serializers.FileField(allow_empty_file=True, use_url=False)
    title = serializers.CharField(max_length=TITLE_MAX, required=False, allow_blank=True)
    body = serializers.CharField(required=False, allow_blank=True)


class FileReplaceSerializer(serializers.Serializer):
    """เปลี่ยนไฟล์ (multipart): file บังคับ — หัวข้อเดิมคงไว้ (กธ1)"""

    file = serializers.FileField(allow_empty_file=True, use_url=False)


class MoveSerializer(serializers.Serializer):
    """ทิศทางการเลื่อน: up = ขึ้น 1 ตำแหน่ง, down = ลง 1 ตำแหน่ง"""

    direction = serializers.ChoiceField(choices=["up", "down"])
