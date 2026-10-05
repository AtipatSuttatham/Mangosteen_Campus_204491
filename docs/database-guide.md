# คู่มือการใช้งานฐานข้อมูล — LMS (v2.1)

> เอกสารนี้ตอบว่า **แต่ละตารางใช้ทำอะไร ใครเขียน ใครอ่าน เชื่อมกับอะไร และ workflow ครบวงจรเป็นยังไง**
> ยึดตามรายงานบทที่ 1–5 (บทที่ 3 = ยูสเคส UC-01–UC-19, บทที่ 4 = ตาราง, บทที่ 5 = หน้าจอ) — ถ้าขัดกัน ให้ยึดรายงาน
> ใช้คู่กับ:
> - [`database.md`](./database.md) — สเปกเต็ม (field, type, constraint, ความสัมพันธ์)
> - [`database-erd.md`](./database-erd.md) — ERD (Mermaid)
> - [`database-fields.md`](./database-fields.md) — คำอธิบายสั้นราย field
>
> สำหรับ session/คนที่เพิ่งเข้ามา: **อ่าน `CLAUDE.md` ก่อน** (บริบทโปรเจกต์ + tech stack) แล้วค่อยอ่านไฟล์นี้

---

## 0. สถาปัตยกรรมโดยรวม (ต้องเข้าใจก่อน)

- **Backend**: Django 5.2 + DRF + Simple JWT, PostgreSQL. **Frontend**: React + Vite + TypeScript + Tailwind CSS (SPA แยก origin). ชื่อระบบ: **Mangosteen Campus**
- **ทิศทางข้อมูล**: frontend เรียก REST API → DRF serializer/viewset → service layer → model. **ไม่มี** business logic ใน frontend
- **กลไกอัตโนมัติที่ต้องรู้**:
  1. **`Auditable` / `log_action`** — เหตุการณ์สำคัญเขียน `AuditLog` อัตโนมัติ (ขอบเขตตาม §1 audit)
  2. **สร้าง `GradeItem` อัตโนมัติ** — Quiz/Assignment ที่ `is_graded=True` เผยแพร่ครั้งแรก
  3. **signal sync คะแนน** — `QuizAttempt` / `Submission` ที่ `graded` → เขียน `Score`
  4. **คะแนนรวมคำนวณสด** จาก `Score` ทุกครั้งที่แสดงผล (ไม่มีตาราง cache)
- **ไม่มี soft delete** — ของที่มีข้อมูลผู้เรียนลบไม่ได้ ใช้ยกเลิกเผยแพร่ / ระงับ / ปิดรายวิชาแทน
- **Timezone**: เก็บ UTC, แสดง/เทียบ "ส่งช้า" ใน `Asia/Bangkok`
- **ภาษา**: field เดียว (ไม่แยก `_th/_en`) ; i18n = UI chrome ฝั่ง frontend

### role ระดับระบบ vs ระดับรายวิชา

| | เก็บที่ | ตอบคำถาม |
|---|---|---|
| **ระดับระบบ** | `User.role` (`admin`/`teacher`/`student`) | เข้าเมนูผู้ดูแลระบบได้ไหม, สร้างรายวิชาได้ไหม, เห็น AuditLog ไหม |
| **ระดับรายวิชา** | `Course.teacher` (ผู้สอนคนเดียว) + `Enrollment` (ผู้เรียน) | จัดการวิชา X ได้ไหม, เห็นคะแนนวิชา X ไหม, ส่งงานวิชา X ได้ไหม |

→ permission check ทำ**ต่อวิชา** ; ผู้ดูแลระบบจัดการรายวิชา/การลงทะเบียน**แทนผู้สอน**ได้ (UC-07, UC-08) แต่จัดการเนื้อหา/แบบทดสอบ/คะแนนไม่ได้ (ตาราง 3.1)

### สิทธิ์ตามบทบาท (รายงานตาราง 3.1)

| ฟังก์ชัน | admin | teacher | student |
|---|---|---|---|
| เข้า/ออกจากระบบ, ข้อมูลส่วนตัว, หน้าภาพรวม | ✓ | ✓ | ✓ |
| จัดการบัญชีผู้ใช้, จำลองมุมมอง, ประวัติการใช้งาน | ✓ | - | - |
| จัดการรายวิชา, จัดการการลงทะเบียน | ✓ | ✓ | - |
| เนื้อหา, แบบทดสอบ, ชิ้นงาน, ตรวจ/คะแนน, ประกาศ | - | ✓ | - |
| เข้าร่วมด้วยรหัส/ดูเนื้อหา, ทำแบบทดสอบ, ส่งงาน, ดูคะแนนตนเอง | - | - | ✓ |
| ดูประกาศ | - | ✓ | ✓ |

### gradebook pipeline

```
Quiz/Assignment --เผยแพร่ (is_graded)--> GradeItem --(ผู้เรียนทำ + ตรวจ)--> Score --คำนวณสด--> คะแนนรวม % (ไม่เก็บ)
   (ผู้สอนสร้าง)        สร้างอัตโนมัติ        (1 คอลัมน์)      sync เขียน          ต่อหมวด + ถ่วงน้ำหนัก
```

