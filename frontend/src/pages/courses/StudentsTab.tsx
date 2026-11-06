/**
 * แท็บผู้เรียนของหน้ารายวิชา (UC-08 — ขั้น 3.6) ตาม board "หน้ารายวิชา แท็บผู้เรียน" จอใหญ่ + มือถือ
 *
 *   [กำลังเรียน 42 | ถูกถอน 2]  [ค้นหาชื่อ รหัส หรืออีเมล]          [+ เพิ่มผู้เรียน]
 *   ตาราง: ชื่อและอีเมล / รหัสนักศึกษา / เข้าร่วมเมื่อ / วิธีเข้าร่วม / ถอน     ← มือถือเป็นการ์ด
 *   แสดง 1–20 จาก 42 คน                        [‹ ก่อนหน้า] หน้า 1 จาก 3 [ถัดไป ›]
 *
 * - ตัวกรองเก็บในที่อยู่ของหน้า (?status=dropped&search=…&page=2) เหมือนหน้ารายชื่อผู้ใช้
 * - ถอนต้องยืนยันก่อน ; เพิ่มกลับทำทันที (ย้อนได้) ; วิชาที่ปิดแล้วดูได้อย่างเดียว
 * - บัญชีถูกระงับยังอยู่ในรายชื่อ พร้อมป้ายเทา (ผู้ใช้เลือกแบบ ข)
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import {
  addStudents,
  dropStudent,
  fetchRoster,
  ROSTER_PAGE_SIZE,
  type Enrollment,
  type EnrollmentStatus,
  type RosterFilters,
} from '../../api/enrollments'
import { errorMessage } from '../../api/errors'
import { Button, ConfirmDialog, Pagination, SearchInput, StatusBadge } from '../../components/ui'
import { formatDateTime } from '../../lib/datetime'
import { AddStudentsDialog } from './AddStudentsDialog'
import { Segmented, StateMessage } from './courseBits'
import { BlockedIcon, PlusIcon } from './icons'
import { useCoursePage, useRefreshCourse } from './useCoursePage'

/** เวลารอหลังหยุดพิมพ์ก่อนค้นหา (มิลลิวินาที) — เท่ากับหน้ารายชื่อผู้ใช้ */
const SEARCH_DELAY_MS = 300
/** คำค้นยาวสุด (ตรงกับ backend) */
const MAX_SEARCH = 100

/** หัวตารางและช่องข้อมูล (ตาม th / td ใน board) */
const TH = 'border-b border-line px-4 py-3 text-left text-sm font-semibold whitespace-nowrap text-ink-muted'
const TD = 'border-b border-line-soft px-4 py-3 align-middle text-[15px]'

const formatCount = (value: number) => value.toLocaleString('th-TH')
const fullName = (row: Enrollment) => `${row.student.first_name} ${row.student.last_name}`

/** อ่าน/เปลี่ยนตัวกรองจากที่อยู่ของหน้า */
function useRosterFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo<RosterFilters>(() => {
    const page = Number.parseInt(params.get('page') ?? '', 10)
    return {
      status: params.get('status') === 'dropped' ? 'dropped' : 'active',
      search: params.get('search') ?? '',
      page: Number.isInteger(page) && page > 1 ? page : 1,
    }
  }, [params])

  const change = useCallback(
    (values: Record<string, string>, replace = false) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(values)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace },
      )
    },
    [setParams],
  )
  return { filters, change }
}

