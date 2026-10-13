/**
 * ตัวกรองของหน้ารายชื่อผู้ใช้ เก็บไว้ใน "ที่อยู่" ของหน้า (URL) เช่น /users?search=สมชาย&role=student&page=2
 *
 * ทำไมเก็บใน URL: กดรีเฟรช / กดย้อนกลับ / คัดลอกลิงก์ไปเปิดแท็บอื่น ยังเห็นผลค้นหาเดิม
 *
 * - ค่าแปลก ๆ ในที่อยู่ (เช่น role=boss, page=abc) ถูกมองว่า "ไม่กรอง" / หน้า 1 — ไม่ส่งต่อไปที่ backend
 * - เปลี่ยนคำค้นหรือตัวกรอง → กลับไปหน้า 1 เสมอ (ผลลัพธ์ชุดใหม่อาจมีไม่ถึงหน้าเดิม)
 * - พิมพ์ค้นหา: แทนที่ประวัติเดิม (replace) ไม่ให้ปุ่มย้อนกลับต้องกดทีละตัวอักษร
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { AdminUserFilters, UserStatusFilter } from '../../../api/adminUsers'
import type { Role } from '../../../api/auth'

const ROLES: Role[] = ['admin', 'teacher', 'student']
const STATUSES: UserStatusFilter[] = ['active', 'suspended']

/** ตัวกรองที่อ่านได้จากที่อยู่ (ค่าที่ไม่รู้จัก = ไม่กรอง) */
export type UserFilters = Required<Pick<AdminUserFilters, 'search' | 'page'>> &
  Pick<AdminUserFilters, 'role' | 'status'>

/** ตัวกรองที่หน้าเปลี่ยนได้ (ไม่ส่ง = คงเดิม ; ค่าว่าง = เลิกกรอง) */
type FilterChange = {
  search?: string
  role?: Role | ''
  status?: UserStatusFilter | ''
}

/** อ่าน/เปลี่ยนตัวกรองของหน้ารายชื่อผู้ใช้ */
export function useUserFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<UserFilters>(() => {
    const role = params.get('role')
    const status = params.get('status')
    const page = Number.parseInt(params.get('page') ?? '', 10)
    return {
      search: params.get('search') ?? '',
      role: ROLES.find((item) => item === role),
      status: STATUSES.find((item) => item === status),
      page: Number.isInteger(page) && page > 1 ? page : 1,
    }
  }, [params])

  /** มีการค้นหาหรือกรองอยู่หรือไม่ (ใช้เลือกข้อความ "ทั้งหมด" / "พบ") */
  const isFiltered = Boolean(filters.search.trim() || filters.role || filters.status)

  /** เปลี่ยนคำค้น/ตัวกรอง แล้วกลับไปหน้า 1 */
  const changeFilters = useCallback(
    (change: FilterChange, options: { replace?: boolean } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(change)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          next.delete('page')
          return next
        },
        { replace: options.replace },
      )
    },
    [setParams],
  )

  /** ไปหน้าที่กำหนด (หน้า 1 = ไม่ใส่ page ในที่อยู่) */
  const changePage = useCallback(
    (page: number, options: { replace?: boolean } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (page > 1) next.set('page', String(page))
          else next.delete('page')
          return next
        },
        { replace: options.replace },
      )
    },
    [setParams],
  )

  /** ล้างคำค้นและตัวกรองทั้งหมด */
  const clearFilters = useCallback(() => setParams(new URLSearchParams()), [setParams])

  return { filters, isFiltered, changeFilters, changePage, clearFilters }
}
