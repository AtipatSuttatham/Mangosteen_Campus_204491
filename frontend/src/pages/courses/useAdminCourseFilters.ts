/**
 * ตัวกรองของหน้าจัดการรายวิชา (ผู้ดูแลระบบ — ขั้น 3.8) เก็บใน "ที่อยู่" ของหน้า
 * เช่น /courses?search=python&term=2569-1&teacher=12&status=published&page=2
 *
 * แบบเดียวกับหน้ารายชื่อผู้ใช้ (pages/admin/users/useUserFilters.ts):
 * - รีเฟรช / กดย้อนกลับ / คัดลอกลิงก์ ยังเห็นผลค้นหาเดิม
 * - ค่าแปลก ๆ ในที่อยู่ (term=abc, status=boss, page=0) = ไม่กรอง / หน้า 1 — ไม่ส่งต่อไป backend
 * - เปลี่ยนคำค้นหรือตัวกรอง → กลับไปหน้า 1
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { CourseStatusFilter } from '../../api/courses'

const STATUSES: CourseStatusFilter[] = ['draft', 'published', 'closed']
/** ภาคเรียน "ปี-ภาค" แบบเดียวกับที่ backend รับ เช่น 2569-1 */
const TERM_PATTERN = /^\d{4}-[123]$/

/** ตัวกรองที่อ่านได้จากที่อยู่ */
export type CourseFilters = {
  search: string
  term?: string
  teacher?: number
  status?: CourseStatusFilter
  page: number
}

/** ตัวกรองที่เปลี่ยนได้ (ไม่ส่ง = คงเดิม ; ข้อความว่าง = เลิกกรอง) */
export type CourseFilterChange = {
  search?: string
  term?: string
  teacher?: string
  status?: CourseStatusFilter | ''
}

/** อ่าน / เปลี่ยนตัวกรองของหน้าจัดการรายวิชา */
export function useAdminCourseFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<CourseFilters>(() => {
    const term = params.get('term') ?? ''
    const teacher = Number.parseInt(params.get('teacher') ?? '', 10)
    const status = params.get('status')
    const page = Number.parseInt(params.get('page') ?? '', 10)
    return {
      search: params.get('search') ?? '',
      term: TERM_PATTERN.test(term) ? term : undefined,
      teacher: Number.isInteger(teacher) && teacher > 0 ? teacher : undefined,
      status: STATUSES.find((item) => item === status),
      page: Number.isInteger(page) && page > 1 ? page : 1,
    }
  }, [params])

  /** มีการค้นหาหรือกรองอยู่ไหม (เลือกข้อความ "ทั้งหมด" / "พบ") */
  const isFiltered = Boolean(filters.search.trim() || filters.term || filters.teacher || filters.status)

  /** เปลี่ยนคำค้น / ตัวกรอง แล้วกลับไปหน้า 1 */
  const changeFilters = useCallback(
    (change: CourseFilterChange, options: { replace?: boolean } = {}) => {
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
