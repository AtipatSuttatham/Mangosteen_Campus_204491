# ERD — LMS (Mermaid) · v2.2

> ประกอบกับ [`database.md`](./database.md) — แยก diagram ตามกลุ่มเดียวกับรายงานภาพที่ 4.1–4.6
> GitHub render Mermaid ในไฟล์ `.md` ได้โดยตรง

## ภาพรวมความสัมพันธ์หลัก (20 ตาราง)

```mermaid
erDiagram
    USER        ||--o{ COURSE            : "teacher (1 วิชา 1 ผู้สอน)"
    COURSE      ||--o{ ENROLLMENT        : "ผู้เรียน (ตารางเชื่อม M:N)"
    USER        ||--o{ ENROLLMENT        : "student"
    COURSE      ||--o{ MODULE            : "มี"
    MODULE      ||--o{ CONTENT           : "มี"
    COURSE      ||--o{ QUIZ              : ""
    MODULE      |o--o{ QUIZ              : "แบบทดสอบท้ายบท (ไม่บังคับ)"
    COURSE      ||--o{ ASSIGNMENT        : ""
    MODULE      |o--o{ ASSIGNMENT        : "(ไม่บังคับ)"
    COURSE      ||--o{ GRADING_CATEGORY  : ""
    COURSE      ||--o{ GRADE_ITEM        : ""
    COURSE      ||--o{ ANNOUNCEMENT      : ""
    QUIZ        ||--o| GRADE_ITEM        : "auto-create (is_graded)"
    ASSIGNMENT  ||--o| GRADE_ITEM        : "auto-create (is_graded)"
    GRADING_CATEGORY ||--o{ GRADE_ITEM   : "จัดหมวด"
    GRADE_ITEM  ||--o{ SCORE             : ""
    USER        ||--o{ SCORE             : "student"
    USER        ||--o{ AUDIT_LOG         : "actor"
```

> ชื่อ/หัวข้อทุกตารางเป็น **field เดียว** (ไม่แยก `_th` / `_en`)
> ไม่มี soft delete ; Quiz/Assignment ที่มีข้อมูลผู้เรียนลบไม่ได้ → ยกเลิกเผยแพร่ ; FK เข้าสู่คะแนน = `PROTECT` ; User ไม่ลบจริง (ระงับด้วย `is_active`)
> ตารางระบบที่ไม่นับ: `django_content_type` (อ้างโดย `AUDIT_LOG.content_type`), Simple JWT `token_blacklist`

## 1. กลุ่มบัญชีผู้ใช้และรายวิชา (+ ตารางเชื่อม Enrollment)

```mermaid
erDiagram
    USER {
        bigint   id PK
        string   email UK
        string   student_or_staff_id UK "nullable"
        string   role "admin|teacher|student"
        string   first_name
        string   last_name
        bool     is_active
        string   avatar_url "nullable"
        bigint   created_by FK "nullable"
        datetime last_login
        datetime date_joined
    }
    COURSE {
        bigint   id PK
        int      academic_year
        smallint semester "1|2|3"
        bigint   teacher_id FK
        string   code "UK ร่วมกับ academic_year+semester"
        string   name
        text     description
        bool     join_code_enabled
        string   join_code UK "nullable"
        bool     is_published
        bool     is_closed
        bigint   created_by FK "nullable"
    }
    ENROLLMENT {
        bigint   id PK
        bigint   course_id FK
        bigint   student_id FK
        string   status "active|dropped"
        bigint   enrolled_by FK "nullable = เข้าร่วมด้วยรหัส"
        datetime enrolled_at
        datetime dropped_at "nullable"
    }

    USER   ||--o{ USER       : "created_by"
    USER   ||--o{ COURSE     : "teacher"
    COURSE ||--o{ ENROLLMENT : ""
    USER   ||--o{ ENROLLMENT : "student"
```

## 2. กลุ่มเนื้อหาบทเรียน

```mermaid
erDiagram
    COURSE {
        bigint id PK
    }
    MODULE {
        bigint id PK
        bigint course_id FK
        string title
        text   description
        int    order
        bool   is_published
    }
    CONTENT {
        bigint   id PK
        bigint   module_id FK
        string   title
        string   content_type "text|file|image|video|audio|link"
        text     body
        int      order
        bool     is_published
        string   file_url "nullable (file/image/audio/video อัปโหลด)"
        string   file_name "nullable"
        int      file_size "nullable"
        string   mime_type "nullable"
        string   external_url "nullable (link / YouTube)"
    }
    COURSE ||--o{ MODULE  : ""
    MODULE ||--o{ CONTENT : ""
```

## 3. กลุ่มแบบทดสอบ

