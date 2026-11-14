/**
 * หน้า "จัดการรายวิชา" ของผู้ดูแลระบบ /courses (UC-07 — ขั้น 3.8 ; ผู้ใช้เลือกแบบ ร1 ที่อยู่เดียวกับผู้สอน / ผู้เรียน)
 * หน้าตาตาม board "จัดการรายวิชา (ผู้ดูแลระบบ)" แถวก้อน 3 ใน design canvas
 *
 *   จัดการรายวิชา                                          [+ สร้างรายวิชา]
 *   ทั้งหมด 36 รายวิชา
 *   ┌ การ์ด (จอใหญ่) ──────────────────────────────────────────────┐
 *   │ [ค้นหา] [ทุกภาคเรียน ⌄] [ผู้สอนทุกคน ⌄] [ทุกสถานะ ⌄]           │  ← AdminCourseFilterBar
 *   │ ตาราง (มือถือ = การ์ดละวิชา)                                   │  ← AdminCourseList
 *   │ แสดง 1–20 จาก 36 รายวิชา     [‹ ก่อนหน้า] หน้า 1 จาก 2 [ถัดไป ›] │  ← Pagination
 *   └──────────────────────────────────────────────────────────────┘
 *
 * - ข้อมูล: GET /api/v1/admin/courses/ (แบ่งหน้า 20) ; ตัวกรองเก็บในที่อยู่ (useAdminCourseFilters)
 * - ระหว่างโหลดหน้าถัดไปยังแสดงหน้าเดิม (ไม่กระพริบ) ; ขอหน้าที่ไม่มี → กลับหน้า 1
 * - "สร้างรายวิชา" = สร้างแทนผู้สอน (หน้าต่างเดิม + ช่องเลือกผู้สอน) แล้วพาไปหน้ารายวิชา
 * - ลบรายวิชาจากแท็บตั้งค่า → กลับมาหน้านี้พร้อมแถบเขียว
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { ADMIN_COURSES_PAGE_SIZE, fetchAdminCourses, type Course } from '../../api/courses'
import { errorMessage } from '../../api/errors'
import { Button, Pagination } from '../../components/ui'
import { AdminCourseFilterBar } from './AdminCourseFilterBar'
import { ADMIN_COURSES_KEY } from './courseCache'
import { AdminCourseList } from './AdminCourseList'
import { Notice } from './courseBits'
import { CreateCourseDialog } from './CreateCourseDialog'
import { PlusIcon } from './icons'
import { useAdminCourseFilters } from './useAdminCourseFilters'

const formatCount = (value: number) => value.toLocaleString('th-TH')

export default function AdminCoursesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { filters, isFiltered, changeFilters, changePage, clearFilters } = useAdminCourseFilters()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [creating, setCreating] = useState(false)
  // แถบเขียวหลังลบรายวิชา: แท็บตั้งค่าส่งข้อความมากับการเปลี่ยนหน้า
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  )
  // ล้างข้อความออกจากประวัติ → รีเฟรชแล้วแถบไม่กลับมา (คงตัวกรองในที่อยู่ไว้)
  useEffect(() => {
    if (location.state) void navigate(`.${location.search}`, { replace: true, state: null })
  }, [location.state, location.search, navigate])

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: [...ADMIN_COURSES_KEY, filters],
    queryFn: () => fetchAdminCourses(filters),
    placeholderData: keepPreviousData,
  })

  // ขอหน้าที่ไม่มีอยู่ (ลิงก์เก่า / รายการหดลง) → backend ตอบ 404 → กลับหน้า 1
  const pageNotFound = error instanceof ApiError && error.status === 404 && filters.page > 1
  useEffect(() => {
    if (pageNotFound) changePage(1, { replace: true })
  }, [pageNotFound, changePage])

  const pageCount = data ? Math.max(1, Math.ceil(data.count / ADMIN_COURSES_PAGE_SIZE)) : 1
  const firstIndex = (filters.page - 1) * ADMIN_COURSES_PAGE_SIZE + 1

  const goToPage = (page: number) => {
    changePage(page)
    headingRef.current?.scrollIntoView?.({ block: 'start' })
  }

  /** สร้างแทนผู้สอนสำเร็จ → หน้ารายวิชา (ขั้นต่อไปคือเพิ่มผู้เรียนและเผยแพร่ — แบบเดียวกับผู้สอน) */
  const handleCreated = (course: Course) => void navigate(`/courses/${course.id}`)

  return (
    <div className="flex flex-col gap-4 lg:gap-[18px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1 lg:gap-0">
          <h1
            ref={headingRef}
            className="m-0 scroll-mt-20 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]"
          >
            {t('adminCourses.title')}
          </h1>
          <p className="m-0 min-h-[1.6em] text-sm leading-[1.6] text-ink-muted" aria-live="polite">
            {data &&
              t(isFiltered ? 'adminCourses.found' : 'adminCourses.total', { total: formatCount(data.count) })}
          </p>
        </div>
        <Button
          onClick={() => {
            setNotice(null)
            setCreating(true)
          }}
        >
          <PlusIcon />
          {t('courses.create')}
        </Button>
      </div>

      {notice && <Notice notice={{ tone: 'ok', text: notice }} />}

      <section
        aria-label={t('adminCourses.listLabel')}
        className="flex flex-col gap-4 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface"
      >
        <AdminCourseFilterBar filters={filters} onChange={changeFilters} />

        {isPending ? (
          <StateMessage>
            <p className="m-0" role="status">
              {t('adminCourses.loading')}
            </p>
          </StateMessage>
        ) : !data ? (
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-semibold text-ink">{t('adminCourses.loadFailed')}</p>
              <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
            </div>
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('adminCourses.retry')}
            </Button>
          </StateMessage>
        ) : data.results.length === 0 ? (
          <StateMessage>
            {isFiltered ? (
              <>
                <div>
                  <p className="m-0 font-semibold text-ink">{t('adminCourses.emptyFiltered')}</p>
                  <p className="m-0">{t('adminCourses.emptyHint')}</p>
                </div>
                <Button variant="secondary" onClick={clearFilters}>
                  {t('adminCourses.clearFilters')}
                </Button>
              </>
            ) : (
              <div>
                <p className="m-0 font-semibold text-ink">{t('adminCourses.emptyTitle')}</p>
                <p className="m-0">{t('adminCourses.emptyBody')}</p>
              </div>
            )}
          </StateMessage>
        ) : (
          <div
            aria-busy={isFetching || undefined}
            className={isFetching ? 'opacity-60 motion-safe:transition-opacity' : ''}
          >
            <AdminCourseList courses={data.results} />
          </div>
        )}

        {data && data.results.length > 0 && (
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={goToPage}
            summary={t('adminCourses.range', {
              from: formatCount(firstIndex),
              to: formatCount(firstIndex + data.results.length - 1),
              total: formatCount(data.count),
            })}
            className="lg:border-t lg:border-line lg:py-3 lg:pr-4 lg:pl-6"
          />
        )}
      </section>

      {creating && (
        <CreateCourseDialog chooseTeacher onClose={() => setCreating(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

/** กล่องข้อความสถานะ — มือถือเป็นการ์ดของตัวเอง ; จอใหญ่อยู่ในการ์ดใหญ่ */
function StateMessage({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        'flex flex-col items-start gap-4 rounded-card border border-line bg-surface px-5 py-8 ' +
        'text-[15px] leading-[1.6] text-ink-muted lg:rounded-none lg:border-0 lg:px-6 lg:py-12'
      }
    >
      {children}
    </div>
  )
}
