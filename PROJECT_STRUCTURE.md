# โครงสร้างโปรเจกต์ — Mangosteen Campus

> เอกสารนี้บอกว่าแต่ละไฟล์/โฟลเดอร์ในโปรเจกต์ใช้เก็บหรือทำหน้าที่อะไร
> **ต้องอัปเดตใน PR เดียวกับที่เพิ่ม/ย้าย/ลบไฟล์หรือโฟลเดอร์สำคัญ** เพื่อให้ตรงกับโครงสร้างจริงเสมอ
>
> อัปเดตล่าสุด: ขั้น 0.1 (backend + ฐานข้อมูล + CI ฝั่ง backend)

## โครงสร้างปัจจุบัน

```
Mangosteen_Campus_204491/
├── CLAUDE.md                 ข้อกำหนดและข้อตกลงการทำงานสำหรับ Claude (กฎ, การตัดสินใจ, tech stack)
├── README.md                 หน้าแรกของ repo: ระบบคืออะไร, เทคโนโลยี, วิธีรัน, ลิงก์ไปเอกสารอื่น
├── PROJECT_SCOPE.md          ขอบเขตงาน, ยูสเคส, แผนงาน และสถานะความคืบหน้า
├── PROJECT_STRUCTURE.md      ไฟล์นี้ — อธิบายโครงสร้างไฟล์/โฟลเดอร์ทั้งหมด
├── WORKFLOW_GUIDE.md         คู่มือขั้นตอนการทำงานสำหรับผู้ใช้ (ทีละขั้น อ่านง่าย)
├── .gitignore                รายการไฟล์ที่ไม่นำขึ้น GitHub (รายงาน .docx, .env, โฟลเดอร์ที่สร้างอัตโนมัติ)
├── .gitattributes            บังคับการขึ้นบรรทัดแบบ LF ทุกเครื่อง (กันไฟล์ "เปลี่ยน" ระหว่าง Windows กับ CI)
├── .env.example              ตัวอย่างค่าตั้งค่า (ไม่มีค่าจริง) — คัดลอกเป็น .env ก่อนรันระบบ
├── docker-compose.yml        รันฐานข้อมูล PostgreSQL 18 ในเครื่องด้วย Docker (พอร์ตตั้งได้ใน .env)
│
├── .github/
│   └── workflows/
│       └── ci.yml            CI บน GitHub Actions — job backend: ruff + Django check + pytest บน PostgreSQL จริง
│
├── backend/                  ส่วนหลังบ้าน: Django 5.2 + Django REST Framework (จัดการแพ็กเกจด้วย uv)
│   ├── manage.py             ตัวสั่งงาน Django ผ่าน command line (runserver, migrate ฯลฯ)
│   ├── pyproject.toml        รายการแพ็กเกจ Python + ตั้งค่า pytest และ ruff
│   ├── uv.lock               ล็อกเวอร์ชันแพ็กเกจทุกตัว (ทุกเครื่อง/CI ได้เวอร์ชันเดียวกัน) — uv สร้างให้ ห้ามแก้มือ
│   ├── config/               ตั้งค่าของโปรเจกต์ Django
│   │   ├── settings.py       ตั้งค่าหลัก: อ่านค่าลับจาก .env, ฐานข้อมูล, เขตเวลา, DRF
│   │   ├── urls.py           รวมเส้นทาง URL ทั้งหมด (/admin/, /api/health/)
│   │   ├── wsgi.py           จุดเริ่มต้นเมื่อรันบนเซิร์ฟเวอร์แบบ WSGI
│   │   └── asgi.py           จุดเริ่มต้นเมื่อรันบนเซิร์ฟเวอร์แบบ ASGI
│   └── common/               app ของใช้ร่วมกันทุก app
│       ├── models.py         TimeStampedModel — ต้นแบบที่เพิ่ม created_at / updated_at ให้ทุกตาราง
│       ├── views.py          endpoint ตรวจสุขภาพระบบ GET /api/health/
│       ├── apps.py           ข้อมูลประจำ app
│       ├── migrations/       ไฟล์เปลี่ยนโครงสร้างฐานข้อมูลของ app นี้ (ยังว่าง)
│       └── tests/
│           └── test_health.py  test ของ /api/health/ (ปกติ / ฐานข้อมูลล่ม / ส่ง method ผิด)
│
└── docs/                     เอกสารออกแบบระบบ
    ├── database.md           สเปกฐานข้อมูลเต็ม: 20 ตาราง, field, constraint, สูตรคะแนน,
    │                         บันทึกการตัดสินใจ (§11) และสิ่งที่ไม่ทำใน MVP (§13)
    ├── database-guide.md     ใครเขียน/ใครอ่านแต่ละตาราง, state machine, workflow W1–W15,
    │                         การดึงข้อมูลตามหน้าจอ
    ├── database-fields.md    คำอธิบายสั้นราย field ของทุกตาราง (quick reference)
    └── database-erd.md       แผนภาพความสัมพันธ์ระหว่างตาราง (ERD) แบบ Mermaid แยก 6 กลุ่ม
```

> ไฟล์รายงานบทที่ 1–5 (`.docx`) อยู่ในเครื่องผู้พัฒนาเท่านั้น — ไม่ขึ้น GitHub (ดู `.gitignore`)

## โครงสร้างที่จะเพิ่มในขั้นถัดไป (ยังไม่มีจริง)

| โฟลเดอร์/ไฟล์ | สร้างในขั้น | หน้าที่ |
|---|---|---|
| `frontend/` | 0.2 | ส่วนหน้าบ้าน: React + TypeScript + Vite + Tailwind v4 (+ เพิ่ม job frontend ใน `ci.yml`) |

> ไฟล์/โฟลเดอร์ที่สร้างอัตโนมัติและไม่ขึ้น GitHub (ไม่แสดงในโครงสร้าง): `.env`, `backend/.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`

เมื่อสร้างแล้ว ให้ย้ายรายการจากตารางนี้ขึ้นไปไว้ใน "โครงสร้างปัจจุบัน" พร้อมอธิบายไฟล์ย่อยที่สำคัญ
