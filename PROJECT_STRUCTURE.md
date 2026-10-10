# โครงสร้างโปรเจกต์ — Mangosteen Campus

> เอกสารนี้บอกว่าแต่ละไฟล์/โฟลเดอร์ในโปรเจกต์ใช้เก็บหรือทำหน้าที่อะไร
> **ต้องอัปเดตใน PR เดียวกับที่เพิ่ม/ย้าย/ลบไฟล์หรือโฟลเดอร์สำคัญ** เพื่อให้ตรงกับโครงสร้างจริงเสมอ
>
> อัปเดตล่าสุด: ขั้น 0.6 (ธีมสี/ฟอนต์ + คอมโพเนนต์พื้นฐาน + หน้ารวมตัวอย่าง)

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
│   │   ├── settings.py       ตั้งค่าหลัก: อ่านค่าลับจาก .env, ฐานข้อมูล, เขตเวลา, DRF, ตารางผู้ใช้ (AUTH_USER_MODEL)
│   │   ├── urls.py           รวมเส้นทาง URL ทั้งหมด (/admin/, /api/health/, /api/v1/, 404 แบบ JSON ของ /api/)
│   │   ├── wsgi.py           จุดเริ่มต้นเมื่อรันบนเซิร์ฟเวอร์แบบ WSGI
│   │   └── asgi.py           จุดเริ่มต้นเมื่อรันบนเซิร์ฟเวอร์แบบ ASGI
│   ├── accounts/             app บัญชีผู้ใช้และการเข้าสู่ระบบ (ก้อน 1)
│   │   ├── models.py         ตาราง User (อีเมล/รหัส/บทบาท/ระงับ/รูปประจำตัว) + ตัวช่วยสร้างผู้ใช้ (UserManager)
│   │   ├── admin.py          หน้าจัดการผู้ใช้ใน /admin/ (ค้นหา/กรอง/เพิ่ม/แก้ — สำหรับนักพัฒนา)
│   │   ├── apps.py           ข้อมูลประจำ app
│   │   ├── migrations/       ไฟล์สร้าง/เปลี่ยนโครงสร้างตาราง User (Django สร้างให้)
│   │   ├── management/commands/
│   │   │   └── seed_dev_users.py  คำสั่งสร้างบัญชีทดลอง 3 บทบาท (เฉพาะโหมดพัฒนา, ข้อมูลสมมติ)
│   │   └── tests/
│   │       ├── test_models.py         test ตาราง User (อีเมลตัวพิมพ์เล็ก, ห้ามซ้ำ, รหัสว่าง, ระงับบัญชี ฯลฯ)
│   │       ├── test_admin.py          test หน้า /admin/ (login ด้วยอีเมล, หน้ารายชื่อ/เพิ่ม/แก้)
│   │       └── test_seed_dev_users.py test คำสั่งสร้างบัญชีทดลอง (ครบ 3 บทบาท, รันซ้ำ, รีเซ็ตรหัส, ปฏิเสธบนเว็บจริง)
│   └── common/               app ของใช้ร่วมกันทุก app
│       ├── models.py         TimeStampedModel — ต้นแบบที่เพิ่ม created_at / updated_at ให้ทุกตาราง
│       ├── views.py          GET /api/health/ (ตรวจสุขภาพระบบ) + 404 แบบ JSON ของที่อยู่ API ที่ไม่มีจริง
│       ├── exceptions.py     รูปแบบ error กลาง {code, detail, fields} + ApiError (error เฉพาะเรื่อง) — ดู docs/api.md
│       ├── apps.py           ข้อมูลประจำ app
│       ├── migrations/       ไฟล์เปลี่ยนโครงสร้างฐานข้อมูลของ app นี้ (ยังว่าง)
│       └── tests/
│           ├── test_health.py      test ของ /api/health/ (ปกติ / ฐานข้อมูลล่ม / ส่ง method ผิด)
│           ├── test_exceptions.py  test รูปแบบ error ทุกชนิด (กรอกผิด / ไม่พบ / ไม่มีสิทธิ์ / ApiError / บั๊ก 500)
│           ├── test_api_routing.py test 404 แบบ JSON ของ /api/ และการตั้งค่า CORS
│           └── error_views.py      view ตัวอย่างที่ใช้ใน test เท่านั้น (ไม่อยู่ในระบบจริง)
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
│   │   └── favicon.svg       ไอคอนบนแท็บเบราว์เซอร์: ตรากลีบเลี้ยงมังคุด (รูปทรงเดียวกับ Logo.tsx)
│   └── src/                  โค้ดของแอป
│       ├── main.tsx          จุดเริ่มต้น: เปิดระบบข้อความ แล้ววาด <Root /> ลงในหน้า HTML
│       ├── Root.tsx          เลือกหน้าตามที่อยู่ (ชั่วคราว จนมี router ในก้อน 1): /dev/components → หน้ารวมตัวอย่าง, อื่น ๆ → App
│       ├── index.css         CSS หลัก: โหลด Tailwind + ธีมของระบบ (@theme: สี 20 ค่า, ฟอนต์, มุมโค้ง — ตรงกับ canvas)
│       ├── App.tsx           หน้าทดสอบชั่วคราว: โลโก้ + ป้ายสถานะภาษาไทย + JSON จาก /api/health/ (ใช้ธีมจริง)
│       ├── App.test.tsx      test ของหน้าทดสอบ (กำลังตรวจ / ปกติ / ฐานข้อมูลไม่พร้อม / ติดต่อไม่ได้ / ไม่ใช่ JSON)
│       ├── api/              การเรียก backend
│       │   ├── client.ts     apiFetch(): ตัวเรียก API กลาง (/api/v1/...) โยน ApiError รูปแบบเดียวกันทุกกรณี
│       │   ├── client.test.ts  test ของ apiFetch (สำเร็จ / error ทุกแบบ / ติดต่อไม่ได้ / ไม่ใช่ JSON)
│       │   ├── errors.ts     errorMessage() / fieldErrorMessage(): แปลงรหัส error เป็นข้อความไทยจาก th.ts
│       │   ├── errors.test.ts  test ของการแปลงรหัส error (รู้จัก / ไม่รู้จัก → ข้อความสำรอง)
│       │   └── health.ts     ฟังก์ชันเรียก GET /api/health/ (คืนผลเสมอ ไม่โยน error)
│       ├── i18n/             ระบบข้อความบนหน้าจอ (i18next — ภาษาไทยภาษาเดียว)
│       │   ├── index.ts      ตั้งค่าระบบข้อความ (import ครั้งเดียวใน main.tsx)
│       │   ├── i18next.d.ts  ให้ TypeScript ตรวจรหัสข้อความที่เรียกใน t(...)
│       │   ├── i18n.test.ts  test: ใช้ภาษาไทย และไม่มีข้อความว่าง
│       │   └── locales/
│       │       └── th.ts     ข้อความบนหน้าจอทุกตัว (แก้/เพิ่มข้อความที่ไฟล์นี้)
│       ├── components/
│       │   └── ui/           คอมโพเนนต์พื้นฐาน (หน้าตาตาม canvas) — import จาก components/ui
│       │       ├── index.ts        รวม export ทุกชิ้น
│       │       ├── Button.tsx      ปุ่ม: primary / secondary / text / danger-text
│       │       ├── TextField.tsx   ช่องกรอก + ป้ายชื่อ + ข้อความ error (ขอบแดง, role=alert)
│       │       ├── Card.tsx        การ์ดพื้นขาว ขอบ line มุม 14px
│       │       ├── StatusBadge.tsx ป้ายสถานะวงรี: warn / ok / bad / mute
│       │       ├── Logo.tsx        ตรากลีบเลี้ยงมังคุด (+ ชื่อระบบ) — รูปทรงตาม board BrandLogo
│       │       └── ui.test.tsx     test ของคอมโพเนนต์ทั้ง 5 (พฤติกรรม + การเข้าถึง)
│       ├── dev/
│       │   └── ComponentGallery.tsx  หน้ารวมตัวอย่าง /dev/components (เฉพาะโหมดพัฒนา ไม่อยู่ในไฟล์ที่ deploy)
│       ├── lib/              ฟังก์ชันช่วยที่ใช้ร่วมกันทั้งแอป
│       │   ├── datetime.ts   formatDateTime(): แสดงวันที่แบบ "25 ก.ค. 2569 23:59" (เวลาไทยเสมอ)
│       │   └── datetime.test.ts  test ของการแสดงวันที่ (พ.ศ., ข้ามวัน, ข้ามปี, เติม 0)
│       └── test/
│           └── setup.ts      ไฟล์เตรียมความพร้อมที่ Vitest รันก่อน test ทุกไฟล์
│
└── docs/                     เอกสารออกแบบระบบ
    ├── database.md           สเปกฐานข้อมูลเต็ม: 20 ตาราง, field, constraint, สูตรคะแนน,
    │                         บันทึกการตัดสินใจ (§11) และสิ่งที่ไม่ทำใน MVP (§13)
    ├── database-guide.md     ใครเขียน/ใครอ่านแต่ละตาราง, state machine, workflow W1–W15,
    │                         การดึงข้อมูลตามหน้าจอ
    ├── database-fields.md    คำอธิบายสั้นราย field ของทุกตาราง (quick reference)
    ├── database-erd.md       แผนภาพความสัมพันธ์ระหว่างตาราง (ERD) แบบ Mermaid แยก 6 กลุ่ม
    └── api.md                มาตรฐาน API: ที่อยู่ /api/v1/, รูปแบบ error กลาง, ตารางรหัส error, CORS
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
