# เอกสารออกแบบฐานข้อมูล — LMS (Mangosteen Campus)

> สถานะ: **v2.1 — ปรับให้ตรงกับรายงานบทที่ 1–5** (`บทที่_1_2_3_4_5 - ปรับปรุง - หลัง feedback - หลังเพิ่มสารบัญ.docx`)
> อัปเดตล่าสุด: 2026-10-04
>
> **v1.1–v1.3** (2026-09-09) = ออกแบบรอบแรก 25 ตาราง (ลบสำเนาแล้ว — สรุปสิ่งที่เปลี่ยนอยู่ใน §11)
> **v2.1** (2026-10-04) = ตัดสินประเด็นที่รายงานไม่ระบุ (§11 v2.1) — คะแนนรวมนับเฉพาะช่องที่มีคะแนน, รหัสวิชาไม่ซ้ำในภาคเดียวกัน, ผู้ให้บริการเก็บไฟล์ยังไม่กำหนด, ฯลฯ
> **v2.0** (2026-10-04) = ยึดรายงานบทที่ 3–4 เป็นหลัก → เหลือ **20 ตาราง**: ตัด `Term`, `CourseTeacher`, `EmailVerificationToken`, `CourseGrade`, `AnnouncementRead`, `Notification` ; ตัด soft delete ; Course มีผู้สอนคนเดียว + `is_closed` ; ไม่มีการสมัครเอง ; dropdown หลายช่องว่าง ; ส่งงาน 1 ระเบียนต่อคน (แทนที่ไฟล์) ; ไม่หักคะแนนส่งช้าอัตโนมัติ ; คะแนนรวมคำนวณสดไม่เก็บ ; ดูรายการเต็มที่ §11

เอกสารนี้คือ "แผนที่" ของ data model ทั้งระบบ — **ถ้าขัดกับรายงาน ให้ยึดรายงาน** (บทที่ 4 = โครงสร้างตาราง, บทที่ 3 = กฎการทำงานจากยูสเคส)
field ปลีกย่อยปรับได้ภายหลังด้วย migration แต่ความสัมพันธ์ระหว่างตาราง (cardinality) + ชนิด PK ถือว่า freeze

**บันทึกการตัดสินใจอยู่ที่ §11 · สิ่งที่ตั้งใจไม่ทำใน MVP อยู่ที่ §13**

เอกสารชุดนี้: ไฟล์นี้ (สเปก) · [`database-erd.md`](./database-erd.md) (ERD) · [`database-fields.md`](./database-fields.md) (quick ref ราย field) · [`database-guide.md`](./database-guide.md) (ใครเขียน/ใครอ่าน/lifecycle/workflow)

---

## 1. หลักการออกแบบร่วม (ใช้กับทุก model)

| หัวข้อ | การตัดสินใจ | เหตุผล |
|---|---|---|
| Primary key | `BigAutoField` (int) ทุกตาราง | เรียบง่าย พอสำหรับ MVP |
| Timestamp | ทุกตาราง inherit `TimeStampedModel` (`created_at`, `updated_at`) **ยกเว้น `AuditLog` มีเฉพาะ `created_at`** (ตารางบันทึกเหตุการณ์) | ตามรายงาน §4.2 |
| Timezone | เก็บ `datetime` เป็น UTC ใน DB, แปลงเป็น `Asia/Bangkok` ตอนแสดง — การเทียบ "ส่งช้า" ทำในเวลาไทย | มาตรฐาน Django (`USE_TZ = True`) ; รายงานแสดงตัวอย่างเป็นเวลาไทยแบบ พ.ศ. แต่ค่าจริงเป็น UTC |
| Decimal | คะแนน (`max_score`, `points`, `raw_score`, `score` ฯลฯ) = `DecimalField(max_digits=7, decimal_places=2)` ; เปอร์เซ็นต์ (`weight_percent`) = `DecimalField(max_digits=5, decimal_places=2)` | กัน float error |
| **การลบ** | **ไม่มี soft delete** ; Quiz/Assignment **ลบจริงได้เฉพาะที่ไม่เคยเผยแพร่** (`is_published=False` + ไม่มี `GradeItem` + ไม่มี attempt/submission) — เคยเผยแพร่แล้ว (โดยเฉพาะที่มีผู้เรียนทำ/ส่งแล้ว) **ลบไม่ได้ → ยกเลิกการเผยแพร่แทน** ; FK ที่เชื่อมเข้าสู่คะแนนใช้ `PROTECT` (`QuizAttempt.quiz`, `Submission.assignment`, `GradeItem.quiz/assignment/category`, `Score.grade_item`, `*.student`) | ตามรายงานตาราง 4.7 / 4.13 — กันคะแนน/หลักฐานหายจาก cascade |
| **User ไม่ลบจริง** | ปิดบัญชีด้วย `is_active=False` ("ระงับ") เท่านั้น — เปิดใช้งานกลับได้ | ตามรายงาน UC-04 / หน้าจอ 5.11 |
| การจัดลำดับ | field `order` (int) — **ไม่**ใส่ unique ; reorder เขียนค่าใหม่ทั้ง list ใน transaction เดียว | สลับลำดับง่าย |
| ภาษาของข้อมูล | **field เดียวทั้งระบบ** (ไม่แยก `_th` / `_en`) — ผู้ใช้พิมพ์ภาษาใดก็ได้ ; i18n = UI chrome เท่านั้น | |
| ข้อความยาว | field ข้อความยาวที่ผู้ใช้เขียน (`Content.body`, `Assignment.description`, `Quiz.description`, `Announcement.body`, `Module.description`, `Course.description`) เก็บเป็น **Markdown** — render ฝั่ง frontend แบบ sanitize (ไม่อนุญาต HTML ดิบ) | เหมาะกับวิชาที่มีโค้ด + กัน XSS ง่าย |
| ไฟล์ | อัปโหลด**ผ่าน backend** ไป "บริการจัดเก็บไฟล์ภายนอก" (**ยังไม่กำหนดผู้ให้บริการ**) ผ่าน storage abstraction (`django-storages`) ; ฟิลด์ไฟล์ (`file_url`, `avatar_url`) **เก็บตำแหน่งไฟล์** เช่น `submissions/8001/even_odd.py` **ไม่เก็บลิงก์เต็ม** — ระบบสร้างลิงก์ตามผู้ให้บริการที่ตั้งค่าไว้ตอนเรียกใช้ (ไฟล์ส่วนตัวเช่นงานที่ส่ง = ลิงก์ชั่วคราวหลังตรวจสิทธิ์) ; Content = 1 ไฟล์ inline / งานที่มีหลายไฟล์ (submission, assignment attachment) แยกตาราง `*File` | เปลี่ยน cloud ได้โดยแก้แค่ตั้งค่า ไม่ต้องแก้ข้อมูล ; ใช้ `FileField` มาตรฐานของ Django |

### Abstract models

- **`TimeStampedModel`** (abstract): `created_at`, `updated_at`
- **`Auditable`** (abstract marker): model ที่ต้องบันทึก `AuditLog` อัตโนมัติ — ดูขอบเขตที่ §10

---

## 2. Django apps (แบ่งโดเมน)