---

## 1. คำอธิบายราย table

รูปแบบ: **หน้าที่ · ใครเขียน · ใครอ่าน · lifecycle/invariant · เชื่อมกับ**

---

### 📁 accounts

#### `User`
- **หน้าที่**: บัญชีผู้ใช้ทุกคน (admin/teacher/student) — 1 ตารางรวมทุก role
- **เขียนโดย**:
  - ผู้ดูแลระบบ (UC-04) → สร้างบัญชี (กำหนด `role`, `student_or_staff_id`, `created_by=<admin>`), แก้ไข, ระงับ (`is_active=False`) / เปิดใช้งาน
  - ตัวผู้ใช้เอง (UC-02) → แก้ชื่อ-นามสกุล อีเมล รูปประจำตัว รหัสผ่าน
- **อ่านโดย**: login, JWT serializer (`role` ใน token), ทุก serializer ที่แสดงชื่อคน, permission layer
- **lifecycle**: ผู้ดูแลระบบสร้าง → ใช้งาน → ระงับ ↔ เปิดใช้งาน. **ไม่ลบจริง**
- **invariant**: **ไม่มีการสมัครเอง** ; email และ `student_or_staff_id` ห้ามซ้ำ ; บัญชีที่ถูกระงับ login ไม่ได้และคำร้องขอค้างถูกปฏิเสธทันที
- **เชื่อมกับ**: `Course.teacher`, `Enrollment.student`, `QuizAttempt`/`Submission`/`Score.student`, `Announcement.author`, `AuditLog.actor`, `created_by`/`graded_by`/`enrolled_by`

---

### 📁 academics

#### `Course`
- **หน้าที่**: รายวิชา 1 ตัวใน 1 ภาคการศึกษา (ปีการศึกษา + ภาคเรียนเก็บในแถวนี้) — วิชาเดิมเปิดใหม่คนละภาค = คนละแถว
- **เขียนโดย**: ผู้สอน หรือผู้ดูแลระบบที่ทำแทน (UC-07) — สร้าง, แก้ข้อมูล, เผยแพร่, เปิด/ปิดรหัสเข้าร่วม + สร้างรหัสใหม่ (UC-08), **ปิดรายวิชา**
- **อ่านโดย**: หน้า "รายวิชาของฉัน" (จัดกลุ่มตามปีการศึกษา/ภาคเรียน, ป้ายยังไม่เผยแพร่/ปิดแล้ว), ทุกหน้าในวิชา, permission layer
- **lifecycle**: draft (`is_published=False`) → เผยแพร่ → **ปิด (`is_closed=True`)** = ผู้เรียนดูย้อนหลังอย่างเดียว
- **invariant**: `(academic_year, semester, code)` unique — ไม่ซ้ำภายในภาคเดียวกัน ; `join_code` ไม่ซ้ำ สุ่มแยกจากรหัสวิชา ; 1 วิชามีผู้สอนคนเดียว (`teacher`) — ผู้สอนสร้างเอง = ตัวเอง, admin สร้างแทน = ต้องเลือกผู้สอน (`role=teacher`), **เปลี่ยน `teacher` ได้เฉพาะ admin**
- **เชื่อมกับ**: `User` (teacher), `Enrollment`/`Module`/`Quiz`/`Assignment`/`GradingCategory`/`GradeItem`/`Announcement` (ลูก)

---

### 📁 content

#### `Module`
- **หน้าที่**: หน่วยการเรียน — กล่องจัดกลุ่ม `Content` ในวิชา
- **เขียนโดย**: ผู้สอน (สร้าง, แก้ชื่อ, จัดลำดับ `order`, เผยแพร่) (UC-09)
- **อ่านโดย**: แท็บ "เนื้อหา" (accordion — ผู้เรียนเห็นเฉพาะ `is_published=True`)
- **เชื่อมกับ**: `Course` (CASCADE), `Content` (ลูก), `Quiz`/`Assignment` (ผูกได้ ไม่บังคับ)

#### `Content`
- **หน้าที่**: เนื้อหา 1 ชิ้น — ข้อความ / ไฟล์ / รูป / วิดีโอ / เสียง / ลิงก์ (`content_type`)
- **เขียนโดย**: ผู้สอน — อัปโหลดไฟล์ผ่าน backend ไปบริการจัดเก็บไฟล์ภายนอก แล้วเก็บ URL ; ชนิด/ขนาดไม่ผ่าน หรืออัปโหลดล้มเหลว → ไม่บันทึก
- **อ่านโดย**: หน้าเรียนของผู้เรียน (กรอง `is_published`)
- **field ตามชนิด**: `text` → `body` ; `file`/`image`/`audio`/`video` (อัปโหลด) → `file_url` + metadata ; `link` / `video` จาก YouTube → `external_url`
- **invariant**: 1 Content = 1 ไฟล์หลัก

---

### 📁 enrollment

