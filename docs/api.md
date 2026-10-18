# มาตรฐาน API — Mangosteen Campus

> กติกากลางที่ API ทุกตัวต้องใช้ (วางในขั้น 0.5) — อ่านก่อนสร้าง/เรียก API ของทุกฟีเจอร์
> ใช้คู่กับ [`database.md`](./database.md) (โครงสร้างข้อมูล) และ [`database-guide.md`](./database-guide.md) (workflow)

---

## 1. ที่อยู่ (URL)

| ที่อยู่ | ใช้ทำอะไร |
|---|---|
| `/api/health/` | ตรวจสุขภาพระบบ (ของระบบ ไม่ขึ้นกับเวอร์ชัน) |
| `/api/v1/...` | **API ของฟีเจอร์ทั้งหมด** เช่น `/api/v1/courses/` |
| `/api/...` อื่น ๆ ที่ไม่มีอยู่จริง | ตอบ **404 แบบ JSON** (`{"code": "not_found"}`) ไม่ใช่หน้า HTML |
| `/admin/` | หน้า Django admin (นักพัฒนา) |

- เพิ่มเส้นทางของแต่ละ app ใน `api_v1_patterns` ที่ `backend/config/urls.py`
  ```python
  api_v1_patterns = [
      path("auth/", include("accounts.urls")),
  ]
  ```
- ลงท้ายที่อยู่ด้วย `/` เสมอ (ตามธรรมเนียม Django) เช่น `/api/v1/courses/12/`
- ฝั่ง frontend เรียกผ่าน `apiFetch('/courses/')` — ต่อ `/api/v1` ให้อัตโนมัติ

## 2. รูปแบบข้อมูล

- ส่งและรับเป็น **JSON** เท่านั้น
- เวลา: ข้อความรูปแบบ ISO 8601 เป็น **UTC** เช่น `"2026-07-25T16:59:00Z"` — frontend แสดงเป็นเวลาไทยผ่าน `formatDateTime()`
- ชื่อช่องข้อมูล: **snake_case ทั้งระบบ** (ผู้ใช้ตัดสินในขั้น 0.5) — ใช้ชื่อเดียวกับ field ใน [`database.md`](./database.md) ทุกตัว เช่น `is_published`, `file_url`, `max_attempts`
  - **ไม่มีตัวแปลงชื่อ** ระหว่าง backend กับ frontend — ชนิดข้อมูลใน TypeScript ใช้ชื่อ snake_case ตรงตาม JSON
  - ตัวอย่าง: `{ "id": 12, "code": "204111", "is_published": true, "join_code_enabled": false }`
- **รายการที่แบ่งหน้า** (ขั้น 2.3 — `common/pagination.py`, ตั้งเป็นค่าเริ่มต้นของทั้งระบบ): หน้าละ **20** รายการ ขอหน้าด้วย `?page=N` (เริ่มที่ 1) ; ขอหน้าที่ไม่มีอยู่ → 404 `not_found`
  - รูปแบบ: `{ "count": 134, "next": "…?page=3", "previous": "…?page=1", "results": [ … ] }` — `count` = จำนวนทั้งหมดทุกหน้า ; หน้าแรก `previous` = `null`, หน้าสุดท้าย `next` = `null`

## 3. รูปแบบ error กลาง

**ทุก error** จาก API ออกมาหน้าตาเดียวกัน:

```json
{
  "code": "validation_error",
  "detail": "Invalid input.",
  "fields": { "name": ["required"], "address.city": ["required"] }
}
```

| ช่อง | มีเมื่อไร | ความหมาย |
|---|---|---|
| `code` | ทุกครั้ง | **รหัส error** (ภาษาอังกฤษตัวเล็ก คั่นด้วย `_`) — frontend ใช้แปลเป็นข้อความไทย |
| `detail` | ทุกครั้ง | คำอธิบายภาษาอังกฤษ **สำหรับนักพัฒนาเท่านั้น — frontend ห้ามแสดงให้ผู้ใช้** |
| `fields` | `validation_error` และ `csv_missing_columns` | รหัส error รายช่อง `{ชื่อช่อง: [รหัส, ...]}` ; ช่องซ้อนชั้นใช้จุด (`address.city`), รายการหลายแถวใช้ลำดับ (`items.1.qty`), error ที่ไม่ผูกกับช่องใดอยู่ใต้ `non_field_errors` |
| `report` | เฉพาะ `csv_invalid` | รายงานแถวที่ผิดของไฟล์ CSV (§7.4) |

### 3.1 รหัส error รวม (ช่อง `code`)

| HTTP | `code` | เกิดเมื่อ | ข้อความไทย (`th.ts` → `errors`) |
|---|---|---|---|
| 400 | `validation_error` | กรอกข้อมูลผิด (ดูรายช่องใน `fields`) | ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง |
| 401 | `not_authenticated` | ยังไม่เข้าสู่ระบบ | กรุณาเข้าสู่ระบบ |
| 401 | `authentication_failed` | token ผิด/หมดอายุ | การยืนยันตัวตนไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง |
| 403 | `permission_denied` | ไม่มีสิทธิ์ | คุณไม่มีสิทธิ์ทำรายการนี้ |
| 404 | `not_found` | ไม่พบข้อมูล / ที่อยู่ไม่มีจริง | ไม่พบข้อมูลที่ต้องการ |
| 405 | `method_not_allowed` | ใช้ method ผิด | ไม่สามารถทำรายการนี้ได้ |
| 429 | `throttled` | ส่งคำขอถี่เกินไป | ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ |
| 500 | `server_error` | บั๊กที่ไม่คาดคิด (รายละเอียดอยู่ใน log ของเซิร์ฟเวอร์เท่านั้น) | ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง |
| — | `network_error` | (ฝั่ง frontend) ติดต่อ backend ไม่ได้เลย | ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ |
| — | รหัสที่ยังไม่มีข้อความ | — | ข้อความสำรอง: เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง |

