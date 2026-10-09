/**
 * แปลงรหัส error จาก API เป็นข้อความภาษาไทยจาก th.ts (กลุ่ม errors และ fieldErrors)
 *
 * ใช้คู่กับ ApiError จาก client.ts:
 *   try { await apiFetch(...) }
 *   catch (error) {
 *     if (error instanceof ApiError) {
 *       showToast(errorMessage(error.code))               // ข้อความรวม
 *       const nameError = fieldErrorMessage(error.fields.name?.[0])  // ข้อความใต้ช่อง "name"
 *     }
 *   }
 *
 * ถ้ารหัสยังไม่มีข้อความใน th.ts → ใช้ข้อความสำรอง (ผู้ใช้จะไม่เห็นรหัสดิบ)
 */
import i18n from '../i18n'
import { th } from '../i18n/locales/th'

/** รหัส error ที่มีข้อความแล้วใน th.ts */
type KnownErrorCode = keyof typeof th.errors
/** รหัส error รายช่องที่มีข้อความแล้วใน th.ts */
type KnownFieldErrorCode = keyof typeof th.fieldErrors

/** ตรวจว่ารหัส error มีข้อความใน th.ts แล้วหรือไม่ */
function isKnownErrorCode(code: string): code is KnownErrorCode {
  return Object.hasOwn(th.errors, code)
}

/** ตรวจว่ารหัส error รายช่องมีข้อความใน th.ts แล้วหรือไม่ */
function isKnownFieldErrorCode(code: string): code is KnownFieldErrorCode {
  return Object.hasOwn(th.fieldErrors, code)
}

/** ข้อความภาษาไทยของรหัส error รวม (ช่อง "code") */
export function errorMessage(code: string): string {
  return isKnownErrorCode(code) ? i18n.t(`errors.${code}`) : i18n.t('errors.unknown')
}

/** ข้อความภาษาไทยของรหัส error รายช่อง (ช่อง "fields") — ไม่มีรหัส = ไม่มีข้อความ */
export function fieldErrorMessage(code: string | undefined): string | undefined {
  if (code === undefined) return undefined
  return isKnownFieldErrorCode(code)
    ? i18n.t(`fieldErrors.${code}`)
    : i18n.t('fieldErrors.unknown')
}