#### `Enrollment` (ตารางเชื่อม Course ↔ User ผู้เรียน)
- **หน้าที่**: ผู้เรียน 1 คน ลงทะเบียนวิชา 1 ตัว + สถานะ
- **เขียนโดย**:
  - ผู้สอน/ผู้ดูแลระบบ เพิ่มรายชื่อ (UC-08) → `status=active`, `enrolled_by=<คนเพิ่ม>`
  - ผู้เรียน กรอก `join_code` (UC-15) → `status=active`, `enrolled_by=NULL`
  - ผู้สอน/ผู้ดูแลระบบ ถอน → `status=dropped`, `dropped_at`
- **อ่านโดย**: permission layer, รายชื่อผู้เรียน (แท็บ "ผู้เรียน"), สมุดคะแนน (แถว), หน้าภาพรวมผู้เรียน
- **lifecycle**: `active` ↔ `dropped` (เข้าร่วมใหม่ = อัปเดตแถวเดิม คงคะแนน)
- **invariant**: `(course, student)` unique ; ผู้เรียนที่ `dropped` เข้าถึงรายวิชาไม่ได้ แต่คะแนนยังอยู่

---

### 📁 assessments (Quiz)

#### `Quiz`
- **หน้าที่**: แบบทดสอบ 1 ชุด + เงื่อนไขการทำ (จับเวลา, จำนวนครั้ง, ช่วงเวลา)
- **เขียนโดย**: ผู้สอน (UC-10)
- **อ่านโดย**: หน้าทำแบบทดสอบ, หน้าจัดการ, ตัวสร้าง GradeItem
- **lifecycle**: draft → **เผยแพร่** (`is_graded` → สร้าง `GradeItem`) → มีคนทำ → **จำกัดการแก้ไข** → ผู้สอนตรวจอัตนัย → ปิด (`available_until` ผ่าน)
- **field สำคัญ**: `time_limit_minutes` null = ไม่จับเวลา ; `max_attempts` 1 = ครั้งเดียว, > 1 / null = หลายครั้งเก็บสูงสุด
- **invariant**: คะแนนเต็ม = Σ `Question.points` ; ลบได้เฉพาะที่ไม่เคยเผยแพร่ — เคยเผยแพร่แล้ว → ลบไม่ได้ (ยกเลิกเผยแพร่แทน) ; มีคนทำแล้ว → แก้ได้เฉพาะส่วนที่ไม่กระทบผลเดิม

#### `Question`
- **หน้าที่**: คำถาม 1 ข้อ — 5 ชนิด
- **field ตามชนิด**:
  - `mcq` (4 ตัวเลือก) / `true_false` → `Choice`
  - `dropdown` → `text` มีช่องว่าง `[1]`, `[2]`… + `Choice` แยกตาม `blank_no` (ถูก 1 ตัวต่อช่อง)
  - `matching` → `MatchingPair`
  - `short_answer` → ผู้สอนตรวจเองเสมอ
- **เชื่อมกับ**: `Answer.question` = PROTECT

#### `Choice` / `MatchingPair`
- `Choice` — ตัวเลือก + `is_correct` ; หน้าทำแบบทดสอบซ่อน `is_correct` ; คำถามปรนัยต้องมีคำตอบที่ถูกก่อนบันทึก
- `MatchingPair` — คู่ที่ถูก ; ตอนทำระบบสลับฝั่งขวา ; คะแนน = `points × คู่ถูก/คู่ทั้งหมด`

#### `QuizAttempt`
- **หน้าที่**: การเข้าทำ 1 ครั้งของผู้เรียน 1 คน + สถานะ + คะแนนรวม
- **เขียนโดย**:
  - ผู้เรียน "เริ่มทำ" → `in_progress`, `started_at`=server now, `due_at`=snapshot
  - ผู้เรียนส่ง หรือหมดเวลา → `submitted` / `auto_submitted`, `submitted_at`
  - ตัวตรวจอัตโนมัติ → ถ้าไม่มีอัตนัย → `graded`, `score`
  - ผู้สอน (ตรวจอัตนัยครบ) → `graded`, `graded_by`, `graded_at`
- **อ่านโดย**: หน้าผลของผู้เรียน, signal sync → `Score`
- **lifecycle**: `in_progress → submitted|auto_submitted → graded`
- **invariant**: `(quiz, student, attempt_number)` unique ; ทุกการบันทึกคำตอบเช็ค `now() <= due_at`

#### `Answer`
- **หน้าที่**: คำตอบ 1 ข้อ ต่อ 1 attempt — `response` (JSONB)
- **เขียนโดย**: ผู้เรียน (บันทึกเป็นระยะ) ; ตัวตรวจอัตโนมัติ (`is_correct`, `points_awarded`) ; ผู้สอน (อัตนัย: `points_awarded`, `feedback`)
- **รูปแบบ `response`**: `{"choice_id": N}` / `{"blanks": {"1": N, "2": M}}` / `{"pairs": {left_id: right_id}}` / `{"text": "…"}`
- **invariant**: `(attempt, question)` unique ; dropdown `is_correct=True` เมื่อถูกครบทุกช่อง

