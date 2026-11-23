/**
 * ตรวจ "ไฟล์ชื่อซ้ำในหน่วยเดียวกัน" ของหน้าต่างอัปโหลด (ข้อตกลงก้อน 4 ชซ1 — docs/decisions/block-4.md ;
 * ผู้ใช้เลือก 2026-11-24: ถามในแถวของไฟล์ 4 ทาง ยืนยัน / แทนที่ / เปลี่ยนชื่อ / ยกเลิก — board "อัปโหลดไฟล์ชื่อซ้ำ")
 * ฟังก์ชันล้วน ไม่มีหน้าตา — ใช้ใน useUploadQueue.ts (ตรวจตอนไฟล์ถึงคิว) และช่อง "เปลี่ยนชื่อ" ใน UploadFilesDialog.tsx
 *
 * ทำไมตรวจในหน้าเว็บ ไม่ใช่ backend: ชื่อซ้ำไม่ใช่สิ่งต้องห้าม (ปุ่ม "ยืนยัน" ยังเก็บทั้งคู่ได้) เป็นแค่คำเตือน
 * และถ้าให้ backend ตรวจ ต้องส่งไฟล์ทั้งไฟล์ (วิดีโอถึง 100 MB) ก่อนจึงจะรู้ว่าซ้ำ
 */
import type { Content } from '../../../api/content'

/** ความยาวชื่อไฟล์สูงสุด — ตรงกับ Content.file_name (max_length 255) และ clean_file_name() ใน backend/content/file_types.py */
export const MAX_FILE_NAME_LENGTH = 255

/**
 * รูปที่ใช้เทียบชื่อ: ไม่สนตัวพิมพ์เล็ก / ใหญ่ (Report.PDF = report.pdf) และจัดรูปสระ / วรรณยุกต์ไทยให้เป็นแบบเดียวกัน (NFC)
 * เพราะ macOS ส่งชื่อไฟล์ภาษาไทยแบบแยกอักขระ (NFD) — ตาเห็นเหมือนกันแต่เทียบตรง ๆ แล้วไม่เท่ากัน
 */
export function nameKey(name: string): string {
  return name.normalize('NFC').trim().toLowerCase()
}

/** เนื้อหาไฟล์รายการแรก (ตามลำดับในหน่วย) ที่ชื่อไฟล์ตรงกับ name ; ไม่มี = null — รายการนี้คือรายการที่ "แทนที่" จะเปลี่ยนไฟล์ */
export function findDuplicate(name: string, contents: readonly Content[]): Content | null {
  const key = nameKey(name)
  return contents.find((content) => content.file_name !== '' && nameKey(content.file_name) === key) ?? null
}

/** แยกชื่อไฟล์เป็น ชื่อ + นามสกุล (รวมจุด) เช่น "บทที่3.pdf" → { stem: "บทที่3", ext: ".pdf" } ; ไม่มีนามสกุล → ext = "" */
export function splitName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, dot), ext: name.slice(dot) }
}

/** ชื่อตั้งต้นของช่อง "เปลี่ยนชื่อ": เติม " (2)", " (3)" … จนไม่ซ้ำกับรายการใดในหน่วย (คืนเฉพาะส่วนชื่อ ไม่รวมนามสกุล) */
export function suggestStem(name: string, contents: readonly Content[]): string {
  const { stem, ext } = splitName(name)
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})`
    if (!findDuplicate(candidate + ext, contents)) return candidate
  }
}

/** ปัญหาของชื่อใหม่ที่ผู้ใช้พิมพ์ — ข้อความภาษาไทยอยู่ใน th.ts (content.renameProblem.*) */
export type RenameProblem = 'empty' | 'slash' | 'too_long' | 'duplicate'

/**
 * ตรวจชื่อใหม่ (ส่วนชื่อ — นามสกุลล็อกไว้ เพราะ backend ดูชนิดไฟล์จากนามสกุล)
 * - ห้ามมี / หรือ \ : backend ตัดชื่อโฟลเดอร์ทิ้ง (clean_file_name) ชื่อที่ได้จะไม่ตรงกับที่พิมพ์
 */
export function renameProblem(stem: string, ext: string, contents: readonly Content[]): RenameProblem | null {
  const trimmed = stem.trim()
  if (trimmed === '') return 'empty'
  if (/[/\\]/.test(trimmed)) return 'slash'
  if ((trimmed + ext).length > MAX_FILE_NAME_LENGTH) return 'too_long'
  if (findDuplicate(trimmed + ext, contents)) return 'duplicate'
  return null
}
