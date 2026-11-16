/**
 * กติกาไฟล์เนื้อหาฝั่งหน้าเว็บ (ขั้น 4.6 — ผู้ใช้เลือกแบบ กย1)
 *
 * ⚠ สำเนาของกติกาใน backend: content/file_types.py (RULES) + config/settings.py
 *   (CONTENT_MAX_BYTES / CONTENT_VIDEO_MAX_BYTES) — **แก้ที่นั่นต้องแก้ที่นี่ด้วย**
 *
 * ใช้ตรวจก่อนส่ง เพื่อบอกผู้ใช้ทันทีโดยไม่ต้องรอส่งไฟล์ใหญ่ทั้งไฟล์ (เช่น วิดีโอ 312 MB ที่จะไม่ผ่านอยู่แล้ว)
 * backend ยังตรวจซ้ำทุกครั้ง รวมถึงตรวจเนื้อไฟล์จริง (magic bytes) ที่หน้าเว็บไม่ได้ตรวจ
 *
 * ใช้ใน: เปลี่ยนไฟล์ในหน้าต่างแก้ไข (ขั้น 4.6 ก) และอัปโหลดหลายไฟล์ (ขั้น 4.6 ข)
 */
import type { ContentKind } from '../../../api/content'

/** ชนิดเนื้อหาที่มาจากไฟล์ (ข้อความ / ลิงก์ไม่มีไฟล์) */
export type FileKind = Extract<ContentKind, 'file' | 'image' | 'audio' | 'video'>

/** นามสกุลที่รับ → ชนิดเนื้อหา (กข1 — ไม่รับ .html / .svg) */
const KIND_BY_EXTENSION: Record<string, FileKind> = {
  // เอกสาร
  '.pdf': 'file',
  '.docx': 'file',
  '.pptx': 'file',
  '.xlsx': 'file',
  '.txt': 'file',
  '.py': 'file',
  '.zip': 'file',
  // รูปภาพ
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  // เสียง
  '.mp3': 'audio',
  '.m4a': 'audio',
  // วิดีโอ
  '.mp4': 'video',
  '.webm': 'video',
}

/** ขนาดสูงสุด: เอกสาร / รูป / เสียง 20 MB, วิดีโอ 100 MB */
export const CONTENT_MAX_BYTES = 20 * 1024 * 1024
export const CONTENT_VIDEO_MAX_BYTES = 100 * 1024 * 1024

/** นามสกุลแบบตัวพิมพ์เล็กมีจุด เช่น "บท.PDF" → ".pdf" ; ไม่มีนามสกุล = '' */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

/** ชนิดเนื้อหาของไฟล์จากนามสกุล ; ไม่อยู่ในรายการ = null */
export function fileKindOf(name: string): FileKind | null {
  return KIND_BY_EXTENSION[fileExtension(name)] ?? null
}

/** ขนาดสูงสุดของชนิดนี้ (ไบต์) */
export function maxBytesFor(kind: FileKind): number {
  return kind === 'video' ? CONTENT_VIDEO_MAX_BYTES : CONTENT_MAX_BYTES
}

/** ค่า accept ของช่องเลือกไฟล์ — ให้หน้าต่างเลือกไฟล์ของเครื่องกรองให้ (ไม่ส่ง = ทุกชนิดที่รับ) */
export function acceptFor(kind?: FileKind): string {
  return Object.entries(KIND_BY_EXTENSION)
    .filter(([, value]) => kind === undefined || value === kind)
    .map(([extension]) => extension)
    .join(',')
}

/** ปัญหาของไฟล์ที่ตรวจเจอก่อนส่ง (หน้าจอแปลเป็นข้อความเอง) */
export type FileProblem =
  | { code: 'type_not_allowed'; extension: string }
  | { code: 'kind_mismatch'; expected: FileKind }
  | { code: 'empty' }
  | { code: 'too_large'; kind: FileKind; maxBytes: number }

/**
 * ตรวจไฟล์ก่อนส่ง ตามลำดับเดียวกับ backend: นามสกุล → (ชนิดเดิม) → ว่าง → ขนาด
 * @param expected ชนิดที่ต้องเป็น (เปลี่ยนไฟล์ = ชนิดเดิมเท่านั้น) ; ไม่ส่ง = ชนิดใดก็ได้
 * @returns ปัญหาแรกที่เจอ ; ผ่าน = null
 */
export function checkFile(file: { name: string; size: number }, expected?: FileKind): FileProblem | null {
  const kind = fileKindOf(file.name)
  if (kind === null) return { code: 'type_not_allowed', extension: fileExtension(file.name) }
  if (expected !== undefined && kind !== expected) return { code: 'kind_mismatch', expected }
  if (file.size === 0) return { code: 'empty' }
  const maxBytes = maxBytesFor(kind)
  if (file.size > maxBytes) return { code: 'too_large', kind, maxBytes }
  return null
}
