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
