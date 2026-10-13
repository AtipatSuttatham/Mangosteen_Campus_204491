/**
 * แถบค้นหา + ตัวกรองของหน้ารายชื่อผู้ใช้ — หน้าตาตาม board "รายชื่อผู้ใช้" (ขั้น 2.5)
 *
 *   จอใหญ่:  [ค้นหาชื่อ รหัส หรืออีเมล]  บทบาท [ทุกบทบาท ⌄]  สถานะ [ทุกสถานะ ⌄]   ← แถวเดียว ป้ายมองเห็น
 *   มือถือ:  [ค้นหาชื่อ รหัส หรืออีเมล          ]                                   ← ป้ายซ่อนไว้ให้
 *            [ทุกบทบาท ⌄]        [ทุกสถานะ ⌄]                                       โปรแกรมอ่านหน้าจอ
 *
 * ค้นหา: เริ่มค้นเองหลังหยุดพิมพ์ 0.3 วินาที (ไม่ต้องกด Enter และไม่ยิงคำขอทุกตัวอักษร)
 * เลือกบทบาท/สถานะ: กรองทันที
 */
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UserStatusFilter } from '../../../api/adminUsers'
import type { Role } from '../../../api/auth'
import { SearchInput, Select } from '../../../components/ui'
import type { UserFilters } from './useUserFilters'

/** เวลารอหลังหยุดพิมพ์ก่อนค้นหา (มิลลิวินาที) */
export const SEARCH_DELAY_MS = 300

type UserFilterBarProps = {
  filters: UserFilters
  onChange: (
    change: { search?: string; role?: Role | ''; status?: UserStatusFilter | '' },
    options?: { replace?: boolean },
  ) => void
}

/** ป้ายของช่องเลือก: จอใหญ่มองเห็น (ตัวอักษรรอง) ; มือถือซ่อนไว้ให้โปรแกรมอ่านหน้าจอ */
const SELECT_LABEL = 'sr-only text-sm text-ink-muted lg:not-sr-only lg:shrink-0'

export function UserFilterBar({ filters, onChange }: UserFilterBarProps) {
  const { t } = useTranslation()
  const id = useId()
  // ข้อความในช่องค้นหา (เปลี่ยนทันทีที่พิมพ์) — ส่งไปเป็นตัวกรองหลังหยุดพิมพ์
  const [searchText, setSearchText] = useState(filters.search)
  // คำค้นในที่อยู่ที่เห็นครั้งล่าสุด — ใช้รู้ว่าคำค้นถูกเปลี่ยนจากทางอื่น (กดย้อนกลับ / ล้างตัวกรอง)
  const [lastUrlSearch, setLastUrlSearch] = useState(filters.search)
  if (filters.search !== lastUrlSearch) {
    // ปรับตามระหว่าง render (วิธีที่ React แนะนำแทนการใช้ effect) → ช่องค้นหาแสดงคำค้นในที่อยู่
    setLastUrlSearch(filters.search)
    setSearchText(filters.search)
  }

  // หยุดพิมพ์ครบเวลา → ใช้คำค้นใหม่ (แทนที่ประวัติ ไม่ให้ปุ่มย้อนกลับต้องกดทีละตัวอักษร)
  useEffect(() => {
    if (searchText === filters.search) return
    const timer = window.setTimeout(
      () => onChange({ search: searchText }, { replace: true }),
      SEARCH_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [searchText, filters.search, onChange])

  return (
    // role="search": โปรแกรมอ่านหน้าจอประกาศว่าเป็นส่วนค้นหา
    <div
      role="search"
      className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3 lg:border-b lg:border-line lg:px-6 lg:py-4"
    >
      <label htmlFor={`${id}-search`} className="sr-only">
        {t('adminUsers.searchLabel')}
      </label>
      <SearchInput
        id={`${id}-search`}
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder={t('adminUsers.searchPlaceholder')}
        className="w-full lg:h-[42px] lg:w-[300px]"
      />

      <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-3">
        <div className="contents lg:flex lg:items-center lg:gap-3">
          <label htmlFor={`${id}-role`} className={SELECT_LABEL}>
            {t('adminUsers.roleLabel')}
          </label>
          <Select
            id={`${id}-role`}
            value={filters.role ?? ''}
            onChange={(event) => onChange({ role: event.target.value as Role | '' })}
            className="w-full lg:h-[42px] lg:w-auto"
          >
            <option value="">{t('adminUsers.roleAll')}</option>
            <option value="admin">{t('roles.admin')}</option>
            <option value="teacher">{t('roles.teacher')}</option>
            <option value="student">{t('roles.student')}</option>
          </Select>
        </div>
        <div className="contents lg:flex lg:items-center lg:gap-3">
          <label htmlFor={`${id}-status`} className={SELECT_LABEL}>
            {t('adminUsers.statusLabel')}
          </label>
          <Select
            id={`${id}-status`}
            value={filters.status ?? ''}
            onChange={(event) =>
              onChange({ status: event.target.value as UserStatusFilter | '' })
            }
            className="w-full lg:h-[42px] lg:w-auto"
          >
            <option value="">{t('adminUsers.statusAll')}</option>
            <option value="active">{t('adminUsers.statusActive')}</option>
            <option value="suspended">{t('adminUsers.statusSuspended')}</option>
          </Select>
        </div>
      </div>
    </div>
  )
}