```
backend/
  accounts/       User
  academics/      Course
  content/        Module, Content
  enrollment/     Enrollment
  assessments/    Quiz, Question, Choice, MatchingPair, QuizAttempt, Answer
  assignments/    Assignment, AssignmentAttachment, Submission, SubmissionFile
  grading/        GradingCategory, GradeItem, Score
  announcements/  Announcement
  audit/          AuditLog
  common/         TimeStampedModel, Auditable, utilities
```

**20 ตาราง** (รายงานตาราง 4.2) + ตารางระบบที่ไม่นับ: `django_content_type` (ใช้โดย `AuditLog.content_type`) และตารางของ Simple JWT `token_blacklist` (เก็บ refresh token ที่ถูกยกเลิกตอนออกจากระบบ)

---

## 3. Accounts

### `User` (custom, extends `AbstractBaseUser` + `PermissionsMixin`) — รายงานตาราง 4.3

| field | type | หมายเหตุ |
|---|---|---|
| `email` | Email, **unique**, required | ใช้เข้าสู่ระบบได้ |
| `student_or_staff_id` | Char, **unique**, `null=True` | รหัสนักศึกษา/รหัสพนักงาน — ใช้เข้าสู่ระบบได้ |
| `role` | Char choices: `admin` / `teacher` / `student` | บทบาทระดับระบบ — เก็บใน token claims ด้วย |
| `first_name`, `last_name` | Char | ชื่อ-นามสกุล (ภาษาใดก็ได้) |
| `is_active` | Bool, default `True` | `False` = ถูกผู้ดูแลระบบระงับบัญชี |
| `avatar_url` | Char (ตำแหน่งไฟล์), blank | รูปประจำตัว — เก็บ**ตำแหน่งไฟล์**บนบริการจัดเก็บไฟล์ภายนอก (ดู §1 แถว "ไฟล์") |
| `created_by` | FK → `User`, `null=True`, `SET_NULL` | ผู้ดูแลระบบที่สร้างบัญชีนี้ (null = บัญชีผู้ดูแลระบบเริ่มต้น) |
| `last_login`, `date_joined` | Django default | |
| (`password`, `is_staff`, `is_superuser`) | Django internal | ไม่แสดงในรายงาน ; `is_staff`/`is_superuser` ใช้กับ Django admin เท่านั้น แยกจาก `role` |

**กฎบัญชี / role**
- **ไม่มีการสมัครใช้งานเอง** — ทุกบัญชีสร้างโดยผู้ดูแลระบบ (หน้าจอ 5.1) ; ผู้ดูแลระบบกำหนด `role` ตอนสร้าง/แก้ไข
- **รหัสผ่านแรก / ลืมรหัสผ่าน**: ผู้ดูแลระบบ**ตั้งรหัสผ่านชั่วคราว**ตอนสร้างบัญชีแล้วแจ้งผู้ใช้เอง ; ผู้ใช้เปลี่ยนเองที่หน้าข้อมูลส่วนตัว (UC-02) ; ลืมรหัส → **ผู้ดูแลระบบรีเซ็ตให้** (ไม่มีระบบอีเมล ไม่มีตาราง token)
- **สร้างบัญชีทีละหลายคนจากไฟล์ CSV** (ผู้ดูแลระบบ) — ไม่ต้องแก้ schema ; ตรวจซ้ำ/รูปแบบทีละแถวเหมือนสร้างทีละคน ; รายละเอียดคอลัมน์กำหนดตอนทำฟีเจอร์ (ควรเติมใน UC-04 ของรายงาน)
- เข้าสู่ระบบด้วย **อีเมล หรือ รหัสนักศึกษา/รหัสพนักงาน** + รหัสผ่าน → ออก Access Token + Refresh Token (JWT, มี `role`) ; ออกจากระบบ = blacklist Refresh Token + ลบ token ฝั่ง client (UC-01)
- บัญชีที่ `is_active=False` → เข้าสู่ระบบไม่ได้ และคำร้องขอที่ค้างอยู่ถูกปฏิเสธทันที (UC-04)
- ผู้ใช้แก้ข้อมูลส่วนตัวของตนเองได้: ชื่อ-นามสกุล อีเมล รูปประจำตัว รหัสผ่าน (UC-02) — ตรวจอีเมลซ้ำ/รูปแบบ
- 1 บัญชี = 1 role ; สิทธิ์ในรายวิชาดูจาก `Course.teacher` (ผู้สอน) และ `Enrollment` (ผู้เรียน)

---

## 4. Academics

### `Course` — รายงานตาราง 4.4

| field | type | หมายเหตุ |
|---|---|---|
| `academic_year` | int | ปีการศึกษาที่เปิดสอน (เช่น 2569) |
| `semester` | smallint choices: `1` / `2` / `3` | 3 = ภาคฤดูร้อน |
| `teacher` | FK → `User`, `PROTECT` | **ผู้สอนที่รับผิดชอบ — 1 รายวิชามีผู้สอนคนเดียว** (User 1 : N Course) |
| `code` | Char | รหัสรายวิชา เช่น `"204111"` |
| `name` | Char | ชื่อรายวิชา |
| `description` | Text, blank | |
| `join_code_enabled` | Bool, default `False` | เปิดให้ผู้เรียนเข้าร่วมด้วยรหัสเข้าร่วมหรือไม่ |
| `join_code` | Char, unique, `null=True` | รหัสเข้าร่วม — **ระบบสุ่มสร้าง แยกจากรหัสวิชา** ; ผู้สอนสร้างรหัสใหม่ได้ (เช่น `K7Q2XM9A`) |
| `is_published` | Bool, default `False` | ผู้เรียนเห็น/เข้าใช้งานได้เมื่อ `True` |
| `is_closed` | Bool, default `False` | ปิดรายวิชาแล้ว → ผู้เรียน**ดูข้อมูลย้อนหลังได้อย่างเดียว** |
| `created_by` | FK → `User`, `SET_NULL`, `null=True` | ผู้สร้าง (ผู้สอน หรือผู้ดูแลระบบที่สร้างแทน) |
| — | unique_together | **`(academic_year, semester, code)`** — รหัสวิชาไม่ซ้ำ**ภายในภาคการศึกษาเดียวกัน** ; ข้ามภาคใช้รหัสเดิมได้ (เตรียมวิชาภาคหน้าได้โดยไม่ต้องปิดภาคเก่า) |

> รายวิชาเดียวกันที่เปิดคนละภาคการศึกษา = คนละระเบียน ; ปีการศึกษา/ภาคเรียนเก็บใน Course โดยตรง (ไม่มีตาราง Term)
> **สิทธิ์**: `Course.teacher` จัดการรายวิชาได้เต็ม ; ผู้ดูแลระบบจัดการรายวิชาและการลงทะเบียน**แทนผู้สอน**ได้ในกรณีสนับสนุนระบบ (บันทึก `AuditLog` โดย `actor` = ผู้ดูแลระบบ)
> **กำหนดผู้สอน**: ผู้สอนสร้างวิชาเอง → `teacher` = ตัวเองอัตโนมัติ ; ผู้ดูแลระบบสร้างแทน → **ต้องเลือกผู้สอนจากบัญชีที่ `role=teacher` และ `is_active=True`** ; **เปลี่ยน `teacher` ได้เฉพาะผู้ดูแลระบบ** (เช่น ผู้สอนย้ายงาน) → `AuditLog(action=update)`
> **ปิดรายวิชา** (`is_closed=True`): ผู้เรียนอ่านได้อย่างเดียว (ทำแบบทดสอบ/ส่งงานไม่ได้), เข้าร่วมด้วยรหัสไม่ได้ → บันทึก `AuditLog(action=close_course)`

