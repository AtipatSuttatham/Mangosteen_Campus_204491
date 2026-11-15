"""
API เนื้อหารายวิชาของผู้สอน (UC-09 — ขั้น 4.3) — อ้างอิง docs/api.md §10 และ CLAUDE.md "การตัดสินใจก้อน 4"

ที่อยู่ทั้งหมดอยู่ใต้ /api/v1/courses/{id วิชา}/ :
- modules/                               GET รายการหน่วย + เนื้อหา / POST เพิ่มหน่วย
- modules/{id}/                          PATCH แก้หน่วย / DELETE ลบหน่วย
- modules/{id}/publish/ · unpublish/     เผยแพร่ / ยกเลิกการเผยแพร่หน่วย
- modules/{id}/move/                     เลื่อนหน่วย {direction: up|down}
- modules/{id}/contents/text/            เพิ่มเนื้อหาแบบข้อความ
- modules/{id}/contents/link/            เพิ่มลิงก์ (YouTube → วิดีโอ)
- contents/{id}/                         PATCH แก้เนื้อหา / DELETE ลบเนื้อหา
- contents/{id}/publish/ · unpublish/    เผยแพร่ / ยกเลิกการเผยแพร่เนื้อหา
- contents/{id}/move/                    เลื่อนเนื้อหา {direction: up|down}
- modules/{id}/contents/file/            อัปโหลด 1 ไฟล์ (multipart) — ระบบตั้งชนิดเอง (ขั้น 4.3 ข)
- contents/{id}/file/                    เปลี่ยนไฟล์ชนิดเดิม หัวข้อคงเดิม (ขั้น 4.3 ข)

สิทธิ์ผ่าน content/access.py: ดู = ผู้สอนเจ้าของ + ผู้ดูแลระบบ ; แก้ = ผู้สอนเจ้าของเท่านั้น
ทุกการแก้อยู่ใน transaction เดียว (ล็อกแถววิชา) — จด AuditLog ไม่สำเร็จ = การลบถูกยกเลิก
"""

from django.db import transaction
from django.db.models import Prefetch
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from content import services
from content.access import get_content, get_course_for_content, get_module
from content.models import Content, Module
from content.serializers import (
    ContentSerializer,
    ContentUpdateSerializer,
    FileReplaceSerializer,
    FileUploadSerializer,
    LinkWriteSerializer,
    ModuleSerializer,
    ModuleWriteSerializer,
    MoveSerializer,
    TextWriteSerializer,
)


def module_response(module: Module, status_code: int = status.HTTP_200_OK) -> Response:
    """ส่งหน่วย 1 หน่วยพร้อมเนื้อหาล่าสุด (อ่านใหม่จากฐานข้อมูล)"""
    fresh = Module.objects.prefetch_related("contents").get(pk=module.pk)
    return Response(ModuleSerializer(fresh).data, status=status_code)


def content_response(content: Content, status_code: int = status.HTTP_200_OK) -> Response:
    """ส่งเนื้อหา 1 ชิ้น (อ่านใหม่จากฐานข้อมูล)"""
    return Response(ContentSerializer(Content.objects.get(pk=content.pk)).data, status=status_code)


class ModuleListView(APIView):
    """
    GET  …/modules/   หน่วยทั้งหมดของวิชา เรียงตามลำดับ + เนื้อหาทุกชิ้น (ทุกสถานะ)
                      ผู้สอนเจ้าของ / ผู้ดูแลระบบ (ดูอย่างเดียว) ; คนอื่น 404
    POST …/modules/   เพิ่มหน่วย {title, description?} → 201 ต่อท้าย ยังไม่เผยแพร่
    """

    permission_classes = [IsAuthenticated]
    # รับเฉพาะ JSON (แบบฟอร์มที่ส่งช่องว่างมา DRF จะข้ามช่องนั้นแทนการแจ้ง error — แก้หลังตรวจขั้น 4.3)
    parser_classes = [JSONParser]

    def get(self, request: Request, pk: int) -> Response:
        course = get_course_for_content(request.user, pk)
        modules = Module.objects.filter(course=course).prefetch_related(
            Prefetch("contents", queryset=Content.objects.order_by("order", "id"))
        )
        return Response(ModuleSerializer(modules, many=True).data)

    def post(self, request: Request, pk: int) -> Response:
        serializer = ModuleWriteSerializer(data=request.data)
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            serializer.is_valid(raise_exception=True)
            module = services.create_module(course, **serializer.validated_data)
        return module_response(module, status.HTTP_201_CREATED)