---

### 📁 assignments

#### `Assignment`
- **หน้าที่**: งานที่มอบหมาย + กำหนดส่ง + การรับงานส่งช้า
- **เขียนโดย**: ผู้สอน (UC-11) — ชื่อ, โจทย์, ไฟล์แนบ, กำหนดส่ง, คะแนนเต็ม, หมวดคะแนน, `late_policy`
- **อ่านโดย**: หน้าส่งงาน (ผู้เรียน), หน้าตรวจงาน (ผู้สอน), ตัวสร้าง GradeItem
- **field สำคัญ**: `due_at` null = ไม่มีกำหนดส่ง ; `late_policy` = `closed_after_due` / `accept_late`
- **การลบ**: ลบได้เฉพาะที่ไม่เคยเผยแพร่ — เคยเผยแพร่แล้ว → ลบไม่ได้ ยกเลิกเผยแพร่แทน

#### `AssignmentAttachment`
- ไฟล์โจทย์ที่ผู้สอนแนบ (หลายไฟล์ได้) — ผู้เรียนดาวน์โหลดในหน้าส่งงาน

#### `Submission`
- **หน้าที่**: งานของผู้เรียน 1 คนต่องาน 1 ชิ้น (**1 ระเบียน**) + คะแนน
- **เขียนโดย**:
  - ผู้เรียน ส่ง (UC-17) → สร้างแถว `status=submitted`, `submitted_at`, `is_late`, `note`
  - ผู้เรียน ส่งไฟล์ใหม่ (ก่อนกำหนดส่ง **และ** ก่อนตรวจ) → แทนที่ `SubmissionFile` เดิม + อัปเดต `submitted_at`
  - ผู้สอน ตรวจ (UC-13) → `score` (หักส่งช้าเอง), `feedback`, `status=graded`, `graded_by`, `graded_at`
- **อ่านโดย**: หน้าสถานะงานของผู้เรียน, หน้าตรวจงาน (กรอง: ทั้งหมด / รอตรวจ / ส่งช้า / ยังไม่ส่ง), signal sync → `Score`
- **lifecycle**: `submitted → graded` (ตรวจแล้วส่งใหม่ไม่ได้)
- **invariant**: `(assignment, student)` unique ; `is_late` เทียบ `due_at` ในเวลาไทย
- **เชื่อมกับ**: `assignment`/`student` = PROTECT

#### `SubmissionFile`
- ไฟล์ที่ผู้เรียนอัปโหลด (หลายไฟล์ได้) — ส่งใหม่ = แทนที่ทั้งชุด

---

### 📁 grading

#### `GradingCategory`
- **หน้าที่**: หมวดคะแนน + น้ำหนัก % (เช่น แบบทดสอบ 30 / งาน 30 / สอบปลายภาค 40)
- **เขียนโดย**: ผู้สอน (UC-12)
- **invariant**: ผลรวม `weight_percent` ≠ 100 → เตือน ไม่บล็อก ; ลบหมวดที่มีช่องคะแนนไม่ได้ (PROTECT)

#### `GradeItem`
- **หน้าที่**: 1 คอลัมน์ในสมุดคะแนน — จาก quiz / assignment / กรอกเอง
- **เขียนโดย**: ระบบ (เผยแพร่ quiz/assignment ที่ `is_graded`) ; ผู้สอน → ปุ่ม "เพิ่มช่องคะแนน" (กรอกเอง เช่น การมีส่วนร่วม, สอบปลายภาค), ย้ายหมวด, จัดลำดับ
- **อ่านโดย**: สมุดคะแนน, สูตรคะแนนรวม
- **field**: ที่มาดูจาก `quiz`/`assignment` (ว่างทั้งคู่ = กรอกเอง) ; `category=NULL` → ไม่นับ
- **เชื่อมกับ**: `quiz`/`assignment`/`category` = PROTECT

#### `Score`
- **หน้าที่**: คะแนนผู้เรียน 1 คน ต่อ 1 `GradeItem`
- **เขียนโดย**: signal sync (attempt/submission ที่ graded) ; ผู้สอนกรอกช่องกรอกเอง (`raw_score`) ; ผู้สอนปรับแก้ (`adjusted_score` — sync ไม่ทับ)
- **อ่านโดย**: สมุดคะแนน, หน้าคะแนนผู้เรียน (เห็นทันทีที่บันทึก), สูตรคะแนนรวม
- **invariant**: `(grade_item, student)` unique ; ห้ามเกิน `max_score` ; คะแนนที่ใช้ = `adjusted_score` ?? `raw_score` ; ไม่มีทั้งคู่ = "ยังไม่มีคะแนน" → **ไม่นับในคะแนนรวม**

---

### 📁 announcements

