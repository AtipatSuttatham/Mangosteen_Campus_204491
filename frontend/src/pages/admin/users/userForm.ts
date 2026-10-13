/**
 * ตัวช่วยของฟอร์มเพิ่ม/แก้ไขผู้ใช้ (ขั้น 2.6) — ชนิดข้อมูลในฟอร์ม, ข้อความใต้ช่อง, แปลง error จาก backend
 * แยกจากไฟล์หน้าจอเพราะไฟล์ component ควร export แต่ component (กฎ react-refresh ของ ESLint)
 */
import type { FieldErrors, UseFormSetError } from 'react-hook-form'
import type { Role } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../../api/errors'

/** ข้อมูลในฟอร์มเพิ่ม/แก้ไข (ชื่อช่องตรงกับ API — password ใช้เฉพาะตอนเพิ่ม) */
export type UserFormValues = {
  first_name: string
  last_name: string
  email: string
  /** ว่าง = ไม่มีรหัส */
  student_or_staff_id: string
  role: Role
  password: string
}

/** ช่องที่ backend อาจตอบ error รายช่องกลับมา */
const USER_FORM_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'student_or_staff_id',
  'role',
  'password',
] as const

/** ข้อความใต้ช่อง: ช่องว่าง (ตรวจในหน้าเว็บ) หรือข้อความจาก backend */
export function fieldMessage(
  errors: FieldErrors<UserFormValues>,
  field: keyof UserFormValues,
): string | undefined {
  const error = errors[field]
  if (!error) return undefined
  return error.type === 'required' ? fieldErrorMessage('required') : error.message
}

/**
 * แปลง error จากการบันทึกเป็นข้อความบนหน้าจอ
 *   - กรอกผิดรายช่อง (validation_error) → ข้อความใต้ช่องนั้น (คืน undefined)
 *   - อื่น ๆ (ติดต่อไม่ได้, cannot_modify_self ฯลฯ) → คืนข้อความรวมไว้แสดงเหนือปุ่ม
 */
export function applySaveError(
  caught: unknown,
  setError: UseFormSetError<UserFormValues>,
): string | undefined {
  if (caught instanceof ApiError && caught.code === 'validation_error') {
    let placed = false
    for (const field of USER_FORM_FIELDS) {
      const message = fieldErrorsMessage(caught.fields[field])
      if (message) {
        setError(field, { type: 'server', message })
        placed = true
      }
    }
    // backend ผิดที่ช่องที่ฟอร์มไม่มี (ไม่น่าเกิด) → แสดงเป็นข้อความรวมแทน ไม่ให้เงียบ
    return placed ? undefined : errorMessage('validation_error')
  }
  return errorMessage(caught instanceof ApiError ? caught.code : 'unknown')
}