class ModuleDetailView(APIView):
    """
    PATCH  …/modules/{id}/   แก้ชื่อ / คำอธิบาย (ส่งเฉพาะช่องที่แก้) → 200 หน่วย
    DELETE …/modules/{id}/   ลบหน่วย (เนื้อหา + ไฟล์หายตาม) → 204 + AuditLog delete
    """

    permission_classes = [IsAuthenticated]
    # รับเฉพาะ JSON (แบบฟอร์มที่ส่งช่องว่างมา DRF จะข้ามช่องนั้นแทนการแจ้ง error — แก้หลังตรวจขั้น 4.3)
    parser_classes = [JSONParser]

    def patch(self, request: Request, pk: int, module_id: int) -> Response:
        serializer = ModuleWriteSerializer(data=request.data, partial=True)
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            module = get_module(course, module_id)
            serializer.is_valid(raise_exception=True)
            services.update_module(module, serializer.validated_data)
        return module_response(module)

    def delete(self, request: Request, pk: int, module_id: int) -> Response:
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            module = get_module(course, module_id)
            services.delete_module(request.user, course, module)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModuleActionView(APIView):
    """
    POST …/modules/{id}/publish/     เผยแพร่ (เป็นอยู่แล้ว = 200 เหมือนกัน)
    POST …/modules/{id}/unpublish/   ยกเลิกการเผยแพร่
    POST …/modules/{id}/move/        เลื่อน {direction: up|down} (ตัวแรก ↑ / ตัวสุดท้าย ↓ = ไม่เปลี่ยน)
    ตอบ 200 หน่วยล่าสุด
    """

    permission_classes = [IsAuthenticated]
    # รับเฉพาะ JSON (แบบฟอร์มที่ส่งช่องว่างมา DRF จะข้ามช่องนั้นแทนการแจ้ง error — แก้หลังตรวจขั้น 4.3)
    parser_classes = [JSONParser]
    # "publish" / "unpublish" / "move" — กำหนดใน urls.py
    action: str = "publish"

    def post(self, request: Request, pk: int, module_id: int) -> Response:
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            module = get_module(course, module_id)
            if self.action == "move":
                serializer = MoveSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                services.move_module(course, module, serializer.validated_data["direction"])
            else:
                services.set_published(module, self.action == "publish")
        return module_response(module)


class ContentCreateView(APIView):
    """
    POST …/modules/{id}/contents/text/   เพิ่มข้อความ {title, body?}
    POST …/modules/{id}/contents/link/   เพิ่มลิงก์ {url, title?, body?} — YouTube → ชนิด video
    → 201 เนื้อหาใหม่ (ต่อท้ายหน่วย ยังไม่เผยแพร่)
    """

    permission_classes = [IsAuthenticated]
    # รับเฉพาะ JSON (แบบฟอร์มที่ส่งช่องว่างมา DRF จะข้ามช่องนั้นแทนการแจ้ง error — แก้หลังตรวจขั้น 4.3)
    parser_classes = [JSONParser]
    # "text" / "link" — กำหนดใน urls.py
    kind: str = "text"

    def post(self, request: Request, pk: int, module_id: int) -> Response:
        serializer_class = TextWriteSerializer if self.kind == "text" else LinkWriteSerializer
        serializer = serializer_class(data=request.data)
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            module = get_module(course, module_id)
            serializer.is_valid(raise_exception=True)
            create = services.create_text if self.kind == "text" else services.create_link
            content = create(module, **serializer.validated_data)
        return content_response(content, status.HTTP_201_CREATED)


class ContentDetailView(APIView):
    """
    PATCH  …/contents/{id}/   แก้ {title?, body?, allow_download?, url?, module?} → 200 เนื้อหา
           module = ย้ายไปต่อท้ายหน่วยนั้น (ต้องอยู่วิชาเดียวกัน ไม่งั้น 404)
           url = แก้ลิงก์ (ชนิดต้องไม่เปลี่ยน ไม่งั้น 409 content_kind_mismatch)
    DELETE …/contents/{id}/   ลบ (ไฟล์หายตาม) → 204 + AuditLog delete
    """

    permission_classes = [IsAuthenticated]
    # รับเฉพาะ JSON (แบบฟอร์มที่ส่งช่องว่างมา DRF จะข้ามช่องนั้นแทนการแจ้ง error — แก้หลังตรวจขั้น 4.3)
    parser_classes = [JSONParser]

    def patch(self, request: Request, pk: int, content_id: int) -> Response:
        serializer = ContentUpdateSerializer(data=request.data)
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            content = get_content(course, content_id)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            new_module = get_module(course, data["module"]) if "module" in data else None
            services.update_content(content, data, new_module=new_module)
        return content_response(content)

    def delete(self, request: Request, pk: int, content_id: int) -> Response:
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            content = get_content(course, content_id)
            services.delete_content(request.user, course, content)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentActionView(APIView):
    """
    POST …/contents/{id}/publish/ · unpublish/   เผยแพร่ / ยกเลิกการเผยแพร่
    POST …/contents/{id}/move/                   เลื่อนในหน่วย {direction: up|down}
    ตอบ 200 เนื้อหาล่าสุด
    """

    permission_classes = [IsAuthenticated]
    # รับเฉพาะ JSON (แบบฟอร์มที่ส่งช่องว่างมา DRF จะข้ามช่องนั้นแทนการแจ้ง error — แก้หลังตรวจขั้น 4.3)
    parser_classes = [JSONParser]
    action: str = "publish"

    def post(self, request: Request, pk: int, content_id: int) -> Response:
        with transaction.atomic():
            course = get_course_for_content(request.user, pk, write=True)
            content = get_content(course, content_id)
            if self.action == "move":
                serializer = MoveSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                services.move_content(content, serializer.validated_data["direction"])
            else:
                services.set_published(content, self.action == "publish")
        return content_response(content)