#### `Announcement`
- **หน้าที่**: ประกาศในวิชา
- **เขียนโดย**: ผู้สอน — สร้าง (หัวข้อ + เนื้อหาบังคับ), เผยแพร่ (`published_at`), แก้ไข, **ลบ** (UC-14)
- **อ่านโดย**: แท็บ "ประกาศ" (เรียงล่าสุดก่อน) + หน้าภาพรวมผู้เรียน (ประกาศล่าสุด) (UC-19)
- **หมายเหตุ**: ไม่มีสถานะอ่าน/ยังไม่อ่าน และไม่มีแจ้งเตือนรายบุคคลใน MVP

---

### 📁 audit

#### `AuditLog`
- **หน้าที่**: บันทึกเหตุการณ์สำคัญ — generic log (`content_type` + `object_id`)
- **เขียนโดย** (อัตโนมัติ / `log_action()` ใน service layer):
  - จัดการบัญชีผู้ใช้ → `create` / `update`
  - สร้าง/แก้ไข/ปิดรายวิชา → `create` / `update` / `close_course`
  - ลงทะเบียน/ถอนผู้เรียน → `enroll` / `unenroll`
  - บันทึก/แก้ไขคะแนน → `grade`
  - เริ่ม/สิ้นสุดจำลองมุมมอง → `impersonate_start` / `impersonate_end` (`changes=null`)
  - ลบข้อมูลจริง (Quiz, Assignment, Module, Content, Announcement, GradingCategory, GradeItem กรอกเอง) → `delete`
  - ผู้ดูแลระบบทำแทนผู้สอน → `actor` = ผู้ดูแลระบบ
- **อ่านโดย**: ผู้ดูแลระบบเท่านั้น (UC-06) — กรองช่วงวันที่ / ข้อมูลที่เกี่ยวข้อง / การกระทำ ; แสดงค่าเดิม-ค่าใหม่
- **field**: มีเฉพาะ `created_at` (ไม่มี `updated_at`)

---

## 2. State machines

### `Enrollment.status`
```
   ผู้สอน/admin เพิ่ม  หรือ  ผู้เรียนใส่รหัสเข้าร่วม
                    │
                    ▼
                 active ──── ผู้สอน/admin ถอน ───► dropped
                    ▲                                 │
                    └── เพิ่มกลับ / ใส่รหัสใหม่ (แถวเดิม) ─┘
```

### `QuizAttempt.status`
```
in_progress ──► submitted ────────┐
     │                            ├──► graded
     └──► auto_submitted (หมดเวลา)─┘
```
- → `graded` เมื่อไม่มีอัตนัย (ตรวจอัตโนมัติจบเลย) **หรือ** ผู้สอนตรวจอัตนัยครบ

### `Submission.status`
```
(ยังไม่มีแถว) ──ส่ง──► submitted ──ผู้สอนตรวจ──► graded
                          │  ▲
                          └──┘ ส่งไฟล์ใหม่ (ก่อนกำหนดส่ง + ก่อนตรวจ) แทนที่ไฟล์เดิม
```

### Course
```
is_published=False ──► True (ผู้เรียนเห็น) ──► is_closed=True (ดูย้อนหลังอย่างเดียว)
```

### publish lifecycle (Module / Content / Quiz / Assignment / Announcement)
```
is_published = False (draft)  ──► True (ผู้เรียนเห็น)  ──► False (ซ่อนกลับ ไม่ลบข้อมูล)
```
- Quiz/Assignment เผยแพร่ครั้งแรก + `is_graded=True` → สร้าง `GradeItem` (ยกเลิกเผยแพร่ไม่ลบ GradeItem)

---

## 3. Workflow ครบวงจร

### W1 — เข้าสู่ระบบ / ออกจากระบบ (UC-01)
1. ผู้ใช้กรอก **อีเมล หรือ รหัสนักศึกษา/รหัสพนักงาน** + รหัสผ่าน → `POST /auth/login`
2. ตรวจกับ `User` ; ผิด → ข้อความรวม "รหัสหรืออีเมล หรือรหัสผ่านไม่ถูกต้อง" (ไม่บอกว่าช่องไหนผิด) ; `is_active=False` → แจ้งว่าเข้าสู่ระบบไม่ได้
3. ออก Access + Refresh Token (มี `role`) → เข้าหน้าภาพรวมตามบทบาท
4. ออกจากระบบ → blacklist Refresh Token (`token_blacklist`) + ลบ token ฝั่ง client
> ไม่มีหน้าสมัครใช้งาน

### W2 — ผู้ดูแลระบบจัดการบัญชี (UC-04)
1. `POST /admin/users` → `User(role=…, student_or_staff_id=…, created_by=<admin>)` + **รหัสผ่านชั่วคราวที่ผู้ดูแลระบบตั้ง** (แจ้งผู้ใช้เอง) ; อีเมล/รหัสซ้ำ → ไม่บันทึก
   - **นำเข้าจาก CSV** → สร้างทีละแถวด้วยกติกาเดียวกัน ; แถวที่ผิด/ซ้ำ → รายงานกลับเป็นรายแถว
