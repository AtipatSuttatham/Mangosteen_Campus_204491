"""test ของตัวส่งไฟล์ตอนพัฒนา (common/dev_media.py — ขั้น 4.7 ก)"""

from django.test import RequestFactory

from common.dev_media import serve_media


def test_serve_media_drops_content_disposition(tmp_path):
    """ส่งไฟล์ได้ตามปกติ แต่ไม่มี Content-Disposition (ไม่งั้นทับชื่อเดิมจาก <a download>)"""
    (tmp_path / "abc123.pdf").write_bytes(b"%PDF-1.4 test")

    request = RequestFactory().get("/media/abc123.pdf")
    response = serve_media(request, "abc123.pdf", document_root=str(tmp_path))

    assert response.status_code == 200
    assert b"".join(response.streaming_content) == b"%PDF-1.4 test"
    assert "Content-Disposition" not in response


def test_serve_media_marks_text_files_as_utf8(tmp_path):
    """ไฟล์ข้อความบอก charset=utf-8 (.txt ภาษาไทยที่กด "เปิด" อ่านออก — ขจ1) ; ไฟล์ชนิดอื่นไม่เปลี่ยน"""
    (tmp_path / "notes.txt").write_text("บันทึกท้ายบท", encoding="utf-8")
    (tmp_path / "abc.pdf").write_bytes(b"%PDF-1.4")
    factory = RequestFactory()

    text = serve_media(factory.get("/media/notes.txt"), "notes.txt", document_root=str(tmp_path))
    pdf = serve_media(factory.get("/media/abc.pdf"), "abc.pdf", document_root=str(tmp_path))

    assert text["Content-Type"] == "text/plain; charset=utf-8"
    assert pdf["Content-Type"] == "application/pdf"
