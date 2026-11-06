/**
 * ฟังก์ชันเรียก API รายวิชา (backend: docs/api.md §8)
 *
 * ขั้น 3.5: รายวิชาของฉัน (ผู้สอน) + สร้างรายวิชา
 * ขั้น 3.6: ดู / แก้ / เผยแพร่ / รหัสเข้าร่วม / ปิด / ลบ — ที่อยู่ของผู้ดูแลระบบเพิ่มในขั้น 3.8
 */
import { apiFetch } from './client'

/** ภาคเรียน: 1 / 2 / 3 (ภาคฤดูร้อน) */
export type Semester = 1 | 2 | 3

/** ผู้สอนของวิชา (is_active = false → บัญชีผู้สอนถูกระงับ) */
export type CourseTeacher = {
  id: number
  first_name: string
  last_name: string
  is_active: boolean
}

/** ข้อมูลหัวรายวิชาที่ผู้เรียนเห็น (`student_course` ใน docs/api.md §8.2) */
export type StudentCourse = {
  id: number
  academic_year: number
  semester: Semester
  code: string
  name: string
  description: string
  teacher: CourseTeacher
  /** true = ปิดแล้ว ดูย้อนหลังได้อย่างเดียว */
  is_closed: boolean
}

/** ข้อมูลรายวิชาเต็มที่ผู้สอนเจ้าของ / ผู้ดูแลระบบเห็น (`course` ใน docs/api.md §8.2) */
export type Course = StudentCourse & {
  is_published: boolean
  join_code_enabled: boolean
  /** รหัสเข้าร่วม 8 ตัว ; ยังไม่เคยเปิด = null */
  join_code: string | null
  /** จำนวนผู้เรียนที่กำลังเรียน */
  student_count: number
  /** ลบวิชานี้ได้ไหม (ยังไม่เผยแพร่ + ไม่ปิด + ไม่เคยมีผู้เรียน) */
  can_delete: boolean
  /** เวลา / ผู้ปิดรายวิชาครั้งล่าสุด (เฉพาะตอนปิดอยู่) */
  closed_at: string | null
  closed_by: string | null
  created_at: string
}

/** สถานะของวิชาที่หน้าจอใช้ (ป้ายรหัสวิชา / ป้ายสถานะ) — ปิดแล้วสำคัญกว่าเผยแพร่ */
export type CourseState = 'published' | 'draft' | 'closed'

/** สถานะของวิชา 1 วิชา */
export function courseState(course: Pick<Course, 'is_closed' | 'is_published'>): CourseState {
  if (course.is_closed) return 'closed'
  return course.is_published ? 'published' : 'draft'
}

/**
 * รายวิชาของฉัน (ผู้สอน: วิชาที่สอนทุกสถานะ) — เรียงภาคล่าสุดก่อน แล้วตามรหัสวิชา ; ไม่แบ่งหน้า
 * @throws ApiError เช่น permission_denied (ผู้ดูแลระบบ — ใช้หน้าจัดการรายวิชาแทน)
 */
export function fetchMyCourses(): Promise<Course[]> {
  return apiFetch<Course[]>('/courses/')
}

/** ข้อมูลที่ส่งตอนสร้างรายวิชา (POST /courses/) — ผู้สอนไม่ส่ง teacher (ผู้สอน = ตัวเอง) */
export type CourseCreate = {
  academic_year: number
  semester: Semester
  code: string
  name: string
  description: string
}

/**
 * สร้างรายวิชา (ยังไม่เผยแพร่ ไม่เปิดรหัสเข้าร่วม)
 * @throws ApiError validation_error รายช่อง เช่น {"code": ["course_code_duplicate"]}
 */
export function createCourse(data: CourseCreate): Promise<Course> {
  return apiFetch<Course>('/courses/', { method: 'POST', body: data })
}

/** ข้อมูลรายวิชา 1 วิชา (ไม่มีสิทธิ์ / ไม่มีวิชานี้ = 404) */
export function fetchCourse(id: number): Promise<Course> {
  return apiFetch<Course>(`/courses/${id}/`)
}

/**
 * แก้ข้อมูลรายวิชา (ส่งเฉพาะช่องที่เปลี่ยน)
 * @throws ApiError validation_error รายช่อง / course_closed
 */
export function updateCourse(id: number, data: Partial<CourseCreate>): Promise<Course> {
  return apiFetch<Course>(`/courses/${id}/`, { method: 'PATCH', body: data })
}

/** ปุ่มจัดการสถานะของรายวิชา — ส่วนต่อท้ายที่อยู่ของแต่ละปุ่ม */
export type CourseAction =
  | 'publish'
  | 'unpublish'
  | 'close'
  | 'join-code/enable'
  | 'join-code/disable'
  | 'join-code/regenerate'

/** กดปุ่มจัดการสถานะ ; ได้ข้อมูลรายวิชาหลังเปลี่ยนกลับมา */
export function runCourseAction(id: number, action: CourseAction): Promise<Course> {
  return apiFetch<Course>(`/courses/${id}/${action}/`, { method: 'POST' })
}

/**
 * ลบรายวิชา (ยังไม่เผยแพร่ + ไม่เคยมีผู้เรียน)
 * @throws ApiError course_not_deletable / course_closed
 */
export function deleteCourse(id: number): Promise<void> {
  return apiFetch<void>(`/courses/${id}/`, { method: 'DELETE' })
}