2. แก้ไข / ระงับ (`is_active=False`) / เปิดใช้งาน / **รีเซ็ตรหัสผ่าน** (กรณีผู้ใช้ลืม)
3. → `AuditLog(action=create|update, actor=<admin>)`

### W3 — สร้างรายวิชา (UC-07)
1. ผู้สอน (หรือ admin ทำแทน) → `POST /courses` (academic_year, semester, code, name, description) → `Course(teacher=<ผู้สอน>, is_published=False, created_by=<ผู้สร้าง>)` — ผู้สอนสร้างเอง: `teacher` = ตัวเอง ; admin สร้างแทน: ต้องเลือกผู้สอนจากบัญชี `role=teacher` ; `code` ซ้ำกับวิชาอื่นในภาคเดียวกัน → แจ้งให้กำหนดใหม่
   - เปลี่ยนผู้สอนภายหลัง → admin เท่านั้น → `AuditLog(action=update)`
2. → `AuditLog(action=create)`
3. เปิดรหัสเข้าร่วม → `join_code_enabled=True` + สุ่ม `join_code` (สร้างใหม่ได้)
4. เผยแพร่ → `is_published=True`
5. ปิดรายวิชา → `is_closed=True` → `AuditLog(action=close_course)`

### W4 — ผู้สอนเพิ่มผู้เรียน (UC-08)
1. แท็บ "ผู้เรียน" → เพิ่มรายชื่อ → `POST /courses/{id}/enrollments`
2. ต่อคน: ไม่มีแถว → `Enrollment(active, enrolled_by=<ผู้สอน>)` ; มีแถว `dropped` → กลับเป็น `active` ; `active` อยู่แล้ว → ข้าม
3. → `AuditLog(action=enroll)` ; ถอน → `dropped` + `AuditLog(action=unenroll)`

### W5 — ผู้เรียนเข้าร่วมด้วยรหัส (UC-15)
1. `POST /enroll` (join_code) → หา `Course` → เช็ค `join_code_enabled`, `is_published`, ไม่ `is_closed` ; ไม่ผ่าน → แจ้งเตือน
2. → `Enrollment(active, enrolled_by=NULL)` (หรือเปิดแถวเดิมที่ `dropped` กลับ คงคะแนน) → `AuditLog(action=enroll)`

### W6 — สร้างเนื้อหา (UC-09)
1. `POST /courses/{id}/modules` → `Module(order=next, is_published=False)`
2. `POST /modules/{id}/contents` → อัปโหลดไฟล์ผ่าน backend → บริการจัดเก็บไฟล์ภายนอก → เก็บ `file_url` (หรือใส่ `external_url` สำหรับลิงก์/YouTube)
3. อัปโหลดล้มเหลว → ไม่บันทึก ให้อัปโหลดใหม่ ; เผยแพร่ → ผู้เรียนเห็น

### W7 — สร้าง + เผยแพร่แบบทดสอบ → GradeItem (UC-10)
1. `POST /courses/{id}/quizzes` → `Quiz(is_published=False, is_graded=True)` + หมวดคะแนน
2. เพิ่ม `Question` + `Choice` (dropdown: ตาม `blank_no`) / `MatchingPair` ; ตั้ง `time_limit_minutes`, `max_attempts`, ช่วงเวลา
3. เผยแพร่ → `is_published=True` → ถ้า `is_graded` → สร้าง `GradeItem(quiz=<quiz>, max_score=Σpoints, category=<quiz.grading_category>)`

### W8 — ผู้เรียนทำแบบทดสอบจับเวลา → ตรวจ → Score (UC-16)
1. "เริ่มทำ" → เช็คช่วงเวลา + จำนวนครั้ง → `QuizAttempt(in_progress, started_at=now, due_at=min(now+limit, available_until))`
2. ตอบ → บันทึก `Answer.response` เป็นระยะ — ทุกครั้งเช็ค `now() <= due_at`
3. กด "ส่งคำตอบทั้งหมด" **หรือ** หมดเวลา → `submitted` / `auto_submitted` (แก้คำตอบไม่ได้อีก)
4. ตรวจอัตโนมัติ: mcq/true_false เทียบ `is_correct` ; dropdown/matching คิดตามสัดส่วน ; short_answer รอผู้สอน (`is_correct=NULL`)
5. ไม่มีอัตนัย → `score = Σ points_awarded`, `status=graded`
6. **sync** → `Score(raw_score=<score>, source_attempt=<attempt>)` (หลายครั้ง → เอาสูงสุด)

### W9 — ผู้สอนตรวจอัตนัย (UC-13)
1. หน้าตรวจ → `Answer` ที่ `is_correct=NULL` → ให้ `points_awarded`, `feedback`
2. ครบทุกข้อ → `QuizAttempt.score` รวมใหม่, `graded`, `graded_by`, `graded_at` → sync `Score` → `AuditLog(action=grade)`

