/**
 * ฟังก์ชันเรียก API จัดการบัญชีผู้ใช้ของผู้ดูแลระบบ (backend: docs/api.md §7)
 *
 * ขั้น 2.5 ใช้แค่ "รายชื่อผู้ใช้" — ขั้น 2.6 / 2.7 เพิ่ม เพิ่ม / แก้ / ระงับ / รีเซ็ต / นำเข้า CSV ที่ไฟล์นี้
 */
import type { Role } from './auth'
import { apiFetch } from './client'

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
