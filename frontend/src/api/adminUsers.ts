/**
 * ฟังก์ชันเรียก API จัดการบัญชีผู้ใช้ของผู้ดูแลระบบ (backend: docs/api.md §7)
 *
 * ขั้น 2.5: รายชื่อผู้ใช้ ; ขั้น 2.6: เพิ่ม / แก้ไข / ระงับ / เปิดใช้งาน / รีเซ็ตรหัส ; ขั้น 2.7: นำเข้า CSV
 */
import type { Role } from './auth'
import { ApiError, apiFetch } from './client'

/** ข้อมูลบัญชี 1 คนที่ผู้ดูแลระบบเห็น (`admin_user` ใน docs/api.md §7.1 — ชื่อช่อง snake_case ตรงกับ JSON) */
export type AdminUser = {
  id: number
  email: string
  student_or_staff_id: string | null
  role: Role
  first_name: string
  last_name: string
  /** false = ถูกระงับ */
  is_active: boolean
  avatar_url: string | null
  /** วันที่สร้างบัญชี (ISO 8601 เวลา UTC) */
  date_joined: string
  /** เข้าสู่ระบบล่าสุด ; ยังไม่เคย = null */
  last_login: string | null
}

/** รายการแบบแบ่งหน้าของทั้งระบบ (docs/api.md §2) */
export type Paginated<T> = {
  /** จำนวนทั้งหมด (ทุกหน้ารวมกัน) */
  count: number
  /** ลิงก์หน้าถัดไป ; หน้าสุดท้าย = null */
  next: string | null
  /** ลิงก์หน้าก่อนหน้า ; หน้าแรก = null */
  previous: string | null
  results: T[]
}

/** จำนวนรายการต่อหน้าที่ backend ใช้ (common/pagination.py) — ใช้คำนวณ "หน้า X จาก Y" */
export const ADMIN_USERS_PAGE_SIZE = 20

/** สถานะที่กรองได้: ใช้งานได้ / ถูกระงับ */
export type UserStatusFilter = 'active' | 'suspended'

/** ตัวกรองของหน้ารายชื่อ — ไม่ระบุ = ไม่กรอง */
export type AdminUserFilters = {
  /** คำค้น (ชื่อ / นามสกุล / ชื่อเต็ม / อีเมล / รหัส) */
  search?: string
  role?: Role
  status?: UserStatusFilter
  /** เลขหน้า (เริ่มที่ 1) */
  page?: number
}

/** แปลงตัวกรองเป็น query string ของ backend (ข้ามค่าว่าง) เช่น ?search=สมชาย&is_active=false&page=2 */
export function adminUsersQuery(filters: AdminUserFilters): string {
  const params = new URLSearchParams()
  const search = filters.search?.trim()
  if (search) params.set('search', search)
  if (filters.role) params.set('role', filters.role)
  // backend ใช้ is_active=true/false ; หน้าเว็บใช้ชื่อที่อ่านเข้าใจกว่า
  if (filters.status) params.set('is_active', filters.status === 'active' ? 'true' : 'false')
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * รายชื่อผู้ใช้ 1 หน้า (ใหม่สุดก่อน) ตามตัวกรอง
 * @throws ApiError เช่น permission_denied (ไม่ใช่ผู้ดูแลระบบ) / not_found (หน้าที่ไม่มีอยู่)
 */
export function fetchAdminUsers(filters: AdminUserFilters): Promise<Paginated<AdminUser>> {
  return apiFetch<Paginated<AdminUser>>(`/admin/users/${adminUsersQuery(filters)}`)
}

// ---------- ขั้น 2.6: เพิ่ม / แก้ไข / ระงับ / เปิดใช้งาน / รีเซ็ตรหัสผ่าน ----------

/** ข้อมูลที่ส่งตอนเพิ่มบัญชีทีละคน (POST /admin/users/) — รหัสนักศึกษาว่าง = ไม่มีรหัส */
export type AdminUserCreate = {
  email: string
  student_or_staff_id: string
  first_name: string
  last_name: string
  role: Role
  /** รหัสผ่านชั่วคราว (backend ตรวจกฎรหัสผ่าน 4 ข้อเสมอ) */
  password: string
}

/** ข้อมูลที่แก้ได้ (PATCH /admin/users/{id}/) — ส่งเฉพาะช่องที่เปลี่ยน */
export type AdminUserUpdate = Partial<Omit<AdminUserCreate, 'password'>>

/**
 * เพิ่มบัญชีทีละคน
 * @throws ApiError validation_error (เช่น อีเมลซ้ำ → fields.email = ['unique'])
 */
export function createAdminUser(data: AdminUserCreate): Promise<AdminUser> {
  return apiFetch<AdminUser>('/admin/users/', { method: 'POST', body: data })
}

/**
 * แก้ข้อมูลบัญชี (ส่งเฉพาะช่องที่เปลี่ยน — AuditLog จดเฉพาะช่องที่เปลี่ยนจริง)
 * @throws ApiError validation_error / cannot_modify_self (เปลี่ยนบทบาทตัวเอง) / last_active_admin
 */
export function updateAdminUser(id: number, changes: AdminUserUpdate): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/`, { method: 'PATCH', body: changes })
}

/**
 * ระงับบัญชี (ผู้ใช้ออกจากระบบทันที)
 * @throws ApiError cannot_modify_self / last_active_admin / not_found
 */
export function suspendAdminUser(id: number): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/suspend/`, { method: 'POST' })
}

