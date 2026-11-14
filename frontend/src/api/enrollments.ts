/**
 * ฟังก์ชันเรียก API การลงทะเบียนของวิชา 1 วิชา (backend: docs/api.md §9)
 *
 * ขั้น 3.6: รายชื่อในแท็บผู้เรียน, ค้นหาผู้เรียน, ตรวจรายการก่อนเพิ่ม, เพิ่ม, ถอน
 * ทุกที่อยู่ใช้ได้เฉพาะผู้สอนเจ้าของวิชา / ผู้ดูแลระบบ (คนอื่นได้ 404)
 */
import type { Paginated } from './adminUsers'
import { apiFetch } from './client'

/** จำนวนแถวต่อหน้าที่ backend ใช้ (common/pagination.py) */
export const ROSTER_PAGE_SIZE = 20

/** จำนวนรายการสูงสุดต่อการเพิ่ม 1 ครั้ง (ตรงกับ MAX_IDENTIFIERS ของ backend) */
export const MAX_IDENTIFIERS = 500

/** สถานะในวิชา: กำลังเรียน / ถูกถอน */
export type EnrollmentStatus = 'active' | 'dropped'

/** ข้อมูลผู้เรียนในรายชื่อ — is_active = false → ป้าย "บัญชีถูกระงับ" */
export type EnrolledStudent = {
  id: number
  first_name: string
  last_name: string
  email: string
  student_or_staff_id: string | null
  is_active: boolean
}

/** 1 แถวในแท็บผู้เรียน (`enrollment` ใน docs/api.md §9.2) */
export type Enrollment = {
  id: number
  student: EnrolledStudent
  status: EnrollmentStatus
  /** วิธีเข้าร่วม ดูจากผู้เพิ่ม */
  method: 'join_code' | 'teacher' | 'admin'
  enrolled_at: string
  dropped_at: string | null
}

/** รายชื่อแบบแบ่งหน้า + จำนวนบนปุ่มกรอง (ไม่ขึ้นกับคำค้น) */
export type Roster = Paginated<Enrollment> & {
  counts: Record<EnrollmentStatus, number>
}

/** ตัวกรองของแท็บผู้เรียน */
export type RosterFilters = {
  status: EnrollmentStatus
  search: string
  page: number
}

/** ผลค้นหาผู้เรียน 1 คน — enrollment_status: null ยังไม่อยู่ / active อยู่แล้ว / dropped เคยถูกถอน */
export type Candidate = Omit<EnrolledStudent, 'is_active'> & {
  enrollment_status: EnrollmentStatus | null
}

/** เหตุผลที่เพิ่มไม่ได้ */
export type AddFailureReason = 'not_found' | 'not_student' | 'suspended'

/** ผลตรวจรายการ 1 แถว: จะเพิ่ม / เพิ่มกลับ / อยู่แล้ว / เหตุผลที่เพิ่มไม่ได้ */
export type PreviewResult = 'add' | 'reactivate' | 'already' | AddFailureReason

/** แถวในตารางตรวจรายการ — student = null เมื่อเพิ่มไม่ได้ */
export type PreviewRow = {
  identifier: string
  result: PreviewResult
  student: EnrolledStudent | null
}

/** ผลตรวจรายการ — duplicates = รายการซ้ำที่นับครั้งเดียว (ไม่มีแถวในตาราง) */
export type EnrollmentPreview = {
  rows: PreviewRow[]
  duplicates: number
}

/** 1 คนในผลการเพิ่ม */
type AddedRow = { identifier: string; student: EnrolledStudent }

/** ผลการเพิ่ม: เพิ่มคนที่ถูกไปก่อน แล้วรายงานที่เหลือ */
export type AddStudentsResult = {
  added: AddedRow[]
  reactivated: AddedRow[]
  already: AddedRow[]
  failed: { identifier: string; reason: AddFailureReason }[]
}

/** รายชื่อในแท็บผู้เรียน */
export function fetchRoster(courseId: number, filters: RosterFilters): Promise<Roster> {
  const params = new URLSearchParams({ status: filters.status })
  const search = filters.search.trim()
  if (search) params.set('search', search)
  if (filters.page > 1) params.set('page', String(filters.page))
  return apiFetch<Roster>(`/courses/${courseId}/enrollments/?${params}`)
}

/** ค้นหาผู้เรียนเพื่อเพิ่ม (คำค้นอย่างน้อย 2 ตัวอักษร ; ได้ไม่เกิน 10 คน) */
export function searchCandidates(courseId: number, search: string): Promise<Candidate[]> {
  const params = new URLSearchParams({ search })
  return apiFetch<Candidate[]>(`/courses/${courseId}/enrollments/candidates/?${params}`)
}

/** ตรวจรายการก่อนเพิ่ม — อ่านอย่างเดียว ยังไม่เพิ่มใคร */
export function previewStudents(courseId: number, identifiers: string[]): Promise<EnrollmentPreview> {
  return apiFetch<EnrollmentPreview>(`/courses/${courseId}/enrollments/preview/`, {
    method: 'POST',
    body: { identifiers },
  })
}

/** เพิ่มผู้เรียน 1–500 คนด้วยรหัสนักศึกษาหรืออีเมล */
export function addStudents(courseId: number, identifiers: string[]): Promise<AddStudentsResult> {
  return apiFetch<AddStudentsResult>(`/courses/${courseId}/enrollments/`, {
    method: 'POST',
    body: { identifiers },
  })
}

/** ถอนผู้เรียนออกจากวิชา (ไม่ลบระเบียน — คะแนนเดิมอยู่ครบ) */
export function dropStudent(courseId: number, enrollmentId: number): Promise<Enrollment> {
  return apiFetch<Enrollment>(`/courses/${courseId}/enrollments/${enrollmentId}/drop/`, {
    method: 'POST',
  })
}
