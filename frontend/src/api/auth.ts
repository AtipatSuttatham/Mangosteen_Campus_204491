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

/** ข้อมูลที่แก้ได้ในหน้าข้อมูลส่วนตัว (ส่งเฉพาะช่องที่แก้ก็ได้) */
export type ProfileUpdate = Partial<Pick<User, 'first_name' | 'last_name' | 'email'>>

/**
 * แก้ชื่อ-นามสกุล / อีเมลของตัวเอง (UC-02) → ข้อมูลผู้ใช้ล่าสุด
 * @throws ApiError validation_error เช่น fields.email = ['unique']
 */
export function updateProfile(changes: ProfileUpdate): Promise<User> {
  return apiFetch<User>('/auth/me/', { method: 'PATCH', body: changes })
}

/**
 * เปลี่ยนรหัสผ่าน (UC-02) → บัตรชุดใหม่ของเครื่องนี้ (เหมือนตอน login) ; อุปกรณ์อื่นออกจากระบบทันที
 * @throws ApiError validation_error เช่น fields.current_password = ['password_incorrect']
 */
export function changePassword(currentPassword: string, newPassword: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/me/password/', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  })
}

/**
 * อัปโหลด/เปลี่ยนรูปประจำตัว (ส่งเป็นไฟล์แบบ multipart ช่อง avatar) → ข้อมูลผู้ใช้ที่มีลิงก์รูปใหม่
 * @throws ApiError avatar_too_large / avatar_invalid_type
 */
export function uploadAvatar(file: File): Promise<User> {
  const form = new FormData()
  form.append('avatar', file)
  return apiFetch<User>('/auth/me/avatar/', { method: 'POST', body: form })
}

/** ลบรูปประจำตัว → ข้อมูลผู้ใช้ (avatar_url = null) */
export function deleteAvatar(): Promise<User> {
  return apiFetch<User>('/auth/me/avatar/', { method: 'DELETE' })
}
