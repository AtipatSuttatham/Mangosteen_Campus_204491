/**
 * ฟังก์ชันเรียก API เนื้อหารายวิชา (backend: docs/api.md §10 — ขั้น 4.3 / 4.4)
 *
 * ขั้น 4.5 (แท็บเนื้อหาของผู้สอน): ดูรายการ, เพิ่ม / แก้ / ลบ / เลื่อน / เผยแพร่หน่วย,
 *   ลบ / เลื่อน / เผยแพร่เนื้อหา
 * (เพิ่ม / แก้เนื้อหา + อัปโหลดไฟล์มาในขั้น 4.6 ; ฉบับของผู้เรียนในขั้น 4.7)
 */
import { apiFetch } from './client'

/** ชนิดเนื้อหา — ระบบตั้งเองจากไฟล์ / ลิงก์ และเปลี่ยนภายหลังไม่ได้ */
export type ContentKind = 'text' | 'file' | 'image' | 'video' | 'audio' | 'link'

/** เนื้อหา 1 ชิ้นที่ผู้สอน / ผู้ดูแลระบบเห็น (`content` ใน docs/api.md §10.2) */
export type Content = {
  id: number
  /** รหัสหน่วยที่อยู่ */
  module: number
  title: string
  content_type: ContentKind
  /** ข้อความ: เนื้อความ (Markdown) ; ชนิดอื่น: คำอธิบาย (ว่างได้) */
  body: string
  order: number
  is_published: boolean
  /** ชื่อไฟล์เดิม / ขนาด (ไบต์) / ชนิดไฟล์ — ไม่มีไฟล์ = '' / null / '' */
  file_name: string
  file_size: number | null
  mime_type: string
  /** ลิงก์เปิดดูไฟล์ / ลิงก์ดาวน์โหลด (ได้ชื่อเดิม) — ไม่มีไฟล์ = null */
  file_link: string | null
  download_link: string | null
  /** ลิงก์ภายนอก (ชนิดลิงก์ / วิดีโอ YouTube) */
  external_url: string
  /** รหัสวิดีโอ YouTube ; ไม่ใช่ YouTube = null */
  youtube_id: string | null
  /** ค่าที่มีผลจริง (กพ1) */
  allow_download: boolean
  /** หน้าต่างแก้ไขแสดงสวิตช์ดาวน์โหลดไหม (เฉพาะไฟล์ที่เบราว์เซอร์เปิดดูได้) */
  can_disable_download: boolean
  created_at: string
  updated_at: string
}

/** หน่วยการเรียน 1 หน่วย + เนื้อหาเรียงตามลำดับ (`module` ใน docs/api.md §10.2) */
export type Module = {
  id: number
  title: string
  description: string
  order: number
  is_published: boolean
  contents: Content[]
}

/** ข้อมูลที่ส่งตอนเพิ่ม / แก้หน่วย */
export type ModuleInput = { title: string; description: string }

/** ทิศทางการเลื่อน ↑ ↓ */
export type MoveDirection = 'up' | 'down'

/** ปุ่มจัดการของหน่วย / เนื้อหา — ส่วนต่อท้ายที่อยู่ */
export type ContentAction = 'publish' | 'unpublish'

const modulesPath = (courseId: number) => `/courses/${courseId}/modules/`
const contentsPath = (courseId: number) => `/courses/${courseId}/contents/`

/** หน่วยทั้งหมดของวิชา + เนื้อหาทุกสถานะ (ผู้สอนเจ้าของ / ผู้ดูแลระบบ) */
export function fetchModules(courseId: number): Promise<Module[]> {
  return apiFetch<Module[]>(modulesPath(courseId))
}

/**
 * เพิ่มหน่วย (ต่อท้าย ยังไม่เผยแพร่)
 * @throws ApiError validation_error (title) / content_read_only / course_closed
 */
export function createModule(courseId: number, data: ModuleInput): Promise<Module> {
  return apiFetch<Module>(modulesPath(courseId), { method: 'POST', body: data })
}

/** แก้ชื่อ / คำอธิบายหน่วย (ส่งเฉพาะช่องที่แก้) */
export function updateModule(
  courseId: number,
  moduleId: number,
  data: Partial<ModuleInput>,
): Promise<Module> {
  return apiFetch<Module>(`${modulesPath(courseId)}${moduleId}/`, { method: 'PATCH', body: data })
}

/** ลบหน่วย (เนื้อหา + ไฟล์ในหน่วยหายตาม) */
export function deleteModule(courseId: number, moduleId: number): Promise<void> {
  return apiFetch<void>(`${modulesPath(courseId)}${moduleId}/`, { method: 'DELETE' })
}

/** เผยแพร่ / ยกเลิกการเผยแพร่หน่วย */
export function runModuleAction(courseId: number, moduleId: number, action: ContentAction): Promise<Module> {
  return apiFetch<Module>(`${modulesPath(courseId)}${moduleId}/${action}/`, { method: 'POST' })
}

/** เลื่อนหน่วยขึ้น / ลง 1 ตำแหน่ง */
export function moveModule(courseId: number, moduleId: number, direction: MoveDirection): Promise<Module> {
  return apiFetch<Module>(`${modulesPath(courseId)}${moduleId}/move/`, {
    method: 'POST',
    body: { direction },
  })
}

/** ลบเนื้อหา (ไฟล์หายตาม) */
export function deleteContent(courseId: number, contentId: number): Promise<void> {
  return apiFetch<void>(`${contentsPath(courseId)}${contentId}/`, { method: 'DELETE' })
}

/** เผยแพร่ / ยกเลิกการเผยแพร่เนื้อหา */
export function runContentAction(
  courseId: number,
  contentId: number,
  action: ContentAction,
): Promise<Content> {
  return apiFetch<Content>(`${contentsPath(courseId)}${contentId}/${action}/`, { method: 'POST' })
}

/** เลื่อนเนื้อหาขึ้น / ลง 1 ตำแหน่งในหน่วย */
export function moveContent(courseId: number, contentId: number, direction: MoveDirection): Promise<Content> {
  return apiFetch<Content>(`${contentsPath(courseId)}${contentId}/move/`, {
    method: 'POST',
    body: { direction },
  })
}
