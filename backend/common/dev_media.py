"""
ส่งไฟล์ที่อัปโหลดไว้ใน backend/media/ ตอนพัฒนา (DEBUG=True เท่านั้น — config/urls.py) — ขั้น 4.7 ก

ทำไมไม่ใช้ `django.views.static.serve` ตรง ๆ:
Django ใส่หัว `Content-Disposition: inline; filename="<ชื่อไฟล์สุ่ม>"` ให้ทุกไฟล์ และเบราว์เซอร์ถือชื่อในหัวนี้
เหนือ `<a download="ชื่อเดิม">` ของหน้าเว็บ → ปุ่ม "ดาวน์โหลด" ในหน้าบทเรียนได้ไฟล์ชื่อสุ่ม (พบตอนทดสอบใน Chrome)
จึงเอาหัวนี้ออก ให้หน้าเว็บตั้งชื่อเดิมเอง (ตามที่ content.services.download_url ออกแบบไว้)

ตอน deploy ไม่ใช้ไฟล์นี้: ไฟล์อยู่บน B2 และลิงก์ดาวน์โหลดสั่งชื่อเดิมด้วย ResponseContentDisposition เอง
"""

from django.http import HttpRequest, HttpResponse
from django.views.static import serve


def serve_media(request: HttpRequest, path: str, document_root: str | None = None) -> HttpResponse:
    """เหมือน django.views.static.serve แต่ไม่ส่ง Content-Disposition (หน้าเว็บตั้งชื่อไฟล์ที่ดาวน์โหลดเอง)"""
    response = serve(request, path, document_root=document_root)
    if "Content-Disposition" in response:
        del response["Content-Disposition"]
    return response
