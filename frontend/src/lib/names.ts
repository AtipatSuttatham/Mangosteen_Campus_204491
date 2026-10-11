/**
 * ตัวช่วยเรื่องชื่อผู้ใช้
 */

/** สระที่เขียนไว้หน้าพยัญชนะในภาษาไทย (เ แ โ ใ ไ) — ไม่ใช้เป็นตัวอักษรย่อ */
const LEADING_VOWELS = /^[เแโใไ]+/

/**
 * ตัวอักษรแรกของคำหนึ่งคำ สำหรับตัวอักษรย่อ
 * ข้ามสระหน้า เช่น "เอกชัย" → "อ" (ไม่ใช่ "เ") ; ภาษาอังกฤษเป็นตัวพิมพ์ใหญ่ เช่น "somjai" → "S"
 */
function firstLetter(word: string): string {
  const trimmed = word.trim()
  const withoutVowel = trimmed.replace(LEADING_VOWELS, '')
  // ทั้งคำเป็นสระหน้าล้วน (ไม่น่าเกิด) → ใช้ตัวแรกตามเดิม
  const source = withoutVowel || trimmed
  // Array.from แยกตามตัวอักษรจริง (ไม่ตัดอักขระพิเศษบางตัวครึ่งตัว)
  return (Array.from(source)[0] ?? '').toUpperCase()
}

/**
 * ตัวอักษรย่อจากชื่อ + นามสกุล ใช้แทนรูปประจำตัวเมื่อยังไม่มีรูป (การตัดสินใจก้อน 1)
 *   "สมใจ" "รักเรียน" → "สร"
 *   "เอกชัย" "ใจดี"   → "อจ"
 * ไม่มีทั้งชื่อและนามสกุล → ใช้ตัวแรกของอีเมล (บัญชีต้องมีอีเมลเสมอ)
 */
export function initials(user: { first_name: string; last_name: string; email: string }): string {
  const fromName = firstLetter(user.first_name) + firstLetter(user.last_name)
  return fromName || firstLetter(user.email)
}