---

## 5. Content (`Course → Module → Content`)

### `Module` — รายงานตาราง 4.5

| field | type | หมายเหตุ |
|---|---|---|
| `course` | FK → `Course`, `CASCADE` | |
| `title` | Char | ชื่อหน่วยการเรียน |
| `description` | Text, blank | |
| `order` | int | ลำดับในรายวิชา |
| `is_published` | Bool, default `False` | |

### `Content` — รายงานตาราง 4.6

| field | type | หมายเหตุ |
|---|---|---|
| `module` | FK → `Module`, `CASCADE` | |
| `title` | Char | ชื่อหัวข้อเนื้อหา |
| `content_type` | Char choices: `text` / `file` / `image` / `video` / `audio` / `link` | discriminator |
| `body` | Text, blank | เนื้อหาแบบข้อความ **(Markdown)** (ใช้เมื่อ `text`) |
| `order` | int | |
| `is_published` | Bool, default `False` | |
| `file_url` | Char (ตำแหน่งไฟล์), blank | **ตำแหน่งไฟล์**บนบริการจัดเก็บไฟล์ภายนอก (ระบบสร้างลิงก์ให้เมื่อเรียกใช้) — ใช้เมื่อ `file` / `image` / `audio` / **`video` ที่อัปโหลด** |
| `file_name`, `file_size` (ไบต์), `mime_type` | Char/int | metadata |
| `external_url` | URL, blank | ลิงก์ภายนอก — ใช้เมื่อ `link` หรือ **`video` จากเว็บอื่น เช่น YouTube** |

> 1 Content = 1 ไฟล์หลัก ; ต้องการหลายไฟล์ → สร้างหลาย Content
> ชนิด/ขนาดไฟล์ไม่ตรงที่กำหนด หรืออัปโหลดไปบริการภายนอกล้มเหลว → ปฏิเสธและไม่บันทึกเนื้อหา (UC-09)

---

## 6. Enrollment

### `Enrollment` (ตารางเชื่อม `Course` ↔ `User` ในบทบาทผู้เรียน) — รายงานตาราง 4.22 / หัวข้อ 4.3

| field | type | หมายเหตุ |
|---|---|---|
| `course` | FK → `Course`, `CASCADE` | |
| `student` | FK → `User`, `PROTECT` | |
| `status` | Char choices: `active` / `dropped` | กำลังเรียน / ถูกถอนออกจากรายวิชา |
| `enrolled_by` | FK → `User`, `SET_NULL`, `null=True` | ผู้กำหนดผู้เรียนเข้ารายวิชา (null = เข้าร่วมด้วยรหัสเข้าร่วม) |
| `enrolled_at` | datetime | |
| `dropped_at` | datetime, `null=True` | |
| — | unique_together | `(course, student)` — 1 ระเบียนต่อรายวิชา |

> รองรับ 2 เส้นทาง (UC-08 / UC-15):
> - ผู้สอน/ผู้ดูแลระบบเพิ่มรายชื่อ → `Enrollment(status=active, enrolled_by=<ผู้เพิ่ม>)` ทันที
> - ผู้เรียนกรอก `Course.join_code` (ต้อง `join_code_enabled`, `is_published`, ไม่ `is_closed`) → `Enrollment(status=active, enrolled_by=NULL)`
>
> มีระเบียนอยู่แล้ว → ไม่เพิ่มซ้ำ (ถ้า `active` นำเข้าสู่รายวิชาเลย)
> **ถอน** → `status=dropped`, `dropped_at` — **คะแนนเดิมเก็บไว้** แต่เข้าถึงรายวิชาไม่ได้ ; เข้าร่วมใหม่ (ด้วยรหัสหรือผู้สอนเพิ่ม) = **เปลี่ยนระเบียนเดิมกลับเป็น `active`** โดยคงคะแนนเดิม

---

## 7. Assessments (Quiz / แบบทดสอบท้ายบท)

### `Quiz` — รายงานตาราง 4.7

| field | type | หมายเหตุ |
|---|---|---|
| `course` | FK → `Course`, `CASCADE` | บังคับ |
| `module` | FK → `Module`, `SET_NULL`, `null=True` | ผูกกับหน่วยการเรียน (ไม่บังคับ) |
| `grading_category` | FK → `GradingCategory`, `SET_NULL`, `null=True` | หมวดคะแนน (ใช้เมื่อ `is_graded=True`) |
| `title` | Char | |
| `description` | Text, blank | |
| `is_graded` | Bool, default `True` | นำคะแนนเข้าสมุดคะแนนหรือไม่ |
| `time_limit_minutes` | int, `null=True` | เวลาที่ให้ทำ (นาที) — **null = ไม่จับเวลา** |
| `max_attempts` | int, `null=True` | **1 = ทำได้ครั้งเดียว ; > 1 = ทำได้หลายครั้ง เก็บคะแนนครั้งที่สูงที่สุด ; null = ไม่จำกัด** (เก็บสูงสุดเช่นกัน) |
| `available_from`, `available_until` | datetime, `null=True` | ช่วงเวลาเปิด/ปิดรับการทำ |
| `is_published` | Bool, default `False` | |
| `created_by` | FK → `User`, `SET_NULL`, `null=True` | |

> **คะแนนเต็มของแบบทดสอบ = ผลรวม `Question.points` ทุกข้อ** (คำนวณ ไม่เก็บเป็น field)
> **ลบ**: ลบจริงได้เฉพาะที่ไม่เคยเผยแพร่ (ยังไม่มี `GradeItem` และยังไม่มีผู้เรียนทำ) ; เคยเผยแพร่แล้ว → ลบไม่ได้ ให้ยกเลิกการเผยแพร่แทน
> **แก้หลังมีคนทำ**: เมื่อมี `QuizAttempt` แล้ว ระบบจำกัดการแก้ไข**เฉพาะส่วนที่ไม่กระทบผลการทำเดิม** (เช่น ข้อความโจทย์ ช่วงเวลา) — เพิ่ม/ลบ/เรียงข้อ แก้ `points` แก้คำตอบที่ถูกต้อง ทำไม่ได้ (UC-10)
> คำถามปรนัยที่ยังไม่กำหนดคำตอบที่ถูกต้อง → บันทึกไม่ได้

### `Question` — รายงานตาราง 4.8

| field | type | หมายเหตุ |
|---|---|---|
| `quiz` | FK → `Quiz`, `CASCADE` | |
| `question_type` | Char choices: `mcq` / `true_false` / `matching` / `dropdown` / `short_answer` | ปรนัย 4 ตัวเลือก / ถูก-ผิด / จับคู่ / เติมคำจากตัวเลือก / อัตนัยแบบสั้น |
| `text` | Text | โจทย์ — **ชนิด `dropdown` ระบุตำแหน่งช่องว่างในข้อความ เช่น `[1]`, `[2]`** |
| `order` | int | |
| `points` | Decimal | คะแนนของข้อนี้ |

> **`short_answer` ผู้สอนตรวจเองเสมอ** (ไม่มีการตรวจอัตโนมัติ)

