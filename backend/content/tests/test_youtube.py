"""
test ตัวอ่านลิงก์ YouTube (content/youtube.py) — ไม่ใช้ฐานข้อมูล
"""

import pytest

from content.youtube import site_name, youtube_video_id, youtube_watch_url

VIDEO_ID = "Zp5MuPOtsSY"


@pytest.mark.parametrize(
    "url",
    [
        f"https://www.youtube.com/watch?v={VIDEO_ID}",
        f"https://youtube.com/watch?v={VIDEO_ID}&t=42s&si=abc",
        f"http://m.youtube.com/watch?feature=share&v={VIDEO_ID}",
        f"https://youtu.be/{VIDEO_ID}?si=xyz",
        f"https://www.youtube.com/shorts/{VIDEO_ID}",
        f"https://www.youtube.com/embed/{VIDEO_ID}",
        f"https://www.youtube-nocookie.com/embed/{VIDEO_ID}",
        f"https://www.youtube.com/live/{VIDEO_ID}",
        f"  https://WWW.YOUTUBE.COM/watch?v={VIDEO_ID}  ",
    ],
)
def test_recognises_youtube_forms(url: str) -> None:
    """ลิงก์ YouTube รูปแบบที่พบบ่อยทุกแบบ → ได้รหัสวิดีโอ"""
    assert youtube_video_id(url) == VIDEO_ID


@pytest.mark.parametrize(
    "url",
    [
        "https://docs.python.org/3/tutorial/controlflow.html",
        f"https://youtube.com.evil.example/watch?v={VIDEO_ID}",
        f"https://notyoutube.com/watch?v={VIDEO_ID}",
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/@channel",
        "https://www.youtube.com/playlist?list=PL123",
        f"javascript:alert('{VIDEO_ID}')",
        f"ftp://youtu.be/{VIDEO_ID}",
    ],
)
def test_rejects_other_links(url: str) -> None:
    """ลิงก์อื่น / เว็บที่หน้าตาคล้าย / หน้าช่อง / รหัสผิดรูปแบบ → ไม่ใช่วิดีโอ YouTube"""
    assert youtube_video_id(url) is None


def test_watch_url_and_site_name() -> None:
    assert youtube_watch_url(VIDEO_ID) == f"https://www.youtube.com/watch?v={VIDEO_ID}"
    assert site_name("https://www.python.org/about/") == "python.org"
    assert site_name("https://docs.python.org/3/") == "docs.python.org"
