/**
 * ตัวช่วยเรื่องปีการศึกษา / ภาคเรียน (ขั้น 3.5)
 *
 * - currentTerm(): ภาคเรียนปัจจุบัน — ใช้เป็นค่าเริ่มต้นของฟอร์มสร้างรายวิชา
 *   ปฏิทินโดยประมาณของมหาวิทยาลัยไทย (ปีการศึกษาเริ่มเดือนมิถุนายน):
 *     มิ.ย.–ต.ค. = ภาค 1 ของปีนั้น · พ.ย.–มี.ค. = ภาค 2 · เม.ย.–พ.ค. = ภาคฤดูร้อน (ปีการศึกษาก่อนหน้า)
 *   เป็นแค่ค่าเริ่มต้น ผู้สอนแก้ได้เสมอ
 * - groupByTerm(): จัดรายวิชาเป็นกลุ่มตามภาคเรียน (คงลำดับที่ backend ส่งมา — ภาคล่าสุดก่อน)
 */
import type { Semester } from '../api/courses'

/** ภาคเรียน 1 ภาค */
export type Term = { academic_year: number; semester: Semester }

/** ส่วนต่างของปี พ.ศ. กับ ค.ศ. */
const BUDDHIST_ERA_OFFSET = 543

/** ภาคเรียนปัจจุบันตามวันที่ (เวลาประเทศไทย) */
export function currentTerm(now: Date = new Date()): Term {
  // ใช้เดือน / ปีตามเวลาประเทศไทย ไม่ขึ้นกับเขตเวลาของเครื่อง
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const year = Number(parts.find((part) => part.type === 'year')?.value) + BUDDHIST_ERA_OFFSET

  if (month >= 6 && month <= 10) return { academic_year: year, semester: 1 }
  if (month >= 11) return { academic_year: year, semester: 2 }
  if (month <= 3) return { academic_year: year - 1, semester: 2 }
  return { academic_year: year - 1, semester: 3 }
}

/** รหัสของภาคเรียน เช่น "2569-1" (ใช้เป็น key และจำค่าพับ/เปิด) */
export function termKey(term: Term): string {
  return `${term.academic_year}-${term.semester}`
}

/** กลุ่มรายวิชาของ 1 ภาคเรียน */
export type TermGroup<T> = { key: string; term: Term; items: T[] }

/** จัดรายการเป็นกลุ่มตามภาคเรียน — คงลำดับเดิม (รายการที่ภาคเดียวกันต้องอยู่ติดกัน) */
export function groupByTerm<T extends Term>(items: T[]): TermGroup<T>[] {
  const groups: TermGroup<T>[] = []
  for (const item of items) {
    const key = termKey(item)
    const last = groups.at(-1)
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, term: { academic_year: item.academic_year, semester: item.semester }, items: [item] })
  }
  return groups
}
