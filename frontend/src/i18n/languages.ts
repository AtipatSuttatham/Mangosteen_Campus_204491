/**
 * รายการภาษาที่ระบบรองรับ + การจำภาษาที่ผู้ใช้เลือกไว้ใน localStorage ของเบราว์เซอร์
 */

/** ภาษาที่รองรับ — ลำดับนี้คือลำดับปุ่มในตัวสลับภาษา */
export const SUPPORTED_LANGUAGES = ['th', 'en'] as const

/** ชนิดของรหัสภาษา: 'th' หรือ 'en' */
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

/** ภาษาเริ่มต้นของระบบ (ใช้เมื่อผู้ใช้ยังไม่เคยเลือก หรือค่าที่เก็บไว้ใช้ไม่ได้) */
export const DEFAULT_LANGUAGE: Language = 'th'

/** ชื่อช่องใน localStorage — มีชื่อโปรเจกต์นำหน้า กันชนกับเว็บอื่นที่เปิดบน localhost */
export const LANGUAGE_STORAGE_KEY = 'mangosteen.lang'

/** ตรวจว่าค่าที่ได้มาเป็นรหัสภาษาที่รองรับหรือไม่ */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

/**
 * อ่านภาษาที่ผู้ใช้เคยเลือกไว้
 * - ไม่มีค่า / ค่าไม่ถูกต้อง / เบราว์เซอร์บล็อก localStorage → ใช้ภาษาเริ่มต้น (ไทย)
 * - ไม่ใช้ภาษาของเบราว์เซอร์ (ข้อตกลง: เริ่มที่ภาษาไทยเสมอจนกว่าผู้ใช้จะเลือกเอง)
 */
export function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    // บางกรณีเบราว์เซอร์ไม่ให้ใช้ localStorage (เช่น โหมดส่วนตัวบางแบบ) → ไม่ให้แอปพัง
    return DEFAULT_LANGUAGE
  }
}

/** บันทึกภาษาที่ผู้ใช้เลือก (ถ้าบันทึกไม่ได้ก็ข้ามไป — แค่จะไม่จำค่าเมื่อเปิดใหม่) */
export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // บันทึกไม่ได้ → ไม่ต้องทำอะไร ภาษายังเปลี่ยนได้ตามปกติในรอบการใช้งานนี้
  }
}
