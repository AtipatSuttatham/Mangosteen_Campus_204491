# โครงสร้างโปรเจกต์ — Mangosteen Campus

> เอกสารนี้บอกว่าแต่ละไฟล์/โฟลเดอร์ในโปรเจกต์ใช้เก็บหรือทำหน้าที่อะไร
> **ต้องอัปเดตใน PR เดียวกับที่เพิ่ม/ย้าย/ลบไฟล์หรือโฟลเดอร์สำคัญ** เพื่อให้ตรงกับโครงสร้างจริงเสมอ
>
> อัปเดตล่าสุด: ขั้น 0.2 (frontend + CI ฝั่ง frontend)

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
│       └── ci.yml            CI บน GitHub Actions — 2 job รันพร้อมกัน:
│                             backend (ruff + Django check + pytest บน PostgreSQL จริง)
│                             frontend (tsc + eslint + vitest)
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
├── frontend/                 ส่วนหน้าบ้าน: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (จัดการแพ็กเกจด้วย pnpm)
│   ├── index.html            หน้า HTML หลัก — React วาดหน้าจอทั้งหมดลงใน <div id="root">
│   ├── package.json          รายการแพ็กเกจ + คำสั่งที่ใช้บ่อย (ดูตารางคำสั่งด้านล่าง) + ล็อกรุ่น pnpm
│   ├── pnpm-lock.yaml        ล็อกเวอร์ชันแพ็กเกจทุกตัว — pnpm สร้างให้ ห้ามแก้มือ
│   ├── vite.config.ts        ตั้งค่า Vite: พอร์ต 5180, ส่งต่อ /api ไป backend (8008), Tailwind, ตั้งค่า Vitest
│   ├── eslint.config.js      ตั้งค่า ESLint (ตรวจคุณภาพโค้ด TypeScript/React)
│   ├── tsconfig.json         ไฟล์รวมที่ชี้ไปตั้งค่า TypeScript 2 ชุดด้านล่าง
│   ├── tsconfig.app.json     ตั้งค่า TypeScript ของโค้ดแอป (src/) — โหมดเข้มงวด
│   ├── tsconfig.node.json    ตั้งค่า TypeScript ของไฟล์ตั้งค่าที่รันบน Node.js (vite.config.ts)
│   ├── public/
│   │   └── favicon.svg       ไอคอนบนแท็บเบราว์เซอร์ (ชั่วคราว — เปลี่ยนเป็นโลโก้ในขั้น 0.6)
│   └── src/                  โค้ดของแอป
│       ├── main.tsx          จุดเริ่มต้น: วาด <App /> ลงในหน้า HTML
│       ├── index.css         CSS หลัก: โหลด Tailwind (ค่าสี/ฟอนต์ของ wireframe เพิ่มในขั้น 0.6)
│       ├── App.tsx           หน้าทดสอบชั่วคราว: วงกลมสถานะ + JSON จาก /api/health/ (ไม่มีข้อความ UI — รอระบบแปลภาษาขั้น 0.4)
│       ├── App.test.tsx      test ของหน้าทดสอบ (กำลังโหลด / ปกติ / backend ตอบ 503 / ติดต่อ backend ไม่ได้)
│       ├── api/
│       │   └── health.ts     ฟังก์ชันเรียก GET /api/health/ (คืนผลเสมอ ไม่โยน error)
│       └── test/
│           └── setup.ts      ไฟล์เตรียมความพร้อมที่ Vitest รันก่อน test ทุกไฟล์
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

## คำสั่งใน `frontend/package.json`

ไฟล์ JSON ใส่ comment ไม่ได้ จึงอธิบายคำสั่งไว้ที่นี่ (รันด้วย `pnpm <ชื่อคำสั่ง>` ในโฟลเดอร์ `frontend/`)

| คำสั่ง | ทำอะไร |
|---|---|
| `pnpm dev` | เปิดเซิร์ฟเวอร์พัฒนาที่ http://localhost:5180 (แก้โค้ดแล้วหน้าจอเปลี่ยนทันที) |
| `pnpm build` | ตรวจชนิดข้อมูล แล้วสร้างไฟล์สำหรับใช้งานจริงลง `dist/` |
| `pnpm typecheck` | ตรวจชนิดข้อมูล TypeScript (`tsc -b` — ตรวจอย่างเดียว ไม่สร้างไฟล์) |
| `pnpm lint` | ตรวจคุณภาพโค้ดด้วย ESLint |
| `pnpm test` | รัน test ทั้งหมด 1 รอบ (Vitest) |
| `pnpm test:watch` | รัน test ค้างไว้ แก้โค้ดแล้ว test รันใหม่อัตโนมัติ |
| `pnpm preview` | เปิดดูผลลัพธ์จาก `pnpm build` ในเครื่อง |

## โครงสร้างที่จะเพิ่มในขั้นถัดไป (ยังไม่มีจริง)

ยังไม่มีรายการที่วางแผนไว้แน่นอน — โฟลเดอร์ของแต่ละฟีเจอร์จะเพิ่มตามแผนงานใน [`PROJECT_SCOPE.md`](PROJECT_SCOPE.md)

> ไฟล์/โฟลเดอร์ที่สร้างอัตโนมัติและไม่ขึ้น GitHub (ไม่แสดงในโครงสร้าง): `.env`, `backend/.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `frontend/node_modules/`, `frontend/dist/`

เมื่อสร้างแล้ว ให้ย้ายรายการจากตารางนี้ขึ้นไปไว้ใน "โครงสร้างปัจจุบัน" พร้อมอธิบายไฟล์ย่อยที่สำคัญ
