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
| (ยังไม่มี — เพิ่มตอนทำฟีเจอร์) | | | |

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