### W10 — ผู้เรียนส่งงาน (UC-17)
1. หน้าส่งงาน → ลากวางไฟล์ + หมายเหตุ → "ส่งงาน"
2. `due_at` ไม่ null และ `now > due_at`: `closed_after_due` → ปฏิเสธ ; `accept_late` → รับ, `is_late=True`
3. → `Submission(submitted, submitted_at=now, note)` + `SubmissionFile` (ไฟล์ไปบริการภายนอก)
4. ส่งใหม่ก่อนกำหนดส่งและก่อนตรวจ → แทนที่ไฟล์เดิมในแถวเดิม + อัปเดต `submitted_at`

### W11 — ผู้สอนตรวจงาน → Score (UC-13)
1. แท็บ "งานและแบบทดสอบ" → กรองรอตรวจ / ส่งช้า / ยังไม่ส่ง → เลือกงาน (เห็นไฟล์ + หมายเหตุ + ป้าย "ส่งช้า")
2. กรอก `score` (พิจารณาหักส่งช้าเอง) + `feedback` → `graded`, `graded_by`, `graded_at`
3. **sync** → `Score(raw_score=submission.score, source_submission=…)` → `AuditLog(action=grade)` → "ไปคนถัดไป"
4. ผู้เรียนที่ยังไม่ส่ง → กรอกคะแนนไม่ได้ (เว้นแต่กำหนดเป็นศูนย์ที่ `Score` โดยตรง)

### W12 — ตั้งหมวดคะแนน + คะแนนรวม (UC-12)
1. "จัดการหมวดคะแนน" → `GradingCategory` × N → เตือนถ้ารวม ≠ 100
2. "เพิ่มช่องคะแนน" → `GradeItem` กรอกเอง → กรอก `Score.raw_score` (ห้ามเกินคะแนนเต็ม) → `AuditLog(action=grade)`
3. คะแนนรวม **คำนวณสด** ตามสูตร `database.md` §9 ทุกครั้งที่เปิดสมุดคะแนน/หน้าคะแนน — **นับเฉพาะช่องที่มีคะแนนแล้ว** (เผยแพร่แบบทดสอบใหม่ คะแนนรวมไม่ตก) และแสดง **2 ตัวเลข**: ผลการเรียนตอนนี้ (%) + คะแนนสะสม (จาก 100)

### W13 — ประกาศ (UC-14 / UC-19)
1. แท็บ "ประกาศ" → กรอกหัวข้อ + รายละเอียด (ว่าง → ไม่บันทึก) → "เผยแพร่ประกาศ" → `Announcement(is_published=True, published_at=now)`
2. ผู้เรียนเห็นในแท็บประกาศ + หน้าภาพรวม ; ผู้สอนแก้ไข/ลบได้

### W14 — ผู้ดูแลระบบจำลองมุมมอง (UC-05)
1. หน้าจัดการบัญชี → ปุ่ม "จำลองมุมมอง" (เฉพาะผู้สอน/ผู้เรียนที่ใช้งานได้) → `log_action(impersonate_start, actor=<admin>, object=<target>)`
2. แสดงหน้าจอเสมือนผู้ใช้นั้น **ดูได้อย่างเดียว** (ปุ่มทำรายการถูกปิด) — ไม่มีการเขียนข้อมูลระหว่างนี้
3. "ออกจากการจำลองมุมมอง" → `log_action(impersonate_end)` → กลับหน้าจัดการบัญชี

### W15 — การลบ / ซ่อนของ
| สิ่งที่จะลบ | เงื่อนไข | ผล |
|---|---|---|
| Module / Content | — | ลบได้ (Content cascade ; Quiz/Assignment ที่ผูกอยู่ → `module=NULL`) |
| Quiz / Assignment **ที่ไม่เคยเผยแพร่** | `is_published=False` + ไม่มี `GradeItem` + ไม่มี attempt/submission | ลบจริงได้ (+ cascade Question/Choice/MatchingPair/Attachment) |
| Quiz / Assignment **ที่เคยเผยแพร่แล้ว** (มี `GradeItem` หรือมีข้อมูลผู้เรียน) | — | ลบไม่ได้ → ยกเลิกเผยแพร่ |
| GradeItem ที่มี Score | — | ลบไม่ได้ (PROTECT) |
| GradingCategory ที่มี GradeItem | — | ลบไม่ได้ → ย้ายช่องคะแนนออกก่อน |
| Announcement | — | ลบได้ |
| User | — | ลบไม่ได้ → ระงับ (`is_active=False`) |
| Course | — | ใช้ปิดรายวิชา (`is_closed=True`) |
| QuizAttempt / Submission / Score | — | ไม่มีการลบผ่านระบบใน MVP |

---

## 4. Access pattern ตามหน้าจอหลัก (รายงานบทที่ 5)

### หน้าภาพรวมผู้เรียน (5.2)
- วิชาที่เรียน: `Enrollment(student=me, status=active)` → `Course`
- งานที่ต้องทำ (เรียงตามกำหนดส่ง, ป้ายส้มเมื่อใกล้ครบ, ✓ + คะแนนเมื่อเสร็จ): `Assignment` / `Quiz` ที่เผยแพร่ในวิชาที่เรียน เทียบกับ `Submission` / `QuizAttempt` ของตนเอง
- คะแนนรวมต่อวิชา: **ผลการเรียนตอนนี้ (%) + คะแนนสะสม (จาก 100)** + แถบความคืบหน้าต่อหมวด — คำนวณสดจาก `Score`
- ประกาศล่าสุด: `Announcement(course__in=…, is_published=True)` order by `-published_at`