```mermaid
erDiagram
    QUIZ {
        bigint   id PK
        bigint   course_id FK
        bigint   module_id FK "nullable"
        bigint   grading_category_id FK "nullable"
        string   title
        text     description
        bool     is_graded "default true"
        int      time_limit_minutes "nullable = ไม่จับเวลา"
        int      max_attempts "1=ครั้งเดียว, >1=เก็บสูงสุด, null=ไม่จำกัด"
        datetime available_from "nullable"
        datetime available_until "nullable"
        bool     is_published
        bigint   created_by FK "nullable"
    }
    QUESTION {
        bigint   id PK
        bigint   quiz_id FK
        string   question_type "mcq|true_false|matching|dropdown|short_answer"
        text     text "dropdown ใช้ [1], [2]"
        int      order
        decimal  points
    }
    CHOICE {
        bigint   id PK
        bigint   question_id FK
        int      blank_no "nullable (dropdown)"
        string   text
        bool     is_correct
        int      order
    }
    MATCHING_PAIR {
        bigint   id PK
        bigint   question_id FK
        string   left_text
        string   right_text
        int      order
    }
    QUIZ_ATTEMPT {
        bigint   id PK
        bigint   quiz_id FK "PROTECT"
        bigint   student_id FK "PROTECT"
        int      attempt_number
        string   status "in_progress|submitted|auto_submitted|graded"
        datetime started_at
        datetime due_at "nullable (snapshot)"
        datetime submitted_at "nullable"
        decimal  score "nullable"
        datetime graded_at "nullable"
        bigint   graded_by FK "nullable"
    }
    ANSWER {
        bigint   id PK
        bigint   attempt_id FK
        bigint   question_id FK
        jsonb    response
        bool     is_correct "nullable"
        decimal  points_awarded "nullable"
        text     feedback
    }

    QUIZ         ||--o{ QUESTION      : ""
    QUESTION     ||--o{ CHOICE        : "mcq/true_false/dropdown"
    QUESTION     ||--o{ MATCHING_PAIR : "matching"
    QUIZ         ||--o{ QUIZ_ATTEMPT  : ""
    QUIZ_ATTEMPT ||--o{ ANSWER        : ""
    QUESTION     ||--o{ ANSWER        : ""
```

## 4. กลุ่มงานที่มอบหมาย

```mermaid
erDiagram
    ASSIGNMENT {
        bigint   id PK
        bigint   course_id FK
        bigint   module_id FK "nullable"
        bigint   grading_category_id FK "nullable"
        bool     is_graded "default true"
        string   title
        text     description
        decimal  max_score
        datetime due_at "nullable"
        string   late_policy "closed_after_due|accept_late"
        bool     is_published
        bigint   created_by FK "nullable"
    }
    ASSIGNMENT_ATTACHMENT {
        bigint   id PK
        bigint   assignment_id FK
        string   file_url
        string   file_name
        int      file_size
        string   mime_type
    }
    SUBMISSION {
        bigint   id PK
        bigint   assignment_id FK "PROTECT"
        bigint   student_id FK "PROTECT"
        string   status "submitted|graded"
        datetime submitted_at "ล่าสุด"
        bool     is_late
        text     note
        decimal  score "nullable"
        text     feedback
        bigint   graded_by FK "nullable"
        datetime graded_at "nullable"
    }
    SUBMISSION_FILE {
        bigint   id PK
        bigint   submission_id FK
        string   file_url
        string   file_name
        int      file_size
        string   mime_type
    }

    ASSIGNMENT ||--o{ ASSIGNMENT_ATTACHMENT : ""
    ASSIGNMENT ||--o{ SUBMISSION            : "1 ระเบียน / ผู้เรียน"
    SUBMISSION ||--o{ SUBMISSION_FILE       : ""
```

## 5. กลุ่มการให้คะแนน

```mermaid
erDiagram
    COURSE {
        bigint id PK
    }
    GRADING_CATEGORY {
        bigint  id PK
        bigint  course_id FK
        string  name
        decimal weight_percent
        int     order
    }
    GRADE_ITEM {
        bigint  id PK
        bigint  course_id FK
        bigint  category_id FK "nullable, PROTECT"
        string  title
        decimal max_score
        bigint  quiz_id FK "nullable, PROTECT"
        bigint  assignment_id FK "nullable, PROTECT"
        int     order
    }
    SCORE {
        bigint  id PK
        bigint  grade_item_id FK "PROTECT"
        bigint  student_id FK "PROTECT"
        decimal raw_score "nullable"
        decimal adjusted_score "nullable"
        text    comment
        bigint  source_attempt_id FK "nullable"
        bigint  source_submission_id FK "nullable"
    }

    COURSE           ||--o{ GRADING_CATEGORY : ""
    COURSE           ||--o{ GRADE_ITEM       : ""
    GRADING_CATEGORY ||--o{ GRADE_ITEM       : ""
    GRADE_ITEM       ||--o{ SCORE            : ""
```

> คะแนนรวมแบบถ่วงน้ำหนัก **คำนวณสดจาก `SCORE` ทุกครั้ง** — ไม่มีตารางเก็บคะแนนรวม

## 6. กลุ่มประกาศข่าวสารและบันทึกการใช้งาน

```mermaid
erDiagram
    COURSE {
        bigint id PK
    }
    USER {
        bigint id PK
    }
    ANNOUNCEMENT {
        bigint   id PK
        bigint   course_id FK
        bigint   author_id FK "nullable"
        string   title
        text     body
        bool     is_published
        datetime published_at "nullable"
    }
    AUDIT_LOG {
        bigint   id PK
        bigint   actor_id FK "nullable"
        string   action "create|update|delete|close_course|enroll|unenroll|grade|impersonate_start|impersonate_end"
        int      content_type_id FK "nullable"
        string   object_id "nullable"
        string   object_repr
        jsonb    changes "nullable"
        datetime created_at "index (ไม่มี updated_at)"
    }

    COURSE ||--o{ ANNOUNCEMENT : ""
    USER   ||--o{ ANNOUNCEMENT : "author"
    USER   ||--o{ AUDIT_LOG    : "actor"
```