### `Choice` (ใช้กับ `mcq`, `true_false`, `dropdown`) — รายงานตาราง 4.9

| field | type | หมายเหตุ |
|---|---|---|
| `question` | FK → `Question`, `CASCADE` | |
| `blank_no` | int, `null=True` | ลำดับช่องว่างที่ตัวเลือกนี้สังกัด — **ใช้เฉพาะ `dropdown`** |
| `text` | Char | |
| `is_correct` | Bool | `mcq` = 4 ตัวเลือก ถูก 1 ; `true_false` = 2 ตัวเลือก ; `dropdown` = ถูก 1 ตัว**ต่อช่องว่าง** |
| `order` | int | |

### `MatchingPair` (ใช้กับ `matching`) — รายงานตาราง 4.10

| field | type | หมายเหตุ |
|---|---|---|
| `question` | FK → `Question`, `CASCADE` | |
| `left_text` | Char | ฝั่งซ้าย (โจทย์) |
| `right_text` | Char | ฝั่งขวา (คำตอบที่คู่กัน) |
| `order` | int | |

> ตอนทำแบบทดสอบ ระบบสลับลำดับฝั่งขวาเป็นตัวเลือก — คู่ที่ถูก = `left_i ↔ right_i`

### `QuizAttempt` — รายงานตาราง 4.11

| field | type | หมายเหตุ |
|---|---|---|
| `quiz` | FK → `Quiz`, `PROTECT` | |
| `student` | FK → `User`, `PROTECT` | |
| `attempt_number` | int | 1, 2, 3… |
| `status` | Char choices: `in_progress` / `submitted` / `auto_submitted` / `graded` | |
| `started_at` | datetime | **บันทึกฝั่งเซิร์ฟเวอร์** — ใช้บังคับเวลา |
| `due_at` | datetime, `null=True` | เวลาที่ต้องส่ง **บันทึกไว้ตอนเริ่มทำ** = `min(started_at + time_limit, Quiz.available_until)` ; null = ไม่จับเวลาและไม่มีเวลาปิด |
| `submitted_at` | datetime, `null=True` | |
| `score` | Decimal, `null=True` | คะแนนรวมหลังตรวจ |
| `graded_at` | datetime, `null=True` | |
| `graded_by` | FK → `User`, `SET_NULL`, `null=True` | กรณีมีคำถามอัตนัยที่ผู้สอนตรวจเอง |
| — | unique_together | `(quiz, student, attempt_number)` |

**การบังคับเวลาฝั่ง backend** (UC-16):
- ก่อนเริ่ม → เช็คช่วงเวลาเปิด + จำนวนครั้ง (`max_attempts`) ; ครบแล้ว → ไม่อนุญาต
- ระบบบันทึกคำตอบเป็นระยะ ; ทุกครั้งที่บันทึก/ส่ง → เช็ค `now() <= due_at` ; ถ้าเลย → ปฏิเสธคำตอบใหม่ แล้วส่งให้อัตโนมัติด้วยคำตอบที่มีอยู่ (`status=auto_submitted`)
- ผู้เรียนออกจากหน้าจอ/ปิดเบราว์เซอร์ → เวลายังนับต่อ ; attempt ที่ค้างเกินเวลา finalize แบบ lazy ตอนเข้าถึง หรือด้วย scheduled job
- ส่งแล้วแก้คำตอบไม่ได้

### `Answer` (1 คำตอบต่อ 1 คำถาม ต่อ 1 attempt) — รายงานตาราง 4.12

| field | type | หมายเหตุ |
|---|---|---|
| `attempt` | FK → `QuizAttempt`, `CASCADE` | |
| `question` | FK → `Question`, `PROTECT` | |
| `response` | JSONB | คำตอบจริง — รูปแบบตามชนิดคำถาม (ตารางล่าง) |
| `is_correct` | Bool, `null=True` | null = ยังไม่ตรวจ ; **`dropdown` = `True` เมื่อถูกครบทุกช่อง** |
| `points_awarded` | Decimal, `null=True` | **`dropdown` คิดตามสัดส่วนช่องที่ตอบถูก** |
| `feedback` | Text, blank | ความเห็นผู้สอน (คำถามอัตนัย) |
| — | unique_together | `(attempt, question)` |

**รูปแบบ `response` + การตรวจ:**

| question_type | `response` | การตรวจ |
|---|---|---|
| `mcq`, `true_false` | `{"choice_id": 501}` | อัตโนมัติ — ถูก = ได้ `points` เต็ม |
| `dropdown` | `{"blanks": {"1": 511, "2": 514}}` (ช่องที่ → รหัสตัวเลือก) | อัตโนมัติ — `points × (ช่องที่ถูก / ช่องทั้งหมด)` ปัด 2 ตำแหน่ง |
| `matching` | `{"pairs": {"<left_id>": <right_id>, ...}}` | อัตโนมัติ — `points × (คู่ที่ถูก / คู่ทั้งหมด)` ปัด 2 ตำแหน่ง |
| `short_answer` | `{"text": "คำตอบ"}` | **ผู้สอนตรวจเอง** — รอ `points_awarded` |

---

## 8. Assignments

### `Assignment` — รายงานตาราง 4.13

| field | type | หมายเหตุ |
|---|---|---|
| `course` | FK → `Course`, `CASCADE` | |
| `module` | FK → `Module`, `SET_NULL`, `null=True` | ไม่บังคับ |
| `grading_category` | FK → `GradingCategory`, `SET_NULL`, `null=True` | ใช้เมื่อ `is_graded=True` |
| `is_graded` | Bool, default `True` | นำคะแนนเข้าสมุดคะแนนหรือไม่ |
| `title` | Char | |
| `description` | Text | โจทย์งาน **(Markdown)** |
| `max_score` | Decimal | คะแนนเต็ม |
| `due_at` | datetime, `null=True` | กำหนดส่ง — null = ไม่มีกำหนดส่ง (ไม่มีสถานะส่งช้า) |
| `late_policy` | Char choices: `closed_after_due` / `accept_late` | ปิดรับเมื่อเลยกำหนด / รับและทำเครื่องหมายว่าส่งช้า |
| `is_published` | Bool, default `False` | |
| `created_by` | FK → `User`, `SET_NULL`, `null=True` | |

> **ลบ**: ลบจริงได้เฉพาะที่ไม่เคยเผยแพร่ (ยังไม่มี `GradeItem` และยังไม่มีผู้เรียนส่ง) ; เคยเผยแพร่แล้ว → ลบไม่ได้ ให้ยกเลิกการเผยแพร่แทน
> กำหนดส่งอยู่ในอดีต → ระบบเตือนให้ยืนยันอีกครั้ง (UC-11)
> **ไม่มีการหักคะแนนส่งช้าอัตโนมัติ** — ระบบทำเครื่องหมาย `is_late` ให้ผู้สอนพิจารณาหักเองตามเกณฑ์ของรายวิชา

### `AssignmentAttachment` (ไฟล์ประกอบโจทย์จากผู้สอน) — รายงานตาราง 4.14

| field | type |
|---|---|
| `assignment` | FK → `Assignment`, `CASCADE` |
| `file_url`, `file_name`, `file_size` (ไบต์), `mime_type` | **ตำแหน่งไฟล์**บนบริการจัดเก็บไฟล์ภายนอก (ระบบสร้างลิงก์ให้) + metadata |