> "ยังไม่เข้าสู่ระบบ" ตอบ **401 เสมอ** (บังคับใน `api_exception_handler`) — frontend ใช้ 401 เป็นสัญญาณว่าต้องเข้าสู่ระบบ / ขอ token ใหม่

### 3.2 รหัส error รายช่อง (ช่อง `fields`)

ใช้รหัสมาตรฐานของ Django REST Framework — ข้อความไทยอยู่ใน `th.ts` → `fieldErrors`:
`required`, `blank`, `null`, `invalid`, `max_length`, `min_length`, `max_value`, `min_value`, `unique`, `invalid_choice` (รหัสอื่น → ข้อความสำรอง "ข้อมูลช่องนี้ไม่ถูกต้อง")

รหัสรายช่องเฉพาะของระบบ (เพิ่มข้อความใน `fieldErrors` ของ `th.ts` ด้วยทุกครั้ง):

| รหัส | ช่อง | เกิดเมื่อ | เพิ่มในขั้น |
|---|---|---|---|
| `password_incorrect` | `current_password` | เปลี่ยนรหัสผ่าน: รหัสผ่านปัจจุบันไม่ถูกต้อง | 1.7 |
| `password_too_short` | `new_password` | รหัสผ่านใหม่สั้นกว่า 8 ตัว (กฎมาตรฐานของ Django) | 1.7 |
| `password_too_common` | `new_password` | รหัสผ่านใหม่อยู่ในรายการรหัสยอดนิยม | 1.7 |
| `password_entirely_numeric` | `new_password` | รหัสผ่านใหม่เป็นตัวเลขล้วน | 1.7 |
| `password_too_similar` | `new_password` | รหัสผ่านใหม่คล้ายชื่อ/อีเมลของผู้ใช้ | 1.7 |
| `duplicate_in_file` | คอลัมน์ `email` / `student_or_staff_id` ในรายงาน CSV | ค่าซ้ำกับแถวก่อนหน้าในไฟล์เดียวกัน (แถวที่ซ้ำอยู่ใน `duplicate_of`) | 2.4 |
| `csv_admin_not_allowed` | คอลัมน์ `role` ในรายงาน CSV | แถวที่บทบาทเป็นผู้ดูแลระบบ — สร้างจาก CSV ไม่ได้ | 2.4 |
| `does_not_exist` | ช่องที่เลือกจากรายการ เช่น `teacher` | รหัสที่ส่งมาไม่มีอยู่ในระบบ (รหัสมาตรฐานของ DRF) | 3.3 |
| `course_code_duplicate` | `code` | รหัสวิชาซ้ำกับวิชาอื่นในปีการศึกษา + ภาคเรียนเดียวกัน | 3.3 |
| `teacher_not_assignable` | `teacher` | ผู้สอนที่เลือกไม่ใช่บัญชีผู้สอน หรือถูกระงับ | 3.3 |

ไม่ผ่านหลายกฎพร้อมกัน → ได้หลายรหัสในช่องเดียว เช่น `{"new_password": ["password_too_common", "password_entirely_numeric"]}`

### 3.3 รหัสเฉพาะเรื่องของระบบ (business rule)

ใช้ `ApiError` จาก `backend/common/exceptions.py`:

```python
from common.exceptions import ApiError

raise ApiError("course_code_duplicate", "Course code already exists in this term.")
raise ApiError("quiz_time_over", status_code=409)
```

- ค่าเริ่มต้น HTTP **400** ; ระบุ `status_code` ได้
- แนบข้อมูลประกอบที่หน้าเว็บต้องใช้ได้ด้วย `extra` เช่น `ApiError("csv_missing_columns", extra={"fields": {...}})` → รวมเข้าไปในคำตอบ (ทับ `code` / `detail` ไม่ได้ — ขั้น 2.4)
- **เพิ่มรหัสใหม่ทุกครั้งต้องทำ 3 อย่าง:**
  1. โยน `ApiError("รหัสใหม่")` ฝั่ง backend
  2. เพิ่มข้อความไทยใน `frontend/src/i18n/locales/th.ts` → กลุ่ม `errors`
  3. เพิ่มแถวในตารางด้านล่าง

| `code` | HTTP | เกิดเมื่อ | เพิ่มในก้อน |
|---|---|---|---|
| `invalid_credentials` | 400 | เข้าสู่ระบบ: ไม่พบบัญชี หรือรหัสผ่านผิด (ข้อความรวม — ไม่บอกว่าผิดช่องไหน) | 1 |
| `account_disabled` | 403 | เข้าสู่ระบบ: รหัสผ่านถูก แต่บัญชีถูกระงับ (`is_active=False`) — บอกเฉพาะเมื่อรหัสผ่านถูก | 1 |
| `avatar_too_large` | 400 | รูปประจำตัว: ไฟล์เกิน 2 MB หรือภาพเกิน 25 ล้านพิกเซล | 1 |
| `avatar_invalid_type` | 400 | รูปประจำตัว: ไม่ใช่รูป / ไฟล์เสีย / ไม่ใช่ JPG-PNG-WebP (ตรวจจากเนื้อไฟล์) | 1 |
| `cannot_modify_self` | 403 | จัดการบัญชี: ผู้ดูแลระบบระงับ / เปิดใช้งาน / เปลี่ยนบทบาท / รีเซ็ตรหัสของบัญชีตัวเอง (§7.2) | 2 |
| `last_active_admin` | 409 | จัดการบัญชี: ระงับหรือลดบทบาทแล้วจะไม่เหลือผู้ดูแลระบบที่ใช้งานได้ (§7.2) | 2 |
| `csv_unreadable` | 400 | นำเข้า CSV: อ่านไม่ออก — ไม่ใช่ UTF-8 / TIS-620, เป็นไฟล์ชนิดอื่น (เช่น `.xlsx`, UTF-16) หรือรูปแบบ CSV เสีย (§7.4) | 2 |
| `csv_too_large` | 400 | นำเข้า CSV: ไฟล์ใหญ่เกิน 1 MB | 2 |
| `csv_too_many_rows` | 400 | นำเข้า CSV: แถวข้อมูลเกิน 500 แถว (ไม่นับหัวตารางและแถวว่าง) | 2 |
| `csv_empty` | 400 | นำเข้า CSV: ไฟล์ว่าง หรือมีแต่หัวตาราง | 2 |
| `csv_missing_columns` | 400 | นำเข้า CSV: ขาดคอลัมน์ที่บังคับ — แนบ `fields` เช่น `{"role": ["required"]}` | 2 |
| `csv_invalid` | 400 | นำเข้า CSV: กดนำเข้าแต่ยังมีแถวผิด — แนบ `report` (ไม่สร้างบัญชีใดเลย) | 2 |
| `course_closed` | 409 | รายวิชา: แก้ข้อมูล / เผยแพร่ / รหัสเข้าร่วม / ลบ วิชาที่ปิดแล้ว (§8) | 3 |
| `course_not_deletable` | 409 | รายวิชา: ลบวิชาที่เผยแพร่แล้ว หรือเคยมีผู้เรียน (รวมที่ถูกถอน) (§8) | 3 |

