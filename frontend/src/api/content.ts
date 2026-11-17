/**
 * ฟังก์ชันเรียก API เนื้อหารายวิชา (backend: docs/api.md §10 — ขั้น 4.3 / 4.4)
 *
 * ขั้น 4.5 (แท็บเนื้อหาของผู้สอน): ดูรายการ, เพิ่ม / แก้ / ลบ / เลื่อน / เผยแพร่หน่วย,
 *   ลบ / เลื่อน / เผยแพร่เนื้อหา
 * ขั้น 4.6 ก: เขียนข้อความ, เพิ่มลิงก์, แก้เนื้อหา, เปลี่ยนไฟล์ (ส่งผ่าน XHR เพื่อแสดงความคืบหน้า)
 * ขั้น 4.6 ข: อัปโหลดไฟล์เป็นเนื้อหาใหม่ (หน้าต่างอัปโหลดหลายไฟล์ส่งทีละไฟล์)
 * ขั้น 4.7 ก: ฉบับของผู้เรียน (หน้าบทเรียน) — ที่อยู่เดียวกับผู้สอน backend สลับคำตอบตามบทบาท
 */
import { apiFetch } from './client'
import { uploadWithProgress, type UploadOptions } from './upload'

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

/**
 * เนื้อหา 1 ชิ้นที่ผู้เรียนเห็น (`student_content` ใน docs/api.md §10.5 — ขั้น 4.7)
 * ไม่มีสถานะเผยแพร่ / ลำดับ / หน่วย / เวลา ; ปิดดาวน์โหลด → download_link = null แต่ยังมี file_link ให้เปิดดู
 * ช่องทั้งหมดนี้มีใน `Content` ของผู้สอนด้วย → ส่วนแสดงผลกลาง (pages/courses/lesson) รับได้ทั้ง 2 แบบ
 */
export type StudentContent = Pick<
  Content,
  | 'id'
  | 'title'
  | 'content_type'
  | 'body'
  | 'file_name'
  | 'file_size'
  | 'mime_type'
  | 'file_link'
  | 'download_link'
  | 'external_url'
  | 'youtube_id'
  | 'allow_download'
>

/** หน่วยการเรียนที่ผู้เรียนเห็น (`student_module`) — เฉพาะหน่วยที่เผยแพร่ ; ไม่มีเนื้อหาเผยแพร่ = contents ว่าง (กฝ1) */
export type StudentModule = {
  id: number
  title: string
  description: string
  contents: StudentContent[]
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
 * หน่วย + เนื้อหาที่เผยแพร่ของวิชา สำหรับผู้เรียน (ขั้น 4.7 ก) — ที่อยู่เดียวกับ fetchModules
 * @throws ApiError not_found (ไม่ได้เรียนอยู่ / ถูกถอน / วิชายังไม่เผยแพร่)
 */
export function fetchStudentModules(courseId: number): Promise<StudentModule[]> {
  return apiFetch<StudentModule[]>(modulesPath(courseId))
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

/** ข้อมูลที่ส่งตอนเขียนข้อความใหม่ (หัวข้อบังคับ) */
export type TextContentInput = { title: string; body: string }

/** ข้อมูลที่ส่งตอนเพิ่มลิงก์ — ไม่กรอกหัวข้อ ระบบตั้งเป็น "วิดีโอจาก YouTube" / ชื่อเว็บไซต์ */
export type LinkContentInput = { url: string; title?: string }

/**
 * ช่องที่แก้ได้ในหน้าต่างแก้ไขเนื้อหา (ส่งเฉพาะช่องที่เปลี่ยน)
 * - module = ย้ายไปต่อท้ายหน่วยนั้น ; url = แก้ลิงก์ (ชนิดต้องเดิม) ; allow_download = สวิตช์ดาวน์โหลด
 */
export type ContentChanges = Partial<{
  title: string
  body: string
  module: number
  url: string
  allow_download: boolean
}>

const moduleContentsPath = (courseId: number, moduleId: number) =>
  `${modulesPath(courseId)}${moduleId}/contents/`

/**
 * เขียนข้อความใหม่ต่อท้ายหน่วย (ยังไม่เผยแพร่)
 * @throws ApiError validation_error (title) / content_read_only / course_closed
 */
export function createTextContent(
  courseId: number,
  moduleId: number,
  data: TextContentInput,
): Promise<Content> {
  return apiFetch<Content>(`${moduleContentsPath(courseId, moduleId)}text/`, { method: 'POST', body: data })
}

/**
 * เพิ่มลิงก์ต่อท้ายหน่วย — backend ตัดสินชนิดเอง: YouTube = วิดีโอ, อื่น ๆ = ลิงก์
 * @throws ApiError validation_error (url: invalid / blank) / content_read_only / course_closed
 */
export function createLinkContent(
  courseId: number,
  moduleId: number,
  data: LinkContentInput,
): Promise<Content> {
  return apiFetch<Content>(`${moduleContentsPath(courseId, moduleId)}link/`, { method: 'POST', body: data })
}

/**
 * แก้เนื้อหา (ส่งเฉพาะช่องที่เปลี่ยน)
 * @throws ApiError validation_error / content_kind_mismatch (แก้ลิงก์แล้วชนิดเปลี่ยน) / course_closed
 */
export function updateContent(
  courseId: number,
  contentId: number,
  changes: ContentChanges,
): Promise<Content> {
  return apiFetch<Content>(`${contentsPath(courseId)}${contentId}/`, { method: 'PATCH', body: changes })
}

/**
 * อัปโหลดไฟล์ 1 ไฟล์เป็นเนื้อหาใหม่ต่อท้ายหน่วย พร้อมรายงานความคืบหน้า (ขั้น 4.6 ข)
 * หน้าต่างอัปโหลดหลายไฟล์เรียกทีละไฟล์ (กญ1) ; ระบบตั้งชนิดจากไฟล์ + หัวข้อ = ชื่อไฟล์ตัดนามสกุล
 * @throws ApiError รหัสไฟล์ (docs/api.md §10.4 — content_file_too_large มี max_bytes แนบมา) /
 *         file_upload_failed / course_closed / not_found (หน่วยถูกลบ) ;
 *         UploadAbortedError เมื่อผู้ใช้กดยกเลิก
 */
export function uploadContentFile(
  courseId: number,
  moduleId: number,
  file: File,
  options: UploadOptions = {},
): Promise<Content> {
  const form = new FormData()
  form.append('file', file)
  return uploadWithProgress<Content>(`${moduleContentsPath(courseId, moduleId)}file/`, form, options)
}

/**
 * เปลี่ยนไฟล์ของเนื้อหา (ชนิดเดิมเท่านั้น ; หัวข้อเดิมคงไว้ — กธ1) พร้อมรายงานความคืบหน้า
 * @throws ApiError รหัสไฟล์ (docs/api.md §10.4) / content_kind_mismatch / file_upload_failed ;
 *         UploadAbortedError เมื่อผู้ใช้กดหยุด
 */
export function replaceContentFile(
  courseId: number,
  contentId: number,
  file: File,
  options: UploadOptions = {},
): Promise<Content> {
  const form = new FormData()
  form.append('file', file)
  return uploadWithProgress<Content>(`${contentsPath(courseId)}${contentId}/file/`, form, options)
}
