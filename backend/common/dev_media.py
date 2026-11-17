"""
ส่งไฟล์ที่อัปโหลดไว้ใน backend/media/ ตอนพัฒนา (DEBUG=True เท่านั้น — config/urls.py) — ขั้น 4.7 ก

ทำไมไม่ใช้ `django.views.static.serve` ตรง ๆ:
Django ใส่หัว `Content-Disposition: inline; filename="<ชื่อไฟล์สุ่ม>"` ให้ทุกไฟล์ และเบราว์เซอร์ถือชื่อในหัวนี้
เหนือ `<a download="ชื่อเดิม">` ของหน้าเว็บ → ปุ่ม "ดาวน์โหลด" ในหน้าบทเรียนได้ไฟล์ชื่อสุ่ม (พบตอนทดสอบใน Chrome)
จึงเอาหัวนี้ออก ให้หน้าเว็บตั้งชื่อเดิมเอง (ตามที่ content.services.download_url ออกแบบไว้)

นอกจากนี้ไฟล์ข้อความ (text/plain, text/x-python) ใส่ charset=utf-8 ให้ — ไม่งั้นเบราว์เซอร์เดาเป็น windows-1252
และ .txt ภาษาไทยที่กด "เปิด" อ่านไม่ออก (แก้หลังตรวจขั้น 4.7 ก — ขจ1)
ตอน deploy ลิงก์ของไฟล์ข้อความใส่ charset เองที่ content.services.view_url

ตอน deploy ไม่ใช้ไฟล์นี้: ไฟล์อยู่บน B2 และลิงก์ดาวน์โหลดสั่งชื่อเดิมด้วย ResponseContentDisposition เอง
"""

from django.http import HttpRequest, HttpResponse
from django.views.static import serve


def serve_media(request: HttpRequest, path: str, document_root: str | None = None) -> HttpResponse:
    """เหมือน django.views.static.serve แต่ไม่ส่ง Content-Disposition + ไฟล์ข้อความบอก charset=utf-8"""
    response = serve(request, path, document_root=document_root)
    if "Content-Disposition" in response:
        del response["Content-Disposition"]
    content_type = response.get("Content-Type", "")
    if content_type.startswith("text/") and "charset" not in content_type:
        response["Content-Type"] = f"{content_type}; charset=utf-8"
    return response
