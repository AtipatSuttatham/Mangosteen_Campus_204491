/**
 * ฟังก์ชันเรียก API เข้าสู่ระบบ / ออกจากระบบ / ข้อมูลของฉัน (backend: docs/api.md §6)
 *
 * การแลก token (refresh) ไม่อยู่ที่นี่ — อยู่ใน auth/session.ts เพราะต้องกันการแลกซ้ำ
 * และ apiFetch() ต้องเรียกใช้ได้โดยไม่วนกลับมาหาตัวเอง
 */
import { apiFetch } from './client'

/** บทบาทระดับระบบ (docs/database.md §3) */
export type Role = 'admin' | 'teacher' | 'student'

/** ข้อมูลของผู้ใช้ที่เข้าสู่ระบบอยู่ (ชื่อช่องตรงกับ JSON ของ backend — snake_case) */
export type User = {
  id: number
  email: string
  student_or_staff_id: string | null
  role: Role
  first_name: string
  last_name: string
  /** ลิงก์รูปประจำตัว ; null = ไม่มีรูป (แสดงตัวอักษรย่อชื่อแทน) */
  avatar_url: string | null
}

/** คำตอบของ login / refresh: access token (ถือไว้ในหน่วยความจำ) + ข้อมูลผู้ใช้ */
export type TokenResponse = {
  access: string
  user: User
}

/**
 * เข้าสู่ระบบ — refresh token มากับ cookie (httpOnly) ให้เอง
 * @throws ApiError เช่น invalid_credentials / account_disabled / validation_error
 */
export function login(identifier: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/login/', {
    method: 'POST',
    body: { identifier, password },
    // ไม่แนบ access token และไม่พยายามแลก token เมื่อได้ 401
    auth: false,
  })
}

/** ออกจากระบบ — backend ยกเลิก refresh token และลบ cookie (สำเร็จเสมอ) */
export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout/', { method: 'POST', auth: false })
}

/** ข้อมูลล่าสุดของผู้ใช้ที่เข้าสู่ระบบอยู่ */
export function fetchMe(): Promise<User> {
  return apiFetch<User>('/auth/me/')
}