### รายวิชาของฉัน (5.3 / 5.4)
- ผู้สอน: `Course(teacher=me)` จัดกลุ่มตาม `academic_year`, `semester` + จำนวนผู้เรียน/หน่วยการเรียน + `join_code` + ป้ายยังไม่เผยแพร่/ปิดแล้ว
- ผู้เรียน: ช่องกรอกรหัสเข้าร่วม + `Enrollment(student=me)`

### สมุดคะแนน (5.9)
- แถว = `Enrollment(course=X, status=active)`
- **คอลัมน์ = `GradingCategory`** (หัวคอลัมน์แสดงน้ำหนัก + คะแนนเต็มของหมวด) ; ค่า = คะแนนรวมของหมวดจาก `GradeItem` ย่อย ; ไอคอนนาฬิกา = มีงานส่งช้าในหมวด (`Submission.is_late`)
- คอลัมน์ขวาสุด = **ผลการเรียนตอนนี้ (%) และคะแนนสะสม** (คำนวณสด)

### ประวัติการใช้งาน (5.13)
- `AuditLog` กรองช่วงวันที่ / `content_type` / `action` ; ทำแทนผู้สอน = `actor.role=admin` บนวิชาที่ `teacher ≠ actor` → แสดงหมายเหตุใต้ชื่อ ; จำลองมุมมอง → "ไม่มีการเปลี่ยนข้อมูล"

---

## 5. Invariant ที่บังคับใน application layer

1. ไม่มีการสมัครเอง — สร้างบัญชีได้เฉพาะผู้ดูแลระบบ
2. บัญชี `is_active=False` → ปฏิเสธทุกคำร้องขอทันที
3. `Course.code` ไม่ซ้ำภายในภาคการศึกษาเดียวกัน (unique `(academic_year, semester, code)`) ; เปลี่ยน `Course.teacher` ได้เฉพาะ admin และต้องเป็นบัญชี `role=teacher`
4. วิชาที่ `is_closed` → ผู้เรียนอ่านอย่างเดียว ; เข้าร่วมด้วยรหัสไม่ได้
5. `GradingCategory.weight_percent` รวม ≠ 100 → เตือน (ไม่บล็อก)
6. Quiz ที่มี `QuizAttempt` → แก้ได้เฉพาะส่วนที่ไม่กระทบผลเดิม ; Quiz ที่เคยเผยแพร่ → ลบไม่ได้
7. Assignment ที่เคยเผยแพร่ → ลบไม่ได้ (ยกเลิกเผยแพร่แทน)
8. `QuizAttempt` — ปฏิเสธการบันทึกคำตอบเมื่อ `now() > due_at`
9. `Submission` — ส่งใหม่ได้เฉพาะก่อน `due_at` และก่อน `graded` ; `closed_after_due` ปฏิเสธเมื่อเลยกำหนด
10. `Score` ห้ามเกิน `max_score` ; sync ไม่ทับ `adjusted_score`
11. คำถามปรนัยต้องมีคำตอบที่ถูกก่อนบันทึก
12. จำลองมุมมอง = อ่านอย่างเดียว ; ห้ามจำลองผู้ดูแลระบบ/บัญชีที่ถูกระงับ

---

## 6. สิ่งที่ยังไม่ตัดสิน / ตัดสินตอน implement

- **ผู้ให้บริการเก็บไฟล์** (อาจไม่ใช่ Cloudinary) และ **ข้อจำกัดชนิด/ขนาดไฟล์ระดับระบบ** — รอเลือก cloud ก่อน (รายงานระบุว่ามีการตรวจ แต่ไม่ระบุค่า)
- finalize attempt ที่ค้างเกินเวลา: lazy vs scheduled job
- retention ของ `AuditLog` และ `token_blacklist`
- composite index จริง (ดู `database.md` §11 ท้าย)

---

## 7. เช็กลิสต์ก่อนตอบคำถามเกี่ยวกับ schema นี้

- [ ] อ่าน `CLAUDE.md` (บริบท + tech stack)
- [ ] อ่านไฟล์นี้ (§0–§3 อย่างน้อย)
- [ ] เปิด `database.md` เมื่อต้องการ field/type/constraint ที่แน่นอน
- [ ] ถ้าสงสัยว่าขัดกับรายงาน → **ยึดรายงานบทที่ 3–4**
- [ ] จำ: 20 ตาราง, ไม่มี soft delete, 1 วิชา 1 ผู้สอน, ไม่มีสมัครเอง, คะแนนรวมคำนวณสด
- [ ] permission = ต่อวิชา (`Course.teacher` + `Enrollment`) ไม่ใช่แค่ `User.role`