### `Submission` — รายงานตาราง 4.15

| field | type | หมายเหตุ |
|---|---|---|
| `assignment` | FK → `Assignment`, `PROTECT` | |
| `student` | FK → `User`, `PROTECT` | |
| `status` | Char choices: `submitted` / `graded` | เมื่อ `graded` แล้วผู้เรียนส่งไฟล์ใหม่ไม่ได้ |
| `submitted_at` | datetime | เวลาที่ส่ง**ล่าสุด** |
| `is_late` | Bool, default `False` | ระบบทำเครื่องหมายอัตโนมัติ (`submitted_at > due_at` เทียบเวลาไทย) — `False` เสมอถ้า `due_at` null |
| `note` | Text, blank | หมายเหตุที่ผู้เรียนฝากถึงผู้สอน |
| `score` | Decimal, `null=True` | คะแนนที่ผู้สอนให้ (กรณีส่งช้า ผู้สอนหักเอง) — **คะแนนนี้เข้าสมุดคะแนน** |
| `feedback` | Text, blank | ข้อเสนอแนะของผู้สอน |
| `graded_by` | FK → `User`, `SET_NULL`, `null=True` | |
| `graded_at` | datetime, `null=True` | |
| — | unique_together | `(assignment, student)` — **1 ระเบียนต่อผู้เรียนต่องาน** |

**กติกาการส่ง** (UC-17):
- เลยกำหนดส่ง + `closed_after_due` → ไม่อนุญาตให้ส่ง ; เลยกำหนด + `accept_late` → รับ และ `is_late=True`
- **ส่งไฟล์ใหม่** ได้ก่อนถึงกำหนดส่ง **และ** ก่อนผู้สอนตรวจ → แทนที่ไฟล์เดิมในระเบียนเดิม (`SubmissionFile` เดิมถูกแทนที่) + อัปเดต `submitted_at`
- ผู้สอนให้คะแนนได้เฉพาะงานที่ส่งแล้ว — ยกเว้นกำหนดเป็นศูนย์ให้ผู้ที่ไม่ส่ง (บันทึกที่ `Score` โดยตรง) (UC-13)

### `SubmissionFile` — รายงานตาราง 4.16

| field | type |
|---|---|
| `submission` | FK → `Submission`, `CASCADE` |
| `file_url`, `file_name`, `file_size` (ไบต์), `mime_type` | **ตำแหน่งไฟล์**บนบริการจัดเก็บไฟล์ภายนอก (ระบบสร้างลิงก์ให้) + metadata |

---

## 9. Grading (ถ่วงน้ำหนักตามหมวด)

> **ผลลัพธ์ที่ระบบออก**: คะแนน % ต่อหมวด + **คะแนนรวมแบบถ่วงน้ำหนัก (%)** — ไม่มีเกรดตัวอักษร / GPA
> **คะแนนรวมคำนวณจาก `Score` ทุกครั้งที่แสดงผล — ไม่จัดเก็บคะแนนรวมไว้ในฐานข้อมูล** (รายงานตาราง 4.17)

```
Course
  └── GradingCategory (weight %)         เช่น แบบทดสอบ 30% / งาน 30% / สอบปลายภาค 40%
        └── GradeItem (max_score)        1 quiz / 1 assignment / ช่องกรอกเอง
              └── Score (per student)    คะแนนดิบ + คะแนนปรับแก้
```

### `GradingCategory` — รายงานตาราง 4.17

| field | type | หมายเหตุ |
|---|---|---|
| `course` | FK → `Course`, `CASCADE` | |
| `name` | Char | ชื่อหมวด เช่น `"แบบทดสอบ"` |
| `weight_percent` | Decimal | เช่น `30.00` |
| `order` | int | |

> ผลรวม `weight_percent` ต่อรายวิชา ≠ 100 → **แจ้งเตือน** ไม่บล็อก (UC-12)
> ลบหมวดที่ยังมี `GradeItem` อยู่ไม่ได้ (`GradeItem.category` = `PROTECT`) ต้องย้ายช่องคะแนนออกก่อน

### `GradeItem` — รายงานตาราง 4.18

| field | type | หมายเหตุ |
|---|---|---|
| `course` | FK → `Course`, `CASCADE` | |
| `category` | FK → `GradingCategory`, `PROTECT`, `null=True` | null = ยังไม่จัดหมวด → **ไม่ถูกนับในคะแนนรวม** |
| `title` | Char | ชื่อคอลัมน์ |
| `max_score` | Decimal | |
| `quiz` | FK → `Quiz`, `PROTECT`, `null=True` | แบบทดสอบต้นทาง (null = ไม่ได้มาจากแบบทดสอบ) |
| `assignment` | FK → `Assignment`, `PROTECT`, `null=True` | งานต้นทาง (null = ไม่ได้มาจากงาน) |
| `order` | int | |

> ที่มาของช่องคะแนนดูจาก FK: มี `quiz` = จากแบบทดสอบ ; มี `assignment` = จากงาน ; ว่างทั้งคู่ = **ช่องที่ผู้สอนกรอกเอง** (เช่น สอบปลายภาค, การมีส่วนร่วม)
> **การสร้างอัตโนมัติ**: เมื่อ Quiz/Assignment ที่ `is_graded=True` ถูกเผยแพร่ครั้งแรก → สร้าง `GradeItem` 1 ช่อง (`max_score` copy มา, `category` = `grading_category` ของต้นทาง) ; ไม่คิดคะแนน = ไม่มีช่องคะแนน (ความสัมพันธ์ 1 : 0..1)
> **ผู้เรียนเห็นคะแนนทันทีเมื่อผู้สอนบันทึก** (ไม่มีขั้นเผยแพร่คะแนนแยก)
> ลบช่องคะแนนที่มี `Score` ไม่ได้ (`Score.grade_item` = `PROTECT`)

### `Score` — รายงานตาราง 4.19

| field | type | หมายเหตุ |
|---|---|---|
| `grade_item` | FK → `GradeItem`, `PROTECT` | |
| `student` | FK → `User`, `PROTECT` | |
| `raw_score` | Decimal, `null=True` | คะแนนดิบ — จากการตรวจอัตโนมัติ/การตรวจงาน หรือผู้สอนกรอกเอง |
| `adjusted_score` | Decimal, `null=True` | คะแนนที่ผู้สอนปรับแก้ (ถ้ามี ใช้ค่านี้แทน) |
| `comment` | Text, blank | |
| `source_attempt` | FK → `QuizAttempt`, `SET_NULL`, `null=True` | ที่มาของคะแนน |
| `source_submission` | FK → `Submission`, `SET_NULL`, `null=True` | ที่มาของคะแนน |
| — | unique_together | `(grade_item, student)` — 1 ระเบียนต่อช่องคะแนน |

> กรอกคะแนนเกิน `GradeItem.max_score` → ไม่อนุญาต (UC-12)

**กลไก sync คะแนน → `Score`:**
- **Quiz**: `QuizAttempt` ตรวจเสร็จ (`graded`) → เขียน/อัปเดต `Score.raw_score` ของ `GradeItem` ที่ผูกกับ quiz — `max_attempts=1` ใช้ attempt นั้น ; ทำได้หลายครั้ง → ใช้ **attempt ที่ `score` สูงสุด** (`source_attempt` ชี้ไป attempt นั้น)
- **Assignment**: `Submission.status` → `graded` → เขียน/อัปเดต `Score.raw_score = Submission.score` (`source_submission`)
- sync ไม่ทับ `adjusted_score`