> token ใช้ไม่ได้ทุกแบบ (หมดอายุ / ลายเซ็นผิด / ถูกยกเลิก / บัญชีถูกระงับระหว่างใช้งาน / ออกก่อนเปลี่ยนรหัสผ่าน) ตอบ `authentication_failed` (401) รหัสเดียว — รหัสย่อยของ Simple JWT (`token_not_valid`, `user_inactive` ฯลฯ) ถูกรวมใน `api_exception_handler`

## 4. ฝั่ง frontend: เรียก API และแสดง error

```tsx
import { ApiError, apiFetch } from '../api/client'
import { errorMessage, fieldErrorMessage } from '../api/errors'

try {
  const course = await apiFetch<Course>('/courses/', { method: 'POST', body: form })
} catch (error) {
  if (error instanceof ApiError) {
    setMessage(errorMessage(error.code))                       // ข้อความรวม (ภาษาไทย)
    setNameError(fieldErrorMessage(error.fields.name?.[0]))    // ข้อความใต้ช่อง "name"
  }
}
```

- `apiFetch` โยน `ApiError` **ทุกกรณี**ที่ไม่สำเร็จ: backend ตอบ error / ติดต่อไม่ได้ (`network_error`, status 0) / ได้คำตอบที่ไม่ใช่ JSON (เดารหัสจาก HTTP status)
- `apiFetch` ส่ง cookie ไปด้วยเสมอ (`credentials: 'include'`) — สำหรับ refresh token ในก้อน 1
- **ห้ามแสดง `error.detail` ให้ผู้ใช้** — ใช้ `errorMessage(error.code)` เสมอ

## 5. CORS (frontend คนละโดเมนกับ backend)

- **ตอนพัฒนาไม่ใช้** — frontend เรียก `/api` ผ่าน proxy ของ Vite
- ตอน deploy ถ้าแยกโดเมน: ตั้ง `CORS_ALLOWED_ORIGINS` ใน `.env` (คั่นด้วยจุลภาค) เช่น `https://campus.example.com`
- ค่าเริ่มต้น = ไม่อนุญาตโดเมนใดเลย ; อนุญาตส่ง cookie (`CORS_ALLOW_CREDENTIALS`) ; ใช้กับที่อยู่ใต้ `/api/` เท่านั้น
- แนะนำให้ deploy frontend และ backend **โดเมนเดียวกัน** ถ้าทำได้ (cookie ของ refresh token ทำงานง่ายกว่า)
- **แผน deploy ที่เลือก (เบื้องต้น) ใช้โดเมนเดียวกัน** — Render service เดียว ที่ Django ส่งหน้าเว็บเอง (หรือ VM ที่มี Caddy ถ้าเปลี่ยนไปใช้ Azure) → **ไม่ต้องตั้ง `CORS_ALLOWED_ORIGINS`** ; การตั้งค่า CORS ข้างบนเก็บไว้เผื่อเปลี่ยนไปแบบแยกโดเมน (ดู [`CLAUDE.md`](../CLAUDE.md) หัวข้อ "การตัดสินใจเรื่อง deploy")

## 6. การเข้าสู่ระบบ + ข้อมูลส่วนตัว (ก้อน 1 — UC-01, UC-02)

### 6.1 token 2 ชนิด

| | access token | refresh token |
|---|---|---|
| อายุ | **15 นาที** | **7 วัน** |
| อยู่ที่ไหน | JSON ของคำตอบ → หน้าเว็บถือไว้**ในหน่วยความจำ** (หายเมื่อปิดแท็บ) | **httpOnly cookie** ชื่อ `refresh_token` (JavaScript อ่านไม่ได้) |
| ใช้ทำอะไร | แนบทุกคำขอ: header `Authorization: Bearer <access>` | แลก access token ใบใหม่ที่ `refresh/` |
| ข้อมูลข้างใน | `user_id`, `role`, `pwd` | `user_id`, `role`, `pwd` |

`pwd` = "ลายนิ้วมือของรหัสผ่าน" (16 ตัวแรกของ `get_session_auth_hash()` ของ Django — อ่านย้อนเป็นรหัสผ่านไม่ได้) ; ทุกคำขอและทุกการแลกบัตรเทียบกับรหัสผ่านปัจจุบัน → **รหัสผ่านเปลี่ยน (เปลี่ยนเอง / ผู้ดูแลระบบรีเซ็ต) บัตรเดิมทุกใบใช้ไม่ได้ทันที** (ตัวตรวจ `accounts/authentication.py` — ขั้น 1.7) ; บัตรที่ไม่มี `pwd` (ออกก่อนขั้น 1.7) ใช้ไม่ได้