export default function StudentsTab() {
  const { t } = useTranslation()
  const { course, notify } = useCoursePage()
  const refresh = useRefreshCourse(course.id)
  const { filters, change } = useRosterFilters()
  const searchId = useId()
  const topRef = useRef<HTMLElement>(null)

  const [adding, setAdding] = useState(false)
  const [dropping, setDropping] = useState<Enrollment | null>(null)
  const [dropPending, setDropPending] = useState(false)
  const [dropError, setDropError] = useState<string>()
  // แถวที่กำลังเพิ่มกลับ (ปุ่มของแถวนั้นกดไม่ได้ระหว่างรอ)
  const [readdingId, setReaddingId] = useState<number | null>(null)

  // ข้อความในช่องค้นหา — ส่งไปเป็นตัวกรองหลังหยุดพิมพ์
  const [searchText, setSearchText] = useState(filters.search)
  const [lastUrlSearch, setLastUrlSearch] = useState(filters.search)
  if (filters.search !== lastUrlSearch) {
    setLastUrlSearch(filters.search)
    setSearchText(filters.search)
  }
  useEffect(() => {
    if (searchText === filters.search) return
    const timer = window.setTimeout(() => change({ search: searchText, page: '' }, true), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [searchText, filters.search, change])

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['roster', course.id, filters],
    queryFn: () => fetchRoster(course.id, filters),
    placeholderData: keepPreviousData,
  })

  // หน้าที่ขอไม่มีแล้ว (เช่น ถอนคนสุดท้ายของหน้า) → กลับไปหน้า 1
  const pageNotFound = error instanceof ApiError && error.status === 404 && filters.page > 1
  useEffect(() => {
    if (pageNotFound) change({ page: '' }, true)
  }, [pageNotFound, change])

  const editable = !course.is_closed
  const showingDropped = filters.status === 'dropped'
  const pageCount = data ? Math.max(1, Math.ceil(data.count / ROSTER_PAGE_SIZE)) : 1
  const firstIndex = (filters.page - 1) * ROSTER_PAGE_SIZE + 1

  const methodLabel = (row: Enrollment) =>
    row.method === 'join_code'
      ? t('roster.methodJoinCode')
      : row.method === 'admin'
        ? t('roster.methodAdmin')
        : t('roster.methodTeacher')
  const rowDate = (row: Enrollment) =>
    formatDateTime(showingDropped && row.dropped_at ? row.dropped_at : row.enrolled_at)

  /** ถอนหลังยืนยัน */
  async function confirmDrop() {
    if (!dropping) return
    setDropPending(true)
    setDropError(undefined)
    try {
      await dropStudent(course.id, dropping.id)
      await refresh()
      notify({ tone: 'ok', text: t('roster.droppedNotice', { name: fullName(dropping) }) })
      setDropping(null)
    } catch (caught) {
      setDropError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
      await refresh()
    } finally {
      setDropPending(false)
    }
  }

  /** เพิ่มกลับคนที่ถูกถอน — ทำทันทีไม่ถาม (ถอนอีกครั้งได้) */
  async function readd(row: Enrollment) {
    setReaddingId(row.id)
    notify(null)
    const name = fullName(row)
    try {
      const result = await addStudents(course.id, [row.student.student_or_staff_id ?? row.student.email])
      const failed = result.failed[0]
      await refresh()
      notify(
        failed
          ? {
              tone: 'bad',
              text: t('roster.readdFailed', { name, reason: t(`addStudents.result.${failed.reason}`) }),
            }
          : { tone: 'ok', text: t('roster.readded', { name }) },
      )
    } catch (caught) {
      const reason = errorMessage(caught instanceof ApiError ? caught.code : 'unknown')
      notify({ tone: 'bad', text: t('roster.readdFailed', { name, reason }) })
      await refresh()
    } finally {
      setReaddingId(null)
    }
  }

  /** ปุ่มของแถว: ถอน (กำลังเรียน) / เพิ่มกลับ (ถูกถอน) */
  function rowAction(row: Enrollment, long: boolean) {
    if (showingDropped) {
      return (
        <Button variant="text" disabled={readdingId !== null} onClick={() => void readd(row)}>
          {readdingId === row.id ? t('roster.readding') : t('roster.readd')}
        </Button>
      )
    }
    return (
      <Button
        variant="text"
        aria-label={long ? undefined : t('roster.dropLabel', { name: fullName(row) })}
        onClick={() => {
          setDropError(undefined)
          setDropping(row)
        }}
      >
        {long ? t('roster.dropLong') : t('roster.drop')}
      </Button>
    )
  }

  const suspendedBadge = (
    <StatusBadge tone="mute" size="sm" icon={<BlockedIcon />}>
      {t('roster.suspended')}
    </StatusBadge>
  )

  return (
    <>
      {/* มือถือ: ปุ่มเพิ่มอยู่เหนือตัวกรอง (ตาม board) */}
      <section
        ref={topRef}
        aria-label={t('roster.listLabel')}
        className="flex scroll-mt-20 flex-col gap-3.5 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3 lg:border-b lg:border-line lg:px-6 lg:py-3.5">
          {editable && (
            <Button onClick={() => setAdding(true)} className="lg:order-3 lg:ml-auto">
              <PlusIcon />
              {t('roster.add')}
            </Button>
          )}
          <Segmented<EnrollmentStatus>
            label={t('roster.statusLabel')}
            value={filters.status}
            onChange={(status) => change({ status: status === 'active' ? '' : status, page: '' })}
            options={[
              { value: 'active', label: t('roster.active'), count: data?.counts.active },
              { value: 'dropped', label: t('roster.dropped'), count: data?.counts.dropped },
            ]}
            className="grid grid-cols-2 lg:inline-flex"
          />
          <label htmlFor={searchId} className="sr-only">
            {t('roster.searchLabel')}
          </label>
          <SearchInput
            id={searchId}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={t('roster.searchPlaceholder')}
            maxLength={MAX_SEARCH}
            className="w-full lg:h-[42px] lg:w-[280px]"
          />
        </div>

        {isPending ? (
          <StateMessage>
            <p className="m-0" role="status">
              {t('roster.loading')}
            </p>
          </StateMessage>
        ) : !data ? (
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-semibold text-ink">{t('roster.loadFailed')}</p>
              <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
            </div>
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('roster.retry')}
            </Button>
          </StateMessage>
        ) : data.results.length === 0 ? (
          <StateMessage>
            {filters.search.trim() ? (
              <p className="m-0 font-semibold text-ink">{t('roster.emptySearch')}</p>
            ) : showingDropped ? (
              <p className="m-0 font-semibold text-ink">{t('roster.emptyDropped')}</p>
            ) : (
              <div>
                <p className="m-0 font-display text-xl font-semibold text-ink">{t('roster.emptyActive')}</p>
                {editable && <p className="m-0 mt-1">{t('roster.emptyActiveHint')}</p>}
              </div>
            )}
          </StateMessage>
        ) : (
          <div
            aria-busy={isFetching || undefined}
            className={isFetching ? 'opacity-60 motion-safe:transition-opacity' : ''}
          >
            {/* จอใหญ่ = ตาราง */}
            <table className="hidden w-full table-fixed border-collapse lg:table">
              {/* ความกว้างคงที่: ชื่อ / อีเมลยาวขึ้นบรรทัดใหม่ ไม่ดันปุ่มท้ายแถวหลุดการ์ด */}
              <colgroup>
                <col />
                <col className="w-[128px]" />
                <col className="w-[172px]" />
                <col className="w-[172px]" />
                {editable && <col className="w-[104px]" />}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className={`${TH} pl-6`}>
                    {t('roster.columnName')}
                  </th>
                  <th scope="col" className={TH}>
                    {t('roster.columnId')}
                  </th>
                  <th scope="col" className={TH}>
                    {showingDropped ? t('roster.columnDropped') : t('roster.columnJoined')}
                  </th>
                  <th scope="col" className={TH}>
                    {t('roster.columnMethod')}
                  </th>
                  {editable && (
                    <th scope="col" className={TH}>
                      <span className="sr-only">{t('roster.columnActions')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.results.map((row) => {
                  const muted = row.student.is_active ? '' : 'text-ink-muted'
                  return (
                    <tr key={row.id} className="last:[&>td]:border-b-0">
                      <td className={`${TD} pl-6 wrap-anywhere ${muted}`}>
                        <div className="flex flex-wrap items-center gap-x-1.5 font-semibold">
                          {fullName(row)}
                          {!row.student.is_active && suspendedBadge}
                        </div>
                        <div className="text-[13.5px] leading-[1.6] text-ink-muted">{row.student.email}</div>
                      </td>
                      <td className={`${TD} ${muted}`}>{row.student.student_or_staff_id}</td>
                      <td className={`${TD} whitespace-nowrap ${muted}`}>{rowDate(row)}</td>
                      <td className={`${TD} text-[14.5px] whitespace-nowrap text-ink-muted`}>
                        {methodLabel(row)}
                      </td>
                      {editable && <td className={`${TD} pr-4 text-right`}>{rowAction(row, false)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* มือถือ = การ์ดทีละคน */}
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
              {data.results.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-card border border-line bg-surface px-4 pt-4 pb-2"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div
                        className={`text-base font-semibold ${row.student.is_active ? '' : 'text-ink-muted'}`}
                      >
                        {fullName(row)}
                      </div>
                      <div className="text-[13.5px] leading-[1.6] wrap-anywhere text-ink-muted">
                        {row.student.email}
                      </div>
                    </div>
                    {!row.student.is_active && suspendedBadge}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
                    <span>{t('roster.studentId', { id: row.student.student_or_staff_id })}</span>
                    <span>{methodLabel(row)}</span>
                    <span>{rowDate(row)}</span>
                  </div>
                  {editable && (
                    <div className="-ml-2 flex border-t border-line-soft pt-1">{rowAction(row, true)}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data && data.results.length > 0 && (
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={(page) => {
              change({ page: page > 1 ? String(page) : '' })
              topRef.current?.scrollIntoView?.({ block: 'start' })
            }}
            summary={t('roster.range', {
              from: formatCount(firstIndex),
              to: formatCount(firstIndex + data.results.length - 1),
              total: formatCount(data.count),
            })}
            className="lg:border-t lg:border-line lg:py-3 lg:pr-4 lg:pl-6"
          />
        )}
      </section>

      {adding && (
        <AddStudentsDialog
          course={course}
          onClose={(total) => {
            setAdding(false)
            if (total > 0) notify({ tone: 'ok', text: t('roster.added', { total }) })
          }}
        />
      )}
      {dropping && (
        <ConfirmDialog
          title={t('roster.dropTitle', { name: fullName(dropping) })}
          description={[t('roster.dropBody'), t('roster.dropBody2')]}
          confirmLabel={t('roster.drop')}
          pendingLabel={t('roster.dropping')}
          pending={dropPending}
          error={dropError}
          onConfirm={() => void confirmDrop()}
          onCancel={() => setDropping(null)}
        />
      )}
    </>
  )
}