**สูตรคะแนนรวมแบบถ่วงน้ำหนัก** (คำนวณสดทุกครั้ง):

1. **นับเฉพาะช่องที่มีคะแนนแล้ว** — ช่อง `GradeItem` ที่ผู้เรียนคนนั้นยังไม่มี `Score` (หรือ `raw_score` และ `adjusted_score` ว่างทั้งคู่) **ไม่นำมาคิด** ; ช่องที่นับ: `s(item)` = `adjusted_score` ถ้ามี ไม่งั้น `raw_score` ; `m(item)` = `GradeItem.max_score`
2. % ของหมวด `c` — **ถ่วงตามสัดส่วนคะแนนเต็มของช่องที่มีคะแนนแล้ว**: `category_pct(c) = Σ s_i / Σ m_i` ; ช่องที่ `category = NULL` → ไม่นับ
3. ให้ `C*` = หมวดที่มีช่องที่มีคะแนนแล้วอย่างน้อย 1 ช่อง (หมวดที่ยังไม่มีคะแนนเลยไม่อยู่ใน `C*`) → ระบบแสดง **2 ตัวเลขคู่กัน**:
   - **ผลการเรียนตอนนี้ (%)** `current_pct = Σ_{c∈C*} [ category_pct(c) × weight_percent(c) ] / Σ_{c∈C*} weight_percent(c)` — เทียบเป็น 100 เฉพาะหมวดที่มีคะแนนแล้ว (บอกว่า "ทำได้ดีแค่ไหนในส่วนที่ประเมินไปแล้ว")
   - **คะแนนสะสม** `accumulated = Σ_{c∈C*} [ category_pct(c) × weight_percent(c) / 100 ]` จาก `Σ weight_percent` ทุกหมวด (ปกติ = 100) — หมวดที่ยังไม่มีคะแนนบวก 0 (บอกว่า "เก็บได้แล้วกี่คะแนนจากเต็ม")
   - ยังไม่มีคะแนนเลยทุกหมวด → `current_pct` แสดง "ยังไม่มีคะแนน" ; `accumulated = 0`

ตัวอย่าง: แบบทดสอบ 30% / งาน 30% / สอบปลายภาค 40%
- หมวดแบบทดสอบมี 2 ช่อง (10 + 10) ทำช่องแรกได้ 8 ช่องสองยังไม่มีคะแนน → `category_pct = 8/10 = 80%` (ไม่ตกเป็น 40%)
- งาน `category_pct = 90%` ; สอบปลายภาคยังไม่มีคะแนน (ไม่อยู่ใน `C*`)
- **ผลการเรียนตอนนี้** = (80×30 + 90×30) / (30+30) = **85%** ; **คะแนนสะสม** = 24 + 27 = **51 จาก 100**

- ผู้เรียนที่ไม่ส่งงาน/ไม่ทำแบบทดสอบ → ผู้สอนกรอก 0 เอง (UC-13) ช่องนั้นจึงถูกนับ
- ผลรวม `weight_percent` ไม่ครบ 100 → แสดงพร้อมป้ายเตือน ; คะแนนสะสมแสดง "จาก Σweight" ตามจริง (ไม่ normalize) ส่วนผลการเรียนตอนนี้เทียบเป็น 100 เสมอ
- เมื่อทุกหมวดมีคะแนนครบ และน้ำหนักรวม = 100 → สองตัวเลขเท่ากัน
- หน้าคะแนนของผู้เรียน: ช่องที่ยังไม่มี `Score` แสดงสถานะ "ยังไม่มีคะแนน" (UC-18)

---

## 10. Announcements / Audit

### `Announcement` — รายงานตาราง 4.20

| field | type | หมายเหตุ |
|---|---|---|
| `course` | FK → `Course`, `CASCADE` | |
| `author` | FK → `User`, `SET_NULL`, `null=True` | |
| `title` | Char | บังคับ |
| `body` | Text | บังคับ **(Markdown)** |
| `is_published` | Bool, default `False` | |
| `published_at` | datetime, `null=True` | |

> ผู้สอนสร้าง แก้ไข **ลบ** ประกาศได้ ; ผู้เรียนเห็นประกาศในรายวิชาและที่หน้าภาพรวม เรียงตาม `published_at` ล่าสุด (UC-14 / UC-19)
> ไม่มีระบบแจ้งเตือนรายบุคคล / สถานะอ่าน-ยังไม่อ่าน ใน MVP (ดู §13)

### `AuditLog` — รายงานตาราง 4.21

| field | type | หมายเหตุ |
|---|---|---|
| `actor` | FK → `User`, `SET_NULL`, `null=True` | ผู้กระทำ — null = ระบบ ; **กรณีดำเนินการแทนผู้สอน = ผู้ดูแลระบบ** |
| `action` | Char choices: `create` / `update` / `delete` / `close_course` / `enroll` / `unenroll` / `grade` / `impersonate_start` / `impersonate_end` | |
| `content_type` | FK → `ContentType`, `null=True` | ชนิดตารางเป้าหมาย (ตารางระบบ Django) |
| `object_id` | Char, `null=True` | รหัสระเบียนเป้าหมาย |
| `object_repr` | Char | ข้อความแสดงระเบียน ณ เวลาที่บันทึก |
| `changes` | JSONB, `null=True` | `{"field": [old, new]}` ; null = ไม่มีการเปลี่ยนข้อมูล (เช่น การจำลองมุมมอง) |
| `created_at` | datetime, **db_index** | **มีเฉพาะ `created_at`** |
| — | index | `(content_type, object_id)` |

**เหตุการณ์ที่บันทึก** (รายงานตาราง 4.21 / §3.2 ข้อ 11):
- การจัดการบัญชีผู้ใช้ (สร้าง / แก้ไข / ระงับ / เปิดใช้งาน / เปลี่ยนบทบาท) → `create` / `update`
- การสร้าง แก้ไข และปิดรายวิชา → `create` / `update` / `close_course`
- การลงทะเบียนและการถอนผู้เรียน → `enroll` / `unenroll`
- การบันทึกและแก้ไขคะแนน (`Score`, การตรวจ `Submission` / `QuizAttempt` ด้วยมือ) → `grade`
- **การลบข้อมูลจริง** (กู้คืนไม่ได้): Quiz, Assignment, Module, Content, Announcement, GradingCategory, GradeItem ที่กรอกเอง → `delete` (`object_repr` เก็บชื่อไว้เป็นหลักฐาน)
- การดำเนินการแทนผู้สอนของผู้ดูแลระบบ → action ตามเหตุการณ์ โดย `actor` = ผู้ดูแลระบบ (หน้าจอประวัติแสดงหมายเหตุใต้ชื่อผู้กระทำ)
- การเริ่ม/สิ้นสุดการจำลองมุมมอง → `impersonate_start` / `impersonate_end` (`changes` = null)