cookie ตั้งค่า: `HttpOnly` ; `Path=/api/v1/auth/` (ส่งเฉพาะที่อยู่ของการยืนยันตัวตน) ; `SameSite=Strict` (เว็บอื่นส่งมาไม่ได้ — ใช้ได้เพราะ frontend/backend โดเมนเดียวกัน) ; `Secure` เมื่อ `DEBUG=False` ; อายุ 7 วัน

**ทุก API ต้องเข้าสู่ระบบเป็นค่าเริ่มต้น** (`IsAuthenticated`) — ที่อยู่ที่เปิดให้ทุกคนต้องระบุ `AllowAny` เอง (ตอนนี้: `health/`, `auth/login/`, `auth/refresh/`, `auth/logout/`)

### 6.2 ที่อยู่

| ที่อยู่ | ส่ง | สำเร็จ | ไม่สำเร็จ |
|---|---|---|---|
| `POST /api/v1/auth/login/` | `{"identifier": "...", "password": "..."}` — `identifier` มี `@` = อีเมล (ไม่สนตัวพิมพ์) ; ไม่มี = รหัสนักศึกษา/พนักงาน | 200 `{access, user}` + ตั้ง cookie | 400 `validation_error` (ไม่กรอก) / 400 `invalid_credentials` / 403 `account_disabled` |
| `POST /api/v1/auth/refresh/` | (ไม่มี body — ใช้ cookie) | 200 `{access, user}` + cookie **ใบใหม่** (ใบเก่าขึ้นบัญชีดำ — ใช้ได้ครั้งเดียว **แม้ยื่นพร้อมกันหลายคำขอ: ผ่านแค่คำขอแรก** — ขั้น 1.4.1) | 401 `authentication_failed` + ลบ cookie (ไม่มี cookie / หมดอายุ / ถูกยกเลิก / บัญชีถูกระงับ) |
| `POST /api/v1/auth/logout/` | (ไม่มี body — ใช้ cookie) | 204 + ลบ cookie + refresh token ขึ้นบัญชีดำ | — (สำเร็จเสมอ) |
| `GET /api/v1/auth/me/` | header `Authorization: Bearer <access>` | 200 `user` | 401 `not_authenticated` / `authentication_failed` |
| `PATCH /api/v1/auth/me/` | `{first_name?, last_name?, email?}` — ส่งเฉพาะช่องที่แก้ ; ตัดช่องว่างหัวท้าย ; อีเมลเก็บตัวพิมพ์เล็ก ไม่ต้องกรอกรหัสผ่าน ; ช่องอื่น (`role`, `student_or_staff_id` ฯลฯ) ไม่มีผล | 200 `user` | 400 `validation_error` เช่น `{"email": ["unique"]}` (ซ้ำแบบไม่สนตัวพิมพ์), `["invalid"]`, `{"first_name": ["blank"]}` |
| `POST /api/v1/auth/me/password/` | `{"current_password": "...", "new_password": "..."}` (ไม่ตัดช่องว่าง) | 200 `{access, user}` + cookie ใบใหม่ (เครื่องนี้อยู่ต่อ) ; refresh token ทุกใบของผู้ใช้ขึ้นบัญชีดำ + บัตรเดิมทุกใบใช้ไม่ได้ (`pwd` ไม่ตรง) → **อุปกรณ์อื่นออกทันที** | 400 `validation_error`: `current_password` → `password_incorrect` ; `new_password` → รหัสกฎ (§3.2) |
| `POST /api/v1/auth/me/avatar/` | multipart ช่อง `avatar` — JPG / PNG / WebP ≤ 2 MB | 200 `user` (`avatar_url` ใหม่) — ระบบย่อให้ไม่เกิน 512×512, บันทึกเป็น WebP ชื่อสุ่ม, ไม่มีข้อมูลแฝง (GPS ฯลฯ) ; ลบไฟล์เดิม | 400 `avatar_too_large` / `avatar_invalid_type` / `validation_error` (`{"avatar": ["required"]}`) |
| `DELETE /api/v1/auth/me/avatar/` | – | 200 `user` (`avatar_url: null`) + ลบไฟล์ ; ไม่มีรูปอยู่แล้วก็ 200 | – |

`user` = `{id, email, student_or_staff_id, role, first_name, last_name, avatar_url}` (`avatar_url` = ลิงก์รูปที่ระบบ storage สร้าง เช่น `/media/avatars/3f9c….webp` ช่วงพัฒนา หรือ `null`)

### 6.3 ลำดับการทำงานฝั่ง frontend

1. เปิดหน้าเว็บ → เรียก `refresh/` ทันที → สำเร็จ = ยังอยู่ในระบบ ; 401 = ไปหน้าเข้าสู่ระบบ
2. เรียก API ได้ 401 → เรียก `refresh/` **ครั้งเดียว** (คำขอที่ค้างพร้อมกันรอผลเดียวกัน) แล้วลองคำขอเดิมซ้ำ ; ยัง 401 = ไปหน้าเข้าสู่ระบบ
3. บัญชีถูกระงับระหว่างใช้งาน → คำขอถัดไปได้ 401 (ระบบตรวจ `is_active` ทุกคำขอ) → `refresh/` ก็ 401 → ไปหน้าเข้าสู่ระบบ
4. หลายแท็บ: การแลกบัตรทำทีละแท็บด้วย Web Locks API (refresh token ใช้ได้ครั้งเดียว) ; ออกจากระบบแท็บหนึ่ง → แท็บอื่นออกทันทีผ่าน BroadcastChannel
5. `refresh/` ได้ 5xx หรือติดต่อไม่ได้ ≠ บัตรหมดอายุ → **ไม่**ล้างการเข้าสู่ระบบ (แสดง error ตามปกติ)
6. แก้ชื่อ/อีเมล/รูป สำเร็จ → `updateUser(user)` ใช้ข้อมูลชุดใหม่ทั่วหน้าจอ + ส่ง `user-updated` ให้แท็บอื่นผ่าน BroadcastChannel (ขั้น 1.8)
7. เปลี่ยนรหัสผ่านสำเร็จ → `acceptSession({access, user})` ใช้บัตรชุดใหม่ ; แท็บอื่นของเบราว์เซอร์เดียวกันได้ 401 ในคำขอถัดไป → แลกบัตรด้วย cookie ใบใหม่ได้เอง (ไม่หลุด) ; อุปกรณ์อื่นหลุดทันที
8. อัปโหลดรูป: `apiFetch()` รับ `FormData` (ไม่ตั้ง `Content-Type` เอง — เบราว์เซอร์ใส่เส้นคั่น multipart ให้)

