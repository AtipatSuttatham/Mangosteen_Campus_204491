"""
อ่านลิงก์ที่ผู้สอนวาง: เป็นวิดีโอ YouTube ไหม (กฎ1 — ระบบรู้เอง ผู้สอนไม่ต้องเลือกชนิด)

- YouTube → เนื้อหาชนิด video เล่นในหน้า (frontend ฝังผ่าน youtube-nocookie.com ด้วยรหัสวิดีโอ — กฉ1)
- ลิงก์อื่น → เนื้อหาชนิด link เป็นปุ่มเปิดในแท็บใหม่
- ตรวจจากชื่อเว็บ (host) แบบตรงตัวเท่านั้น — "youtube.com.example.net" จึงไม่ถูกนับเป็น YouTube
- เก็บลิงก์ YouTube เป็นรูปแบบมาตรฐานเดียว https://www.youtube.com/watch?v=<รหัส>
  (ตัดค่าติดตามอื่น ๆ ใน query เช่น &si=… ออก)
"""

import re
from urllib.parse import parse_qs, urlsplit

# หัวข้อที่ระบบตั้งให้เมื่อผู้สอนไม่ได้กรอก (เป็น "ข้อมูล" ที่เก็บในแถว ไม่ใช่ข้อความหน้าจอ — แก้ได้ภายหลัง)
YOUTUBE_DEFAULT_TITLE = "วิดีโอจาก YouTube"

# รหัสวิดีโอ YouTube = 11 ตัว จาก A–Z a–z 0–9 _ -
_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
# ชื่อเว็บของ YouTube ที่รับ (ตรงตัวเท่านั้น)
_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}
_SHORT_HOSTS = {"youtu.be", "www.youtu.be"}
# รูปแบบที่อยู่ที่มีรหัสวิดีโอเป็นส่วนที่ 2 เช่น /shorts/<รหัส>, /embed/<รหัส>
_ID_PATH_PREFIXES = {"shorts", "embed", "live", "v"}


def youtube_video_id(url: str) -> str | None:
    """รหัสวิดีโอ 11 ตัวถ้าเป็นลิงก์ YouTube ที่รู้จัก ; ไม่ใช่ → None"""
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https"):
        return None
    host = (parts.hostname or "").lower()
    segments = [segment for segment in parts.path.split("/") if segment]

    candidate = None
    if host in _SHORT_HOSTS and segments:
        # https://youtu.be/<รหัส>
        candidate = segments[0]
    elif host in _YOUTUBE_HOSTS:
        if parts.path == "/watch":
            # https://www.youtube.com/watch?v=<รหัส>
            candidate = (parse_qs(parts.query).get("v") or [None])[0]
        elif len(segments) >= 2 and segments[0] in _ID_PATH_PREFIXES:
            candidate = segments[1]

    if candidate and _VIDEO_ID.match(candidate):
        return candidate
    return None


def youtube_watch_url(video_id: str) -> str:
    """ลิงก์ YouTube รูปแบบมาตรฐานที่เก็บในฐานข้อมูล"""
    return f"https://www.youtube.com/watch?v={video_id}"


def site_name(url: str) -> str:
    """ชื่อเว็บไซต์สำหรับตั้งเป็นหัวข้อของลิงก์ทั่วไป เช่น https://www.python.org/x → python.org"""
    host = (urlsplit(url.strip()).hostname or "").lower()
    return host.removeprefix("www.") or url.strip()
