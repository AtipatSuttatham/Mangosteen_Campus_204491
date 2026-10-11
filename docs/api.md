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
| `fields` | เฉพาะ `validation_error` | รหัส error รายช่อง `{ชื่อช่อง: [รหัส, ...]}` ; ช่องซ้อนชั้นใช้จุด (`address.city`), รายการหลายแถวใช้ลำดับ (`items.1.qty`), error ที่ไม่ผูกกับช่องใดอยู่ใต้ `non_field_errors` |

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

ไม่ผ่านหลายกฎพร้อมกัน → ได้หลายรหัสในช่องเดียว เช่น `{"new_password": ["password_too_common", "password_entirely_numeric"]}`

### 3.3 รหัสเฉพาะเรื่องของระบบ (business rule)

ใช้ `ApiError` จาก `backend/common/exceptions.py`:

```python
from common.exceptions import ApiError

raise ApiError("course_code_duplicate", "Course code already exists in this term.")
raise ApiError("quiz_time_over", status_code=409)
```

- ค่าเริ่มต้น HTTP **400** ; ระบุ `status_code` ได้
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