ทำแล้วในขั้น 1.4: `frontend/src/auth/` (session.ts, AuthProvider.tsx, guards.tsx) + `apiFetch()` ใน `frontend/src/api/client.ts`

### 6.4 งานดูแลระบบ

ตาราง token ที่หมดอายุ (`token_blacklist`) สะสมเรื่อย ๆ → ล้างด้วย `uv run python manage.py flushexpiredtokens` **ตอน deploy / ตอนเปิดเครื่อง** (ไม่ใช้งานตั้งเวลา — ข้อควรระวังข้อ 1 ใน `CLAUDE.md`)

## 7. จัดการบัญชีผู้ใช้ — ผู้ดูแลระบบ (ก้อน 2 — UC-04)

ทุกที่อยู่ในหัวข้อนี้ใช้ได้**เฉพาะผู้ดูแลระบบ** (`accounts/permissions.py` → `IsAdminRole`) — บทบาทอ่านจากฐานข้อมูลทุกคำขอ ไม่เชื่อค่า `role` ในบัตร → ลดบทบาทใครแล้ว คำขอถัดไปของคนนั้นได้ 403 ทันที (ไม่บังคับออกจากระบบ — ผู้ใช้เลือกแบบ ก ขั้น 2.3) ; ไม่ได้เข้าสู่ระบบ → 401 ; ไม่ใช่ผู้ดูแลระบบ → 403 `permission_denied`

### 7.1 ที่อยู่

| Method + ที่อยู่ | ส่งอะไร | สำเร็จ | ไม่สำเร็จ |
|---|---|---|---|
| `GET /api/v1/admin/users/` | query (ไม่บังคับ): `search` (ชื่อ / นามสกุล / ชื่อเต็ม / อีเมล / รหัส — ไม่สนตัวพิมพ์), `role` (`admin`/`teacher`/`student`), `is_active` (`true`/`false`), `page` | 200 รายการแบ่งหน้า (§2) ของ `admin_user` เรียงบัญชีใหม่สุดก่อน | 400 `validation_error` (ค่ากรองผิด → `invalid_choice`) / 404 `not_found` (หน้าที่ไม่มี) |
| `GET /api/v1/admin/users/{id}/` | – | 200 `admin_user` | 404 `not_found` |
| `POST /api/v1/admin/users/` | `{email, student_or_staff_id?, first_name, last_name, role, password}` — `student_or_staff_id` ว่าง/ไม่ส่ง = ไม่มีรหัส ; ตัดช่องว่างหัวท้าย (ยกเว้นรหัสผ่าน) ; อีเมลเก็บตัวพิมพ์เล็ก | 201 `admin_user` ; `created_by` = ผู้ดูแลระบบที่กด ; `is_staff` = false เสมอ (ไม่เข้าหน้า Django admin) | 400 `validation_error`: `unique` (อีเมลซ้ำแบบไม่สนตัวพิมพ์ / รหัสซ้ำ), `invalid`, `blank`, `required`, `invalid_choice` ; `password` → รหัสกฎ §3.2 (ความคล้ายเทียบกับบัญชีใหม่) |
| `PATCH /api/v1/admin/users/{id}/` | `{email?, student_or_staff_id?, first_name?, last_name?, role?}` — ส่งเฉพาะช่องที่แก้ ; `is_active` / `is_staff` / `password` ส่งมาไม่มีผล | 200 `admin_user` | 400 `validation_error` (เหมือนเพิ่มบัญชี) / 403 `cannot_modify_self` (เปลี่ยนบทบาทตัวเอง) / 404 / 409 `last_active_admin` |
| `POST /api/v1/admin/users/{id}/suspend/` | (ไม่มี body) | 200 `admin_user` (`is_active: false`) — ระงับอยู่แล้วก็ 200 | 403 `cannot_modify_self` / 404 / 409 `last_active_admin` |
| `POST /api/v1/admin/users/{id}/activate/` | (ไม่มี body) | 200 `admin_user` (`is_active: true`) — ใช้งานได้อยู่แล้วก็ 200 | 403 `cannot_modify_self` / 404 |
| `POST /api/v1/admin/users/import/validate/` | multipart ช่อง `file` (CSV) | 200 รายงาน (§7.4) — **ยังไม่บันทึก** ; ตอบ 200 ทั้งไฟล์ถูกและผิด | 400 `csv_*` ระดับไฟล์ (§3.3) / `validation_error` (`{"file": ["required"]}`) |
| `POST /api/v1/admin/users/import/` | multipart ช่อง `file` (ไฟล์เดิมที่ตรวจแล้ว — ส่งซ้ำ) | 201 `{created, by_role, users}` พร้อม**รหัสผ่านชั่วคราวครั้งเดียว** + `Cache-Control: no-store` (§7.4) | 400 `csv_invalid` + `report` / `csv_*` ระดับไฟล์ |
| `POST /api/v1/admin/users/{id}/password/` | `{"new_password": "..."}` (ไม่ตัดช่องว่าง) | 204 (ไม่ส่งรหัสกลับ) — refresh token ทุกใบของผู้ใช้ขึ้นบัญชีดำ + บัตรเดิมใช้ไม่ได้ (`pwd`) → **ทุกอุปกรณ์ของผู้ใช้ออกทันที** ; บัญชีที่ถูกระงับรีเซ็ตได้ | 400 `validation_error` (`new_password` → รหัสกฎ §3.2 เทียบกับเจ้าของบัญชี) / 403 `cannot_modify_self` / 404 |

