/**
 * ฟังก์ชันเรียก API รายวิชา (backend: docs/api.md §8)
 *
 * ขั้น 3.5: รายวิชาของฉัน (ผู้สอน) + สร้างรายวิชา
 * ขั้น 3.6: ดู / แก้ / เผยแพร่ / รหัสเข้าร่วม / ปิด / ลบ — ที่อยู่ของผู้ดูแลระบบเพิ่มในขั้น 3.8
 * ขั้น 3.7: ฝั่งผู้เรียน — รายวิชาของฉัน, หัวรายวิชา, เข้าร่วมด้วยรหัส
 * ขั้น 3.8: ผู้ดูแลระบบ — รายวิชาทั้งระบบ, ภาคเรียน / ผู้สอนของตัวกรอง, สร้างแทน, เปลี่ยนผู้สอน, เปิดคืน
 */
import type { Paginated } from './adminUsers'
import { apiFetch, apiFetchWithStatus } from './client'

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
  /** รหัสผู้ใช้ของผู้สอน — ผู้ดูแลระบบต้องส่ง (สร้างแทน / เปลี่ยนผู้สอน) ; ผู้สอนห้ามส่ง */
  teacher?: number
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
  /** เปิดรายวิชาที่ปิดแล้วคืน — ผู้ดูแลระบบเท่านั้น (ขั้น 3.8) */
  | 'reopen'

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

// ---------- ฝั่งผู้เรียน (ขั้น 3.7) ----------

/**
 * รายวิชาของฉัน (ผู้เรียน): วิชาที่กำลังเรียนและเผยแพร่แล้ว รวมวิชาที่ปิดแล้ว — ข้อมูลหัวรายวิชาเท่านั้น
 * ที่อยู่เดียวกับของผู้สอน แต่ backend ส่งข้อมูลตามบทบาท
 */
export function fetchMyStudentCourses(): Promise<StudentCourse[]> {
  return apiFetch<StudentCourse[]>('/courses/')
}

/** หัวรายวิชาที่ผู้เรียนเห็น (ไม่ได้เรียนวิชานี้ / ยังไม่เผยแพร่ = 404 not_found เหมือนไม่มีวิชา) */
export function fetchStudentCourse(id: number): Promise<StudentCourse> {
  return apiFetch<StudentCourse>(`/courses/${id}/`)
}

/** ผลของการเข้าร่วมด้วยรหัส */
export type JoinResult = {
  course: StudentCourse
  /** true = เพิ่งเข้าร่วม (201) ; false = อยู่ในรายวิชานี้อยู่แล้ว (200) */
  joined: boolean
}

/**
 * เข้าร่วมรายวิชาด้วยรหัสเข้าร่วม (UC-15) — POST /api/v1/enroll/
 * @throws ApiError join_code_invalid (ทุกกรณีที่ใช้ไม่ได้ ใช้รหัสเดียว) / throttled (เกิน 10 ครั้ง/นาที)
 */
export async function joinCourse(joinCode: string): Promise<JoinResult> {
  const { data, status } = await apiFetchWithStatus<StudentCourse>('/enroll/', {
    method: 'POST',
    body: { join_code: joinCode },
  })
  return { course: data, joined: status === 201 }
}

// ---------- ผู้ดูแลระบบ (ขั้น 3.8) ----------

/** จำนวนรายวิชาต่อหน้าที่ backend ใช้ (common/pagination.py) */
export const ADMIN_COURSES_PAGE_SIZE = 20

/** สถานะที่กรองได้ในหน้าจัดการรายวิชา */
export type CourseStatusFilter = CourseState

/** ตัวกรองของหน้าจัดการรายวิชา — ไม่ระบุ = ไม่กรอง */
export type AdminCourseFilters = {
  /** คำค้น: รหัสหรือชื่อวิชา */
  search?: string
  /** ภาคเรียน "ปี-ภาค" เช่น "2569-1" */
  term?: string
  /** รหัสผู้ใช้ของผู้สอน */
  teacher?: number
  status?: CourseStatusFilter
  /** เลขหน้า (เริ่มที่ 1) */
  page?: number
}

/** แปลงตัวกรองเป็น query string ของ backend (ข้ามค่าว่าง) เช่น ?search=python&term=2569-1&page=2 */
export function adminCoursesQuery(filters: AdminCourseFilters): string {
  const params = new URLSearchParams()
  const search = filters.search?.trim()
  if (search) params.set('search', search)
  if (filters.term) params.set('term', filters.term)
  if (filters.teacher) params.set('teacher', String(filters.teacher))
  if (filters.status) params.set('status', filters.status)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * รายวิชาทั้งระบบ 1 หน้า (ภาคล่าสุดก่อน แล้วตามรหัสวิชา)
 * @throws ApiError permission_denied (ไม่ใช่ผู้ดูแลระบบ) / not_found (หน้าที่ไม่มีอยู่)
 */
export function fetchAdminCourses(filters: AdminCourseFilters): Promise<Paginated<Course>> {
  return apiFetch<Paginated<Course>>(`/admin/courses/${adminCoursesQuery(filters)}`)
}

/** ภาคเรียนที่มีรายวิชาอยู่ (ตัวเลือกของตัวกรอง "ภาคเรียน") เรียงล่าสุดก่อน */
export function fetchAdminTerms(): Promise<{ academic_year: number; semester: Semester }[]> {
  return apiFetch('/admin/courses/terms/')
}

/** ผู้สอน 1 คนในรายการตัวเลือกของผู้ดูแลระบบ (GET /admin/courses/teachers/) */
export type TeacherOption = {
  id: number
  first_name: string
  last_name: string
  /** รหัสพนักงาน ; ไม่มี = null */
  student_or_staff_id: string | null
  is_active: boolean
  /** เลือกเป็นผู้สอนของวิชาได้ไหม (บัญชีผู้สอนที่ใช้งานได้) */
  assignable: boolean
  /** จำนวนรายวิชาที่เป็นผู้สอนอยู่ (ตัวกรองแสดงเฉพาะคนที่มีวิชา) */
  course_count: number
}

/** รายชื่อผู้สอนทั้งหมด (ไม่แบ่งหน้า) เรียงตามชื่อ */
export function fetchAdminTeachers(): Promise<TeacherOption[]> {
  return apiFetch<TeacherOption[]>('/admin/courses/teachers/')
}