/**
 * เปิดใช้งานบัญชีที่ถูกระงับ
 * @throws ApiError cannot_modify_self / not_found
 */
export function activateAdminUser(id: number): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/activate/`, { method: 'POST' })
}

/**
 * รีเซ็ตรหัสผ่าน (ทุกอุปกรณ์ของผู้ใช้ออกจากระบบทันที) — backend ตอบ 204 ไม่ส่งรหัสกลับ
 * @throws ApiError validation_error (fields.new_password = รหัสกฎรหัสผ่าน) / cannot_modify_self / not_found
 */
export async function resetAdminUserPassword(id: number, newPassword: string): Promise<void> {
  await apiFetch<void>(`/admin/users/${id}/password/`, {
    method: 'POST',
    body: { new_password: newPassword },
  })
}

// ---------- ขั้น 2.7: นำเข้าบัญชีจาก CSV (docs/api.md §7.4) ----------

/** คอลัมน์ที่ไฟล์ CSV ต้องมี (ลำดับนี้ใช้ในไฟล์ตัวอย่างและไฟล์รหัสผ่าน) */
export const CSV_COLUMNS = [
  'email',
  'student_or_staff_id',
  'first_name',
  'last_name',
  'role',
] as const
export type CsvColumn = (typeof CSV_COLUMNS)[number]

/** บทบาทที่สร้างจาก CSV ได้ (ผู้ดูแลระบบสร้างทีละคนเท่านั้น) */
export type CsvRole = Exclude<Role, 'admin'>

/** ปัญหา 1 ช่องในไฟล์ (row = เลขแถวแบบ Excel) */
export type CsvRowError = {
  row: number
  column: CsvColumn
  /** รหัสรายช่อง เช่น unique / blank / duplicate_in_file (ข้อความไทยอยู่ใน th.ts) */
  code: string
  /** ค่าในไฟล์ (ตัดไม่เกิน 200 ตัว) */
  value: string
  /** มีเฉพาะ duplicate_in_file: แถวก่อนหน้าที่ใช้ค่าเดียวกัน */
  duplicate_of?: number
}

/** แถวตัวอย่างที่จะนำเข้า (ค่าที่ backend ตรวจแล้ว) */
export type CsvPreviewRow = {
  row: number
  email: string
  student_or_staff_id: string | null
  first_name: string
  last_name: string
  role: CsvRole
}

/** รายงานการตรวจไฟล์ (ยังไม่บันทึก) */
export type CsvReport = {
  /** ถูกทุกแถวหรือไม่ */
  valid: boolean
  /** จำนวนแถวข้อมูล */
  total: number
  by_role: Record<CsvRole, number>
  errors: CsvRowError[]
  /** 5 แถวแรกที่จะนำเข้า (มีแถวผิด = []) */
  preview: CsvPreviewRow[]
}

/** บัญชีที่สร้างจากไฟล์ + รหัสผ่านชั่วคราว (ส่งมาครั้งเดียว) */
export type ImportedUser = Omit<CsvPreviewRow, 'row'> & { row: number; id: number; password: string }

/** ผลการนำเข้า */
export type ImportResult = {
  created: number
  by_role: Record<CsvRole, number>
  users: ImportedUser[]
}

/** ส่งไฟล์แบบ multipart ช่อง "file" */
function csvForm(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

/**
 * ตรวจไฟล์ CSV (ยังไม่สร้างบัญชี) — ตอบ 200 ทั้งไฟล์ถูกและผิด (ดูที่ report.valid)
 * @throws ApiError ปัญหาระดับไฟล์: csv_unreadable / csv_too_large / csv_too_many_rows / csv_empty /
 *   csv_missing_columns
 */
export function validateUserImport(file: File): Promise<CsvReport> {
  return apiFetch<CsvReport>('/admin/users/import/validate/', { method: 'POST', body: csvForm(file) })
}

/**
 * นำเข้าไฟล์เดิมที่ตรวจแล้ว — server ตรวจใหม่แล้วสร้างทุกแถวใน transaction เดียว
 * ผลมีรหัสผ่านชั่วคราว**ครั้งเดียว** (หน้าเว็บสร้างไฟล์ให้ดาวน์โหลด — server ไม่เก็บรหัส)
 * @throws ApiError csv_invalid (มีแถวผิด — รายงานอยู่ใน csvInvalidReport()) / ปัญหาระดับไฟล์
 */
export function importUsers(file: File): Promise<ImportResult> {
  return apiFetch<ImportResult>('/admin/users/import/', { method: 'POST', body: csvForm(file) })
}

/** รายงานที่แนบมากับ error csv_invalid (เช่น มีคนสร้างอีเมลซ้ำระหว่างตรวจกับนำเข้า) — ไม่มี = null */
export function csvInvalidReport(error: unknown): CsvReport | null {
  if (!(error instanceof ApiError) || error.code !== 'csv_invalid') return null
  const body = error.body
  if (typeof body === 'object' && body !== null && 'report' in body) {
    return (body as { report: CsvReport }).report
  }
  return null
}