`admin_user` = `{id, email, student_or_staff_id, role, first_name, last_name, is_active, avatar_url, date_joined, last_login}` (`last_login` ยังไม่เคยเข้า = `null` ; ไม่มีรหัสผ่านหรือข้อมูลภายในเช่น `is_staff`)

ไม่มีที่อยู่ "ลบบัญชี" — ผู้ใช้ไม่ลบจริง ใช้การระงับแทน (`docs/database.md` §1)

### 7.2 กันล็อกตัวเอง

- **บัญชีของตัวเอง:** ระงับ / เปิดใช้งาน / เปลี่ยนบทบาท / รีเซ็ตรหัส → 403 `cannot_modify_self` ; แก้ชื่อ / อีเมล / รหัสของตัวเองผ่าน `PATCH` **ได้** (ส่ง `role` เดิมมาด้วยก็ได้) — รีเซ็ตรหัสตัวเองไม่ได้เพราะจะเป็นทางลัดเปลี่ยนรหัสโดยไม่ต้องกรอกรหัสเดิม (ใช้ `me/password/` แทน)
- **ผู้ดูแลระบบคนสุดท้าย:** ระงับ หรือลดบทบาทผู้ดูแลระบบที่ใช้งานได้ แล้วจะไม่เหลือคนอื่น → 409 `last_active_admin` ; เพราะแก้ตัวเองไม่ได้ กรณีนี้เกิดได้จริงเฉพาะ admin 2 คนกดใส่กันพร้อมกัน → backend ล็อกแถวผู้ดูแลระบบที่ใช้งานได้ทั้งหมด (`SELECT … FOR UPDATE` เรียงตามรหัส ก่อนล็อกแถวเป้าหมาย) ให้คำขอที่สองรอคิวแล้วนับใหม่ (`lock_active_admins()` + `ensure_not_last_active_admin()` ใน `accounts/manage_views.py`)

### 7.3 สิ่งที่จดลง AuditLog

ทุกรายการจดใน transaction เดียวกับการแก้ข้อมูล (จดไม่สำเร็จ = การแก้ถูกยกเลิก) ; `actor` = ผู้ดูแลระบบที่กด ; ไม่มีอะไรเปลี่ยน = ไม่จด

| การกระทำ | `action` | `changes` |
|---|---|---|
| เพิ่มบัญชี | `create` | ค่าที่ตั้ง `{"email": [null, "..."], ..., "is_active": [null, true], "password": ["***", "***"]}` |
| แก้ไข (รวมผู้ดูแลระบบแก้บัญชีตัวเองผ่านหน้านี้ — ผู้ใช้เลือกแบบ ก ขั้น 2.3) | `update` | เฉพาะช่องที่เปลี่ยน เช่น `{"role": ["student", "teacher"]}` |
| ระงับ / เปิดใช้งาน | `update` | `{"is_active": [true, false]}` / `{"is_active": [false, true]}` |
| รีเซ็ตรหัสผ่าน | `update` | `{"password": ["***", "***"]}` |
| นำเข้า CSV (ขั้น 2.4) | `create` **1 รายการต่อบัญชี** | แบบเดียวกับเพิ่มบัญชี (ทุกรายการอยู่ใน transaction เดียวกับการสร้างทั้งไฟล์) |

> การแก้ข้อมูลตัวเองที่หน้าข้อมูลส่วนตัว (`/api/v1/auth/me/…` — UC-02) **ไม่จด**

### 7.4 นำเข้าบัญชีจาก CSV (ขั้น 2.4)

**ลำดับ:** เลือกไฟล์ → `import/validate/` (ตรวจ ยังไม่บันทึก) → ถูกทุกแถว = แสดงสรุป → กด "นำเข้า" → ส่ง**ไฟล์เดิมซ้ำ**ไปที่ `import/` → server ตรวจใหม่ทั้งหมดแล้วสร้าง**ทุกแถวใน transaction เดียว** (พลาดแถวไหน = ไม่สร้างเลย) — server ไม่เก็บไฟล์ระหว่างสองรอบ (ไม่ต้องมีงานล้างไฟล์ค้าง ; จับข้อมูลซ้ำที่เพิ่งเกิดระหว่างสองรอบได้)

**ไฟล์:**
- คอลัมน์ที่ต้องมี: `email, student_or_staff_id, first_name, last_name, role` — ไม่สนตัวพิมพ์/ช่องว่าง เรียงลำดับไหนก็ได้ ; คอลัมน์เกินไม่สนใจ ; ตัวคั่น = จุลภาค
- การเข้ารหัส: UTF-8 (มี/ไม่มี BOM) หรือ TIS-620/cp874 — ตรวจอัตโนมัติ
- ≤ 1 MB และ ≤ 500 แถวข้อมูล ; แถวว่างทั้งแถวถูกข้าม (เลขแถวยังนับตาม Excel)
- `role`: `teacher` / `student` / `ผู้สอน` / `ผู้เรียน` (ไม่สนตัวพิมพ์ — ผู้ใช้เลือกแบบ ก) ; `admin` / `ผู้ดูแลระบบ` → `csv_admin_not_allowed`
- `student_or_staff_id` ว่างได้ ; ช่องอื่นตรวจด้วยกติกาเดียวกับเพิ่มบัญชีทีละคน (§7.1)

**รายงาน** (คำตอบของ `import/validate/` และ `report` ของ `csv_invalid`):