**การจำลองมุมมอง (Role Impersonation)**: **ดูได้อย่างเดียว** — ปุ่มทำรายการ (ทำแบบทดสอบ, ส่งงาน ฯลฯ) ถูกปิด ; จำลองได้เฉพาะผู้สอน/ผู้เรียนที่ยังใช้งานได้ (ไม่ได้กับผู้ดูแลระบบหรือบัญชีที่ถูกระงับ) (UC-05)
**ใครอ่าน**: ผู้ดูแลระบบเท่านั้น — กรองตามช่วงวันที่ ประเภทข้อมูล การกระทำ (UC-06)

---

## 11. บันทึกการตัดสินใจ

### v2.0 (2026-10-04) — ปรับตามรายงานบทที่ 1–5

| ประเด็น | v1.3 (เดิม) | ✅ v2.0 (ตามรายงาน) |
|---|---|---|
| จำนวนตาราง | 25 | **20** (ตาราง 4.2) |
| ภาคเรียน | ตาราง `Term` | `Course.academic_year` + `Course.semester` |
| ผู้สอน | `CourseTeacher` (owner/co_teacher/ta) M2M | **`Course.teacher` FK — 1 วิชา 1 ผู้สอน** ; ผู้ดูแลระบบทำแทนได้ |
| ปิดรายวิชา | ไม่มี archive | **`Course.is_closed`** (ผู้เรียนดูย้อนหลังอย่างเดียว) + action `close_course` |
| รหัสวิชาซ้ำ | unique `(term, code, section)` | **unique `(academic_year, semester, code)`** — ไม่ซ้ำภายในภาคเดียวกัน ; ไม่มี `section` (รายงานเดิมเขียน "ไม่ซ้ำกับวิชาที่ยังไม่ปิด" → ต้องแก้รายงาน) |
| รหัสเข้าร่วม | `self_enroll_enabled`, `invite_code` | **`join_code_enabled`, `join_code`** (สุ่ม แยกจากรหัสวิชา สร้างใหม่ได้) |
| สมัครใช้งาน | สมัครเอง + ยืนยันอีเมล (`EmailVerificationToken`, `is_email_verified`) | **ไม่มี** — ผู้ดูแลระบบสร้างทุกบัญชี |
| ชื่ออังกฤษ | `first_name_en`, `last_name_en` | ไม่มี |
| Enrollment | status 4 ค่า + `method` | **`active` / `dropped`** ; `enrolled_by` null = เข้าร่วมด้วยรหัส |
| Content | `available_from`, `video_source`, `video_url` | ไม่มี — วิดีโออัปโหลดใช้ `file_url`, YouTube ใช้ `external_url` |
| Quiz | `is_timed`, `attempt_policy`, `max_score`, `shuffle_questions`, `show_correct_answers` | **`time_limit_minutes` null = ไม่จับเวลา ; `max_attempts` 1 = ครั้งเดียว / >1 = เก็บสูงสุด** ; คะแนนเต็ม = Σ points |
| dropdown | เลือก 1 ตัว (เหมือน mcq) | **หลายช่องว่าง `[1]`, `[2]`** + `Choice.blank_no` ; คิดคะแนนตามสัดส่วนช่องที่ถูก |
| short_answer | auto (`accepted_answers`) หรือ manual | **ผู้สอนตรวจเองเสมอ** |
| Question | `explanation`, `shuffle_choices`, `accepted_answers`, `manual_grading` | ไม่มี |
| Answer | `selected_choice`, `graded_by`, `graded_at` | ไม่มี |
| QuizAttempt | `max_score` snapshot, soft delete | ไม่มี |
| ส่งช้า | `accept_with_penalty` + หัก % อัตโนมัติ + `accept_until` | **`accept_late` — ทำเครื่องหมายอย่างเดียว ผู้สอนหักเอง** |
| ส่งซ้ำ | แถวใหม่ต่อครั้ง (`attempt_number`, `is_latest`) | **1 ระเบียนต่อคน — แทนที่ไฟล์เดิม** ก่อนกำหนดส่งและก่อนตรวจ |
| Submission | `draft`/`returned`, `text_response`, `raw/penalty/final_score`, `days_late` | **`submitted`/`graded`, `note`, `score`** |
| ข้อจำกัดไฟล์งาน | `allowed_file_types`, `max_file_size_mb`, `max_files`, `allow_resubmission`, `available_from` | ไม่มีใน Assignment |
| GradeItem | `source_type`, `weight_within_category`, `is_published` | ไม่มี — ที่มาดูจาก FK ; ถ่วงตาม `max_score` ; ผู้เรียนเห็นคะแนนทันที |
| คะแนนรวม | `CourseGrade` cache บังคับมี | **คำนวณสดทุกครั้ง ไม่เก็บ** |
| ลบข้อมูล | soft delete `Submission`/`QuizAttempt`/`Score` | **ไม่มี soft delete** ; ลบ quiz/งานที่มีข้อมูลผู้เรียนไม่ได้ → ยกเลิกเผยแพร่ |
| ประกาศ | `is_pinned` + `AnnouncementRead` | ไม่มี |
| แจ้งเตือน | `Notification` (web) | ไม่มี |
| AuditLog | `impersonated_by`, `context` ; action รวม `login`/`logout`/`publish`/`regrade` | ไม่มี 2 field นั้น ; action = 9 ค่าตาม §10 ; จำลองมุมมองแบบดูอย่างเดียว |
| ออกจากระบบ | — | blacklist Refresh Token (Simple JWT `token_blacklist`) |

### v2.1 (2026-10-04) — ตัดสินประเด็นที่รายงานไม่ระบุชัด

| ประเด็น | ✅ สรุป | ต้องแก้รายงาน? |
|---|---|---|
| ลบ Quiz/Assignment | ลบจริงได้เฉพาะที่ไม่เคยเผยแพร่ (ไม่มี `GradeItem` + ไม่มีข้อมูลผู้เรียน) ; เคยเผยแพร่ → ยกเลิกเผยแพร่ | ไม่จำเป็น (รายงานเข้มน้อยกว่า ไม่ขัด) |
| `matching` | คะแนนบางส่วนตามสัดส่วนคู่ที่ถูก (เหมือน dropdown) | **ควรเติม** ใน UC-16 ขั้นที่ 5 |
| ช่องที่ยังไม่มีคะแนน | **ไม่นับ** ในคะแนนรวม (นับเฉพาะช่องที่มีคะแนนแล้ว) | **ควรเติม** ในคำอธิบายตาราง 4.17/4.18 |
| หมวดที่ยังไม่มีคะแนนเลย | แสดง **2 ตัวเลข**: ผลการเรียนตอนนี้ (% เทียบเฉพาะหมวดที่มีคะแนน) + คะแนนสะสม (จาก 100) | **ควรเติม** ในตาราง 4.17, UC-18, หน้าจอ 5.2 / 5.9 |
| รหัสวิชาซ้ำ | unique `(academic_year, semester, code)` | **ต้องแก้** ตาราง 4.4 + UC-07 Alternate Flow |
| regrade | ไม่ทำใน MVP (§13) | ไม่ต้อง |
| ข้อจำกัดไฟล์ / ผู้ให้บริการเก็บไฟล์ | **ยังไม่กำหนด** (อาจเปลี่ยน cloud) — field เป็นกลาง (`file_url` + metadata) | ไม่ต้อง (รายงานเขียนกลางอยู่แล้ว) |
| ผู้สอนของวิชาที่ admin สร้าง | admin ต้องเลือกผู้สอน (`role=teacher`) ; เปลี่ยน `teacher` ได้เฉพาะ admin | **ควรเติม** ใน UC-07 |
| action `delete` | บันทึกเมื่อลบจริง: Quiz, Assignment, Module, Content, Announcement, GradingCategory, GradeItem กรอกเอง | **ควรเติม** "การลบข้อมูล" ในคำอธิบายตาราง 4.21 + §3.2 ข้อ 11 |
| รหัสผ่านแรก / ลืมรหัส | ผู้ดูแลระบบตั้งรหัสชั่วคราว + รีเซ็ตให้เมื่อลืม ; ผู้ใช้เปลี่ยนเองที่ UC-02 | ควรเติมใน UC-04 (ไม่บังคับ) |
| สร้างบัญชีจาก CSV | อยู่ใน MVP (ย้ายออกจาก §13) — ไม่แก้ schema | **ควรเติม** ใน UC-04 |
| ข้อความยาว | เก็บเป็น Markdown, render แบบ sanitize | ไม่ต้อง |
| ฟิลด์ไฟล์ (`file_url`, `avatar_url`) | **เก็บตำแหน่งไฟล์** ไม่เก็บลิงก์เต็ม — ระบบสร้างลิงก์ตอนเรียกใช้ (เปลี่ยน cloud ไม่ต้องแก้ข้อมูล) | **ควรแก้** คำอธิบาย + ตัวอย่างข้อมูลในตาราง 4.3 (`avatar_url`), 4.6, 4.14, 4.16 เป็น "ตำแหน่งไฟล์บนบริการจัดเก็บไฟล์ภายนอก (ระบบสร้างลิงก์ให้เมื่อเรียกใช้)" |