class ContentFileUploadView(APIView):
    """
    POST …/modules/{id}/contents/file/   อัปโหลด 1 ไฟล์ (multipart: file, title?, body?)
         หน้าเว็บอัปโหลดหลายไฟล์ = ส่งทีละไฟล์ (กญ1) ; ระบบตั้งชนิดจากไฟล์ ; ไม่กรอกหัวข้อ → ชื่อไฟล์ตัดนามสกุล
    → 201 เนื้อหาใหม่ (ต่อท้ายหน่วย ยังไม่เผยแพร่ ดาวน์โหลดได้)
    ไม่ผ่าน → 400 content_file_type_not_allowed / content_file_empty / content_file_too_large /
              content_file_mismatch ; 503 file_upload_failed (เก็บไฟล์ไม่ได้ — กน1)

    ลำดับ (แก้หลังตรวจขั้น 4.3): ตรวจสิทธิ์ก่อนอ่านไฟล์ (ไม่ล็อก) → ตรวจ + เก็บไฟล์ (ไม่ล็อก) →
    ล็อกวิชาสั้น ๆ ตรวจสิทธิ์ / หน่วยซ้ำ (เผื่อวิชาถูกปิด / หน่วยถูกลบระหว่างนั้น) แล้วบันทึกแถว
    → ไม่ถือล็อกวิชา (ที่ผู้เรียนเข้าร่วมด้วยรหัสใช้ร่วม) ระหว่างส่งไฟล์ใหญ่ขึ้นที่เก็บ
    ไม่สำเร็จที่ขั้นใดก็ตาม → ไฟล์ที่เพิ่งเก็บถูกลบทิ้ง (ไม่มีไฟล์ค้าง)
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request, pk: int, module_id: int) -> Response:
        # ตรวจสิทธิ์ก่อนแตะ request.data (ไม่มีสิทธิ์ = ไม่ต้องรับ / เขียนไฟล์ชั่วคราว)
        course = get_course_for_content(request.user, pk, write=True, lock=False)
        module = get_module(course, module_id)
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with services.remove_files_on_failure() as stored:
            upload = services.store_upload(module, data["file"], stored)
            with transaction.atomic():
                course = get_course_for_content(request.user, pk, write=True)
                module = get_module(course, module_id)
                content = services.create_file(
                    module, upload, title=data.get("title", ""), body=data.get("body", "")
                )
        return content_response(content, status.HTTP_201_CREATED)


class ContentFileReplaceView(APIView):
    """
    POST …/contents/{id}/file/   เปลี่ยนไฟล์ (multipart: file) — ชนิดเดิมเท่านั้น, หัวข้อเดิมคงไว้ (กธ1)
    → 200 เนื้อหา ; ไฟล์เก่าถูกลบหลังบันทึกเสร็จ
    ไม่ผ่าน → 400 (เหมือนอัปโหลด) ; 409 content_kind_mismatch (คนละชนิด / เนื้อหาที่ไม่มีไฟล์) ; 503
    ลำดับเดียวกับการอัปโหลด: เก็บไฟล์นอกล็อก แล้วล็อกสั้น ๆ ตรวจซ้ำและผูกไฟล์ใหม่
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request, pk: int, content_id: int) -> Response:
        course = get_course_for_content(request.user, pk, write=True, lock=False)
        content = get_content(course, content_id)
        serializer = FileReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with services.remove_files_on_failure() as stored:
            upload = services.store_upload(
                content.module, serializer.validated_data["file"], stored
            )
            # ชนิดไม่ตรงรู้ได้ตั้งแต่ตอนนี้ → ปฏิเสธ (ไฟล์ที่เพิ่งเก็บถูกลบ) ไม่ต้องล็อกวิชา
            services.ensure_same_kind(content, upload.info)
            with transaction.atomic():
                course = get_course_for_content(request.user, pk, write=True)
                content = get_content(course, content_id)
                services.replace_file(content, upload)
        return content_response(content)