```json
{
  "valid": false,
  "total": 120,
  "by_role": {"teacher": 2, "student": 118},
  "errors": [
    {"row": 7, "column": "email", "code": "unique", "value": "a@example.com"},
    {"row": 9, "column": "email", "code": "duplicate_in_file", "value": "b@example.com", "duplicate_of": 4}
  ],
  "preview": []
}
```

- `row` = เลขแถวแบบ Excel (หัวตาราง = 1) ; `value` = ค่าในไฟล์ (ตัดไม่เกิน 200 ตัว) ; `code` = รหัสรายช่อง §3.2 (ข้อความไทยใน `fieldErrors`) ; แต่ละช่องรายงานปัญหาแรก
- `by_role` นับจากแถวที่ระบุบทบาทถูก ; `duplicate_of` มีเฉพาะ `duplicate_in_file`
- `preview` (ขั้น 2.7 — ผู้ใช้เลือกแบบ ก 2026-10-13): **5 แถวแรกที่จะนำเข้า** สำหรับตารางตัวอย่างในหน้า "พร้อมนำเข้า" — ใช้ค่าที่ตรวจแล้ว (อีเมลตัวพิมพ์เล็ก, `role` = `student`/`teacher`, ไม่มีรหัส = `null`) เช่น `{"row": 2, "email": "a@example.com", "student_or_staff_id": "690000001", "first_name": "สมชาย", "last_name": "ใจดี", "role": "student"}` ; **มีแถวผิด = `[]`** (ยังไม่มีอะไรจะนำเข้า) ; หน้าเว็บไม่ต้องอ่านไฟล์เอง (backend อ่านที่เดียว)

**ผลการนำเข้า** (201):

```json
{
  "created": 120,
  "by_role": {"teacher": 2, "student": 118},
  "users": [
    {"row": 2, "id": 15, "email": "a@example.com", "student_or_staff_id": "690000001",
     "first_name": "สมชาย", "last_name": "ใจดี", "role": "student", "password": "<รหัสชั่วคราว>"}
  ]
}
```

- **รหัสผ่านอยู่ในคำตอบนี้ครั้งเดียว** — server เก็บแค่ค่าที่เข้ารหัสแล้ว ; หน้าเว็บ (ขั้น 2.7) สร้างไฟล์ให้ดาวน์โหลด — **ต้องกันสูตร Excel** ในไฟล์ผลลัพธ์ (ชื่อที่ขึ้นต้นด้วย `=` `+` `-` `@`)
- รหัสชั่วคราว: สุ่ม 12 ตัวด้วย `secrets` จากอักขระ 56 แบบ (ตัด `l I 1 o O 0` ; ไม่มีสัญลักษณ์) และผ่านกฎรหัสผ่าน 4 ข้อ (`accounts/passwords.py`)
- **เข้ารหัสแบบเบา** (`accounts/hashers.py` — PBKDF2 2,000 รอบ แทน 1,000,000 ; ผู้ใช้เลือกแบบ ก): ตัวหลักใช้ ~0.4 วินาทีต่อรหัส → 500 คนช้าเกินจนคำขอถูกตัดบนเครื่องฟรี ; วัดจริงแบบเบา 500 แถว ~1.2 วินาที ; รหัสสุ่ม ≈ 2^69 แบบจึงยังเดาไม่ได้ ; **ผู้ใช้เข้าสู่ระบบครั้งแรก Django เปลี่ยนเป็นตัวหลักให้อัตโนมัติ** (บัตรที่ได้จากการเข้าสู่ระบบครั้งนั้นใช้ได้ปกติ)
- บัญชีที่สร้าง: `is_staff = false`, `created_by` = ผู้ดูแลระบบที่นำเข้า ; จด AuditLog `create` ทีละบัญชี (§7.3)

## 8. รายวิชา (ก้อน 3 — UC-07)

สิทธิ์ตรวจ**ต่อรายวิชา** (`academics/access.py`): ผู้ดูแลระบบจัดการได้ทุกวิชา (ทำแทนผู้สอน — AuditLog จดชื่อผู้ดูแลระบบ) ; ผู้สอนจัดการได้เฉพาะวิชาที่ตัวเองเป็น `teacher` และยังมีบทบาทผู้สอน ; ผู้เรียนดูหัวรายวิชาได้เฉพาะวิชาที่กำลังเรียน (`Enrollment` active) และเผยแพร่แล้ว ; **ไม่มีสิทธิ์ = 404 `not_found`** (ไม่บอกว่ามีวิชานี้อยู่) ; ยังไม่เข้าสู่ระบบ = 401

### 8.1 ที่อยู่

