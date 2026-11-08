/**
 * แถบค้นหา + ตัวกรองของหน้าจัดการรายวิชา — ตาม board "จัดการรายวิชา (ผู้ดูแลระบบ)" (ขั้น 3.8)
 *
 *   จอใหญ่: [ค้นหารหัสหรือชื่อวิชา] [ทุกภาคเรียน ⌄] [ผู้สอนทุกคน ⌄] [ทุกสถานะ ⌄]   ← แถวเดียว
 *   มือถือ: [ค้นหารหัสหรือชื่อวิชา                 ]
 *           [ทุกภาคเรียน ⌄]            [ทุกสถานะ ⌄]
 *           [ผู้สอนทุกคน ⌄                         ]   ← ชื่อผู้สอนยาว ให้เต็มแถว (ย้ายลงล่างเฉพาะมือถือ)
 *           ลำดับในโค้ด = ลำดับบนจอใหญ่ (ปุ่ม Tab ไล่ตามที่ตาเห็น)
 *
 * - ป้ายชื่อของทุกช่องซ่อนไว้ให้โปรแกรมอ่านหน้าจอ (board ไม่แสดงป้าย — ตัวเลือกแรกบอกอยู่แล้ว)
 * - ค้นหาเองหลังหยุดพิมพ์ 0.3 วินาที ; เลือกตัวกรองแล้วกรองทันที (แบบเดียวกับหน้ารายชื่อผู้ใช้)
 * - ตัวเลือกภาคเรียน = ภาคที่มีรายวิชาอยู่ ; ตัวเลือกผู้สอน = คนที่มีรายวิชาอยู่ (รวมบัญชีที่ถูกระงับ)
 */
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourseStatusFilter } from '../../api/courses'
import { SearchInput, Select } from '../../components/ui'
import { SEARCH_DELAY_MS } from '../admin/users/UserFilterBar'
import { teacherOptionLabel, useAdminTeachers, useAdminTerms } from './adminCourseData'
import type { CourseFilterChange, CourseFilters } from './useAdminCourseFilters'

type AdminCourseFilterBarProps = {
  filters: CourseFilters
  onChange: (change: CourseFilterChange, options?: { replace?: boolean }) => void
}

export function AdminCourseFilterBar({ filters, onChange }: AdminCourseFilterBarProps) {
  const { t } = useTranslation()
  const id = useId()
  const terms = useAdminTerms()
  const teachers = useAdminTeachers()

  // ข้อความในช่องค้นหา (เปลี่ยนทันทีที่พิมพ์) — ส่งเป็นตัวกรองหลังหยุดพิมพ์
  const [searchText, setSearchText] = useState(filters.search)
  // คำค้นในที่อยู่ที่เห็นครั้งล่าสุด — รู้ว่าถูกเปลี่ยนจากทางอื่น (กดย้อนกลับ / ล้างตัวกรอง)
  const [lastUrlSearch, setLastUrlSearch] = useState(filters.search)
  if (filters.search !== lastUrlSearch) {
    setLastUrlSearch(filters.search)
    setSearchText(filters.search)
  }

  useEffect(() => {
    if (searchText === filters.search) return
    const timer = window.setTimeout(
      () => onChange({ search: searchText }, { replace: true }),
      SEARCH_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [searchText, filters.search, onChange])

  // ผู้สอนในตัวกรอง: คนที่มีรายวิชาอยู่ + คนที่เลือกไว้ในที่อยู่ (แม้ไม่มีวิชาแล้ว ช่องยังบอกได้ว่ากรองใครอยู่)
  const teacherOptions = (teachers.data ?? []).filter(
    (teacher) => teacher.course_count > 0 || teacher.id === filters.teacher,
  )

  const selectClass = 'w-full lg:h-[42px] lg:w-auto lg:max-w-[240px]'

  return (
    <div
      role="search"
      className={
        'grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3 ' +
        'lg:border-b lg:border-line lg:px-6 lg:py-4'
      }
    >
      <label htmlFor={`${id}-search`} className="sr-only">
        {t('adminCourses.searchLabel')}
      </label>
      <SearchInput
        id={`${id}-search`}
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder={t('adminCourses.searchPlaceholder')}
        className="col-span-2 w-full lg:h-[42px] lg:w-[260px]"
      />

      <label htmlFor={`${id}-term`} className="sr-only">
        {t('adminCourses.termLabel')}
      </label>
      <Select
        id={`${id}-term`}
        value={filters.term ?? ''}
        onChange={(event) => onChange({ term: event.target.value })}
        className={selectClass}
      >
        <option value="">{t('adminCourses.termAll')}</option>
        {(terms.data ?? []).map((term) => {
          const value = `${term.academic_year}-${term.semester}`
          return (
            <option key={value} value={value}>
              {t('adminCourses.termOption', {
                year: term.academic_year,
                semester: t(`courses.semester${term.semester}`),
              })}
            </option>
          )
        })}
      </Select>

      <label htmlFor={`${id}-teacher`} className="sr-only">
        {t('adminCourses.teacherLabel')}
      </label>
      <Select
        id={`${id}-teacher`}
        value={filters.teacher ? String(filters.teacher) : ''}
        onChange={(event) => onChange({ teacher: event.target.value })}
        className={`col-span-2 max-lg:order-last ${selectClass}`}
      >
        <option value="">{t('adminCourses.teacherAll')}</option>
        {teacherOptions.map((teacher) => (
          <option key={teacher.id} value={String(teacher.id)}>
            {teacherOptionLabel(teacher, t)}
          </option>
        ))}
      </Select>
      <label htmlFor={`${id}-status`} className="sr-only">
        {t('adminCourses.statusLabel')}
      </label>
      <Select
        id={`${id}-status`}
        value={filters.status ?? ''}
        onChange={(event) => onChange({ status: event.target.value as CourseStatusFilter | '' })}
        className={selectClass}
      >
        <option value="">{t('adminCourses.statusAll')}</option>
        <option value="draft">{t('courses.draft')}</option>
        <option value="published">{t('coursePage.published')}</option>
        <option value="closed">{t('courses.closed')}</option>
      </Select>

    </div>
  )
}
