/**
 * ตัวเรียก API กลางของ frontend — หน้าจอทุกหน้าเรียก backend ผ่านไฟล์นี้ (อ้างอิงรูปแบบ: docs/api.md)
 *
 * หน้าที่:
 *   - ต่อที่อยู่ให้เป็น /api/v1/... อัตโนมัติ
 *   - ส่ง/รับข้อมูลเป็น JSON
 *   - ถ้าเกิด error ทุกกรณี (backend ตอบ error / ติดต่อไม่ได้ / ได้คำตอบที่อ่านไม่ออก)
 *     จะโยนเป็น ApiError รูปแบบเดียวกันเสมอ → หน้าจอนำ code ไปแปลด้วย errorMessage()
 *
 * ตัวอย่าง:
 *   const courses = await apiFetch<Course[]>('/courses/')
 *   await apiFetch('/courses/', { method: 'POST', body: { code: '204111', name: 'Python พื้นฐาน' } })
 */

/** ที่อยู่ตั้งต้นของ API ของฟีเจอร์ทั้งหมด (ตอนพัฒนา Vite ส่งต่อ /api ไปที่ backend) */
export const API_BASE = '/api/v1'

/** รหัส error รายช่อง: { ชื่อช่อง: [รหัส, ...] } เช่น { name: ['required'] } */
export type FieldErrors = Record<string, string[]>

/**
 * error ทุกชนิดจากการเรียก API (รูปแบบเดียวกับที่ backend ส่ง: code / detail / fields)
 * - status: HTTP status (0 = ติดต่อ backend ไม่ได้เลย)
 * - code: รหัส error สำหรับแปลเป็นข้อความไทย
 * - fields: รหัส error รายช่อง (มีเฉพาะ validation_error)
 * - detail: คำอธิบายภาษาอังกฤษสำหรับนักพัฒนา — ห้ามแสดงให้ผู้ใช้
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: FieldErrors
  readonly detail: string

  constructor(status: number, code: string, fields: FieldErrors = {}, detail = '') {
    super(`API error ${status}: ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.detail = detail
  }
}

/** ตัวเลือกของ apiFetch: เหมือน fetch ปกติ แต่ body ส่งเป็น object ได้เลย (แปลงเป็น JSON ให้) */
export type ApiFetchOptions = Omit<RequestInit, 'body'> & { body?: unknown }

/** ตรวจว่าข้อมูลที่ backend ส่งมามีรูปแบบ error กลาง ({ code: "..." }) หรือไม่ */
function isErrorBody(
  body: unknown,
): body is { code: string; detail?: unknown; fields?: unknown } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof (body as { code: unknown }).code === 'string'
  )
}

/** ตรวจและแปลงช่อง fields ให้เป็น FieldErrors (ข้ามค่าที่รูปแบบไม่ถูกต้อง) */
function toFieldErrors(value: unknown): FieldErrors {
  if (typeof value !== 'object' || value === null) return {}
  const result: FieldErrors = {}
  for (const [field, codes] of Object.entries(value)) {
    if (Array.isArray(codes)) {
      result[field] = codes.filter((code): code is string => typeof code === 'string')
    }
  }
  return result
}

/** เดารหัส error จาก HTTP status เมื่อ backend ไม่ได้ส่งรูปแบบ error กลางมา (เช่น proxy ตอบ 502) */
function codeFromStatus(status: number): string {
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server_error'
  return 'unknown'
}

/**
 * เรียก API ของ backend
 * @param path ที่อยู่หลัง /api/v1 เช่น '/courses/'
 * @param options method / body / headers (body เป็น object ได้เลย)
 * @returns ข้อมูล JSON ที่ backend ตอบ (หรือ undefined ถ้าไม่มีข้อมูล เช่น 204)
 * @throws ApiError ทุกกรณีที่ไม่สำเร็จ
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options
  const hasBody = body !== undefined

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      // ส่ง cookie ไปด้วยเสมอ (refresh token อยู่ใน httpOnly cookie — ก้อน 1)
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    })
  } catch {
    // ไม่มีคำตอบกลับมาเลย (backend ปิดอยู่ / เครือข่ายขัดข้อง)
    throw new ApiError(0, 'network_error')
  }

  // อ่านคำตอบเป็น JSON (ถ้าไม่มีเนื้อหาหรือไม่ใช่ JSON ได้ undefined)
  const text = await response.text()
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = undefined
    }
  }

  if (response.ok) {
    return data as T
  }

  // backend ตอบ error ในรูปแบบกลาง → ใช้รหัสที่ส่งมา
  if (isErrorBody(data)) {
    throw new ApiError(
      response.status,
      data.code,
      toFieldErrors(data.fields),
      typeof data.detail === 'string' ? data.detail : '',
    )
  }
  // ได้คำตอบที่ไม่ใช่รูปแบบกลาง (เช่น หน้า HTML จาก proxy) → เดารหัสจาก HTTP status
  throw new ApiError(response.status, codeFromStatus(response.status))
}