### คงไว้จาก v1.x (รายงานไม่ขัด)

| # | ประเด็น | ✅ สรุป |
|---|---|---|
| 1 | `_th` / `_en` | field เดียวทั้งระบบ ; i18n = UI chrome |
| 2 | Quiz ผูกกับอะไร | `course` บังคับ + `module` ไม่บังคับ |
| 3 | สร้าง `GradeItem` | อัตโนมัติตอน Quiz/Assignment เผยแพร่ + `is_graded=True` |
| 6 | PK | `BigAutoField` ทุกตาราง |
| — | `is_graded` | Quiz/Assignment (default `True`) |
| — | `matching` | ให้คะแนนบางส่วน `points × คู่ถูก/คู่ทั้งหมด` |
| — | timed quiz | `due_at = min(started_at + limit, available_until)` ; บังคับฝั่งเซิร์ฟเวอร์ |
| — | หมวดคะแนน | weight ≠ 100 เตือนไม่บล็อก ; ช่องที่ยังไม่จัดหมวดไม่นับ |
| — | FK hardening | `PROTECT` บนเส้นทางเข้าสู่คะแนน ; User ไม่ลบจริง |
| — | Decimal | `7,2` (คะแนน) / `5,2` (เปอร์เซ็นต์) |

**ปรับภายหลังได้** (migration ปกติ): field ใด ๆ, ตารางใหม่, choice เพิ่ม
**ปรับยาก / เลี่ยง**: เปลี่ยน cardinality ของ FK, เปลี่ยนชนิด PK

### Index ที่ต้องเพิ่มตอน implement

`Course(academic_year, semester, code)` (unique) · `Enrollment(student, status)` · `Enrollment(course, status)` · `Content(module, order)` · `Module(course, order)` · `QuizAttempt(quiz, student)` · `AuditLog(content_type, object_id)` · `Score(grade_item)`

---

## 12. ERD

ดูไฟล์ [`database-erd.md`](./database-erd.md) (diagram Mermaid แยกตามกลุ่มเดียวกับรายงานภาพที่ 4.1–4.6)

---

## 13. สิ่งที่ตั้งใจ "ไม่ทำ" ใน MVP (retrofit ได้)

| ฟีเจอร์ | วิธีเพิ่มทีหลัง | ต้นทุน |
|---|---|---|
| **ผู้สอนหลายคน / TA ต่อรายวิชา** | ตารางเชื่อม `CourseTeacher(course, user, course_role)` แทน `Course.teacher` | 🟡 กลาง (เปลี่ยน cardinality + permission) |
| **ตารางภาคเรียนแยก (`Term`)** | ตาราง `Term` + FK จาก Course ; migrate จาก `academic_year`/`semester` | 🟢 ต่ำ |
| **สมัครใช้งานเอง + ยืนยันอีเมล / ลืมรหัสผ่าน** | `User.is_email_verified` + ตาราง `EmailVerificationToken` | 🟢 ต่ำ |
| **แจ้งเตือนรายบุคคล / สถานะอ่านประกาศ / ปักหมุด** | ตาราง `Notification`, `AnnouncementRead` ; `Announcement.is_pinned` | 🟢 ต่ำ |
| **หักคะแนนส่งช้าอัตโนมัติ / เส้นตายเด็ดขาด** | `Assignment.penalty_percent_per_day`, `penalty_max_percent`, `accept_until` ; `Submission.raw_score` / `final_score` | 🟢 ต่ำ |
| **เก็บประวัติการส่งงานทุกครั้ง** | `Submission.attempt_number` + `is_latest` (เลิก unique `(assignment, student)`) | 🟡 กลาง |
| **ข้อจำกัดไฟล์ต่องาน** | `Assignment.allowed_file_types`, `max_file_size_mb`, `max_files` | 🟢 ต่ำ |
| **ตั้งเวลาปล่อยเนื้อหา** | `Content.available_from` | 🟢 ต่ำ |
| **สลับข้อ/ตัวเลือก, ตั้งเวลาแสดงเฉลย, คำอธิบายเฉลย** | `Quiz.shuffle_questions`, `show_correct_answers` ; `Question.shuffle_choices`, `explanation` | 🟢 ต่ำ |
| **ตรวจอัตนัยแบบสั้นอัตโนมัติ** | `Question.accepted_answers` + normalize แบบ Thai-aware | 🟢 ต่ำ |
| **น้ำหนักรายช่องในหมวด / เผยแพร่คะแนนเป็นรายช่อง** | `GradeItem.weight_within_category`, `is_published` | 🟢 ต่ำ |
| **cache คะแนนรวม** | ตาราง `CourseGrade` ที่ refresh จากสูตร §9 | 🟢 ต่ำ |
| **ลบงานที่ส่ง/การทำแบบทดสอบแบบกู้คืนได้** | `SoftDeleteModel` (`deleted_at`, `deleted_by`) + conditional unique | 🟡 กลาง |
| **แก้เฉลยหลังมีคนทำ (regrade)** | action `regrade` ปลดล็อก + recompute + `AuditLog` | 🟢 ต่ำ |
| **Content progress tracking** | ตาราง `ContentProgress(content, student, first_viewed_at, completed_at)` | 🟢 ต่ำ |
| **การผ่อนผันรายคน** | ตาราง `QuizException(quiz, student, extra_time_minutes, extra_attempts, available_until_override)` | 🟢 ต่ำ |
| **งานกลุ่ม** | `AssignmentGroup` + `AssignmentGroupMember` ; `Submission.group` | 🟡 กลาง |
| **เกรดตัวอักษร / GPA** | ตาราง `GradeScale` + mapping `%` → เกรด | 🟡 กลาง |