| Method + ที่อยู่ | ใคร | ส่งอะไร | สำเร็จ | ไม่สำเร็จ |
|---|---|---|---|---|
| `GET /api/v1/courses/` | ผู้สอน / ผู้เรียน | – | 200 รายการ**ไม่แบ่งหน้า** เรียงภาคล่าสุดก่อนแล้วตามรหัส — ผู้สอน: วิชาที่สอนทุกสถานะ (`course`) ; ผู้เรียน: วิชาที่กำลังเรียนและเผยแพร่แล้ว รวมที่ปิดแล้ว (`student_course`) | 403 (ผู้ดูแลระบบ — ใช้ `admin/courses/`) |
| `POST /api/v1/courses/` | ผู้สอน / ผู้ดูแลระบบ | `{academic_year, semester, code, name, description?, teacher?}` — ผู้สอน: ห้ามส่ง `teacher` (ผู้สอน = ตัวเอง) ; ผู้ดูแลระบบ: **ต้องส่ง** `teacher` | 201 `course` (ยังไม่เผยแพร่ ไม่เปิดรหัสเข้าร่วม) ; `created_by` = ผู้กด | 400 `validation_error`: `min_value`/`max_value` (ปี 2500–2700), `invalid_choice` (ภาค), `blank`, `max_length`, `course_code_duplicate`, `teacher_not_assignable`, `does_not_exist`, `required` / 403 (ผู้เรียน, ผู้สอนส่ง `teacher`) |
| `GET /api/v1/courses/{id}/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ / ผู้เรียนที่กำลังเรียน | – | 200 `course` (ผู้เรียนได้ `student_course`) | 404 |
| `PATCH /api/v1/courses/{id}/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ | ช่องเดียวกับสร้าง (ส่งเฉพาะที่แก้) ; `teacher` = ผู้ดูแลระบบเท่านั้น | 200 `course` | 400 (เหมือนสร้าง) / 403 (ผู้สอนส่ง `teacher`) / 404 / 409 `course_closed` (วิชาปิดแล้ว — ยกเว้นผู้ดูแลระบบส่ง `teacher` อย่างเดียว) |
| `DELETE /api/v1/courses/{id}/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ | – | 204 | 404 / 409 `course_closed` / 409 `course_not_deletable` (เผยแพร่แล้ว หรือมี `Enrollment` แม้ถูกถอนแล้ว) |
| `POST /api/v1/courses/{id}/publish/` · `unpublish/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ | – | 200 `course` | 404 / 409 `course_closed` |
| `POST /api/v1/courses/{id}/close/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ | – | 200 `course` (ปิดวิชาที่ยังไม่เผยแพร่ได้ — หน้าจอแสดงปุ่มเฉพาะวิชาที่เผยแพร่แล้ว) | 404 |
| `POST /api/v1/courses/{id}/reopen/` | **ผู้ดูแลระบบ** | – | 200 `course` | 403 (ผู้สอน) / 404 |
| `POST /api/v1/courses/{id}/join-code/enable/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ | – | 200 `course` — ยังไม่มีรหัส → สุ่มให้ ; มีอยู่แล้ว → **ใช้รหัสเดิม** | 404 / 409 `course_closed` |
| `POST /api/v1/courses/{id}/join-code/disable/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ | – | 200 `course` (เก็บรหัสไว้) | 404 / 409 `course_closed` |
| `POST /api/v1/courses/{id}/join-code/regenerate/` | ผู้สอนเจ้าของ / ผู้ดูแลระบบ | – | 200 `course` — รหัสใหม่ รหัสเดิมใช้ไม่ได้ทันที (สุ่มชนกับคำขออื่นพอดี → ลองใหม่สูงสุด 3 ครั้ง) | 404 / 409 `course_closed` |
| `GET /api/v1/admin/courses/` | ผู้ดูแลระบบ | query (ไม่บังคับ): `search` (รหัส/ชื่อ), `term` (`2569-1`), `teacher` (รหัสผู้ใช้), `status` (`draft` / `published` / `closed`), `page` | 200 รายการแบ่งหน้า (§2) ของ `course` เรียงภาคล่าสุดก่อน | 400 (ตัวกรองผิดรูปแบบ) / 403 / 404 (หน้าที่ไม่มี) |
| `GET /api/v1/admin/courses/terms/` | ผู้ดูแลระบบ | – | 200 `[{academic_year, semester}, ...]` ภาคที่มีรายวิชา ไม่ซ้ำ เรียงล่าสุดก่อน (ตัวเลือกของตัวกรอง) | 403 |

ปุ่มเปลี่ยนสถานะทุกปุ่ม: สถานะเป็นแบบนั้นอยู่แล้ว → 200 เหมือนกันแต่ไม่จด AuditLog

### 8.2 รูปแบบข้อมูล

- `student_course` = `{id, academic_year, semester, code, name, description, teacher: {id, first_name, last_name, is_active}, is_closed}` — ผู้เรียนไม่เห็นรหัสเข้าร่วม / จำนวนผู้เรียน
- `course` = `student_course` + `{is_published, join_code_enabled, join_code, student_count, can_delete, closed_at, closed_by, created_at}`
  - `student_count` = ผู้เรียนที่กำลังเรียน ; `can_delete` = ยังไม่เผยแพร่ + ไม่ปิด + ไม่เคยมี `Enrollment` (หน้าจอแสดงปุ่ม "ลบ" ตามค่านี้ — backend ตรวจซ้ำตอนลบ)
  - `closed_at` / `closed_by` (ชื่อ–นามสกุล) = การปิดครั้งล่าสุด อ่านจาก AuditLog `close_course` (ไม่มี field ในตาราง — ข้อตกลงก้อน 3) ; ไม่ได้ปิดอยู่ = `null`
  - `semester`: 1 / 2 / 3 (ภาคฤดูร้อน) ; `join_code`: 8 ตัว A–Z / 2–9 ไม่มี 0 O 1 I L ; ยังไม่เคยเปิด = `null`

### 8.3 สิ่งที่จดลง AuditLog

| การกระทำ | `action` | `changes` |
|---|---|---|
| สร้างวิชา | `create` | ค่าที่ตั้ง (`teacher` เป็นรหัสผู้ใช้) |
| แก้ข้อมูล / เปลี่ยนผู้สอน | `update` | เฉพาะช่องที่เปลี่ยน |
| เผยแพร่ / ยกเลิก | `update` | `{"is_published": [false, true]}` / กลับกัน |
| ปิดรายวิชา | `close_course` | `{"is_closed": [false, true]}` |
| เปิดรายวิชาคืน | `update` | `{"is_closed": [true, false]}` |
| เปิด / ปิด / สุ่มรหัสเข้าร่วม | `update` | `{"join_code_enabled": [...], "join_code": [...]}` เฉพาะที่เปลี่ยน — **เก็บรหัสค่าจริง** (แสดงบนจอให้ทั้งห้องเห็นอยู่แล้ว ; ไม่ใช่รหัสผ่าน) |
| ลบ | `delete` | ค่าทั้งหมดก่อนลบ `{"code": ["204111", null], ...}` (`object_repr` เช่น `204111 Python พื้นฐาน (2569/1)`) |
