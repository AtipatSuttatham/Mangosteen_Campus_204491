/**
 * หน้า "รายวิชาของฉัน" ของผู้สอน /courses (UC-07 — ขั้น 3.5)
 * หน้าตาตาม board "รายวิชาของฉัน (ผู้สอน) — ปรับจาก 5.3" แถวก้อน 3 ใน design canvas (อนุมัติ 2026-10-15)
 *
 *   รายวิชาของฉัน                                         [+ สร้างรายวิชา]
 *   ✓ ลบรายวิชา 204212 โครงสร้างข้อมูล แล้ว                  ← แถบเขียวหลังลบ (ส่งมาจากแท็บตั้งค่า)
 *   ⌄ ปีการศึกษา 2569 ภาคเรียนที่ 1                         3 รายวิชา   ← Collapsible
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ [204111] Python พื้นฐาน   42 ผู้เรียน  รหัสเข้าร่วม K7Q2XM9A       │  ← CourseRow
 *   │ [204331] วิศวกรรมซอฟต์แวร์ ...                   [ยังไม่เผยแพร่]  │
 *   └───────────────────────────────────────────────────────────────┘
 *   › ปีการศึกษา 2568 ภาคเรียนที่ 2                         1 รายวิชา   ← พับอยู่
 *
 * - ข้อมูล: GET /api/v1/courses/ (ไม่แบ่งหน้า — backend เรียงภาคล่าสุดก่อน) ผ่าน TanStack Query
 * - พับ/เปิดกลุ่มภาค: ค่าเริ่มต้น = ภาคล่าสุดเปิด ภาคเก่าพับ (ผู้ใช้เลือกแบบ 1ก) ;
 *   จำค่าที่ผู้ใช้กดไว้ในเบราว์เซอร์ (แบบ 2ก — useStoredState)
 */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { fetchMyCourses, type Course } from '../../api/courses'
import { errorMessage } from '../../api/errors'
import { Button, Collapsible } from '../../components/ui'
import { groupByTerm, type Term } from '../../lib/terms'
import { useStoredState } from '../../lib/useStoredState'
import { CourseRow } from './CourseRow'
import { CreateCourseDialog } from './CreateCourseDialog'
import { CheckIcon, PlusIcon } from './icons'

/** ชื่อค่าที่จำไว้ในเบราว์เซอร์: {"2569-1": true, "2568-2": false} — ไม่มีชื่อภาค = ใช้ค่าเริ่มต้น */
const OPEN_TERMS_KEY = 'teacher-courses:open-terms'

export default function TeacherCoursesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [creating, setCreating] = useState(false)
  // แถบเขียวหลังลบรายวิชา: แท็บตั้งค่าส่งข้อความมากับการเปลี่ยนหน้า
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  )
  // ล้างข้อความออกจากประวัติ → รีเฟรชหน้าแล้วแถบไม่กลับมา
  useEffect(() => {
    if (location.state) void navigate('.', { replace: true, state: null })
  }, [location.state, navigate])
  const [openTerms, setOpenTerms] = useStoredState<Record<string, boolean>>(OPEN_TERMS_KEY, {})

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['my-courses'],
    queryFn: fetchMyCourses,
  })

  const groups = data ? groupByTerm(data) : []
  // ภาคล่าสุด (กลุ่มแรก) เปิดเป็นค่าเริ่มต้น ; ภาคอื่นพับ
  const isOpen = (key: string, index: number) => openTerms[key] ?? index === 0
  const toggle = (key: string, index: number) =>
    setOpenTerms((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))

  /** สร้างสำเร็จ: พาไปหน้ารายวิชา เพราะขั้นต่อไปคือเพิ่มผู้เรียนและเผยแพร่ */
  function handleCreated(course: Course) {
    void navigate(`/courses/${course.id}`)
  }

  const termTitle = (term: Term) =>
    t('courses.term', {
      year: term.academic_year,
      semester: t(`courses.semester${term.semester}`),
    })

  return (
    <div className="flex flex-col gap-4 lg:gap-[18px]">
      {/* หัวหน้า: จอใหญ่ = หัวข้อซ้าย ปุ่มขวา ; มือถือ = ปุ่มเต็มความกว้างใต้หัวข้อ */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="m-0 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]">
          {t('courses.title')}
        </h1>
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

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-[10px] bg-ok-soft px-3.5 py-2.5 text-sm leading-[1.55] font-semibold text-ok"
        >
          <CheckIcon />
          {notice}
        </div>
      )}

      {isPending ? (
        <StateMessage>
          <p className="m-0" role="status">
            {t('courses.loading')}
          </p>
        </StateMessage>
      ) : !data ? (
        <StateMessage>
          <div role="alert">
            <p className="m-0 font-semibold text-ink">{t('courses.loadFailed')}</p>
            <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
          </div>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('courses.retry')}
          </Button>
        </StateMessage>
      ) : groups.length === 0 ? (
        // ยังไม่มีรายวิชาเลย → ชวนสร้างรายวิชาแรก
        <StateMessage>
          <div>
            <p className="m-0 font-display text-xl font-semibold text-ink">{t('courses.emptyTitle')}</p>
            <p className="m-0 mt-1">{t('courses.emptyBody')}</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            {t('courses.create')}
          </Button>
        </StateMessage>
      ) : (
        <section aria-label={t('courses.listLabel')} className="flex flex-col gap-2">
          {groups.map((group, index) => (
            <Collapsible
              key={group.key}
              open={isOpen(group.key, index)}
              onToggle={() => toggle(group.key, index)}
              // ภาคเก่าตัวอักษรสีรอง (ตาม board)
              headingClassName={index === 0 ? 'text-ink' : 'text-ink-muted'}
              title={termTitle(group.term)}
              trailing={t('courses.courseCount', { total: group.items.length })}
            >
              <ul className="m-0 list-none divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface p-0">
                {group.items.map((course) => (
                  <CourseRow key={course.id} course={course} />
                ))}
              </ul>
            </Collapsible>
          ))}
        </section>
      )}

      {creating && (
        <CreateCourseDialog onClose={() => setCreating(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

/** กล่องข้อความสถานะกลางพื้นที่รายการ (กำลังโหลด / โหลดไม่สำเร็จ / ยังไม่มีรายวิชา) */
function StateMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-card border border-line bg-surface px-6 py-12 text-center text-[15px] leading-[1.6] text-ink-muted">
      {children}
    </div>
  )
}
