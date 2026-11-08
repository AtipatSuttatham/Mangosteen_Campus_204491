/**
 * หน้า "รายวิชาของฉัน" ของผู้เรียน /courses (UC-15 — ขั้น 3.7)
 * หน้าตาตาม board "รายวิชาของฉัน (ผู้เรียน) — หลังเข้าร่วมสำเร็จ" + มือถือ แถวก้อน 3 ใน design canvas
 *
 *   รายวิชาของฉัน
 *   ✓ เข้าร่วมรายวิชา 204212 โครงสร้างข้อมูล แล้ว          ← แถบหลังกรอกรหัส (อยู่แล้ว = แถบเทา — แบบ ภ1)
 *   ┌ (+) เข้าร่วมรายวิชาด้วยรหัส                       ⌄ ┐   ← JoinCourseSection (พับได้)
 *   ⌄ ปีการศึกษา 2569 ภาคเรียนที่ 1                 2 รายวิชา
 *     [204111] Python พื้นฐาน   ผู้สอน กมล ศรีวงศ์       ›   ← StudentCourseRow
 *   › ปีการศึกษา 2568 ภาคเรียนที่ 2                 1 รายวิชา
 *
 * - ข้อมูล: GET /api/v1/courses/ (backend ส่งเฉพาะวิชาที่กำลังเรียนและเผยแพร่แล้ว รวมวิชาที่ปิดแล้ว)
 * - ส่วนเข้าร่วม (ผู้ใช้เลือกแบบ 1ก / 2ก): ยังไม่มีวิชา = เปิด, มีวิชาแล้ว = พับ ; จำค่าที่ผู้ใช้กดไว้ ;
 *   กรอกผิด = เปิดค้าง
 * - เข้าร่วมสำเร็จ: อยู่หน้าเดิม แถบเขียว + วิชาใหม่โผล่ในรายการ (เปิดกลุ่มภาคของวิชานั้น) + พับส่วนเข้าร่วม (แบบ ฟ1)
 * - กลุ่มภาคเรียน: ภาคล่าสุดเปิด ภาคเก่าพับ ; จำค่าที่ผู้ใช้กดไว้
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { fetchMyStudentCourses, type JoinResult } from '../../api/courses'
import { errorMessage } from '../../api/errors'
import { Button, Card, Collapsible } from '../../components/ui'
import { groupByTerm, termKey, type Term } from '../../lib/terms'
import { useStoredState } from '../../lib/useStoredState'
import { Notice, StateMessage, type NoticeValue } from './courseBits'
import { JoinCourseSection } from './JoinCourseSection'
import { StudentCourseRow } from './StudentCourseRow'

/** ค่าที่จำไว้ในเบราว์เซอร์ (แยกจากของผู้สอน) */
const OPEN_TERMS_KEY = 'student-courses:open-terms'
/** true / false = ผู้ใช้กดไว้ ; null = ใช้ค่าเริ่มต้นตามจำนวนรายวิชา */
const JOIN_OPEN_KEY = 'student-courses:join-open'

/** ที่เก็บข้อมูลของ TanStack Query (แยกจากรายวิชาของผู้สอน — ข้อมูลคนละรูปแบบ) */
const STUDENT_COURSES_KEY = ['my-student-courses'] as const

export default function StudentCoursesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<NoticeValue | null>(null)
  const [openTerms, setOpenTerms] = useStoredState<Record<string, boolean>>(OPEN_TERMS_KEY, {})
  const [joinOpen, setJoinOpen] = useStoredState<boolean | null>(JOIN_OPEN_KEY, null)

  const { data, error, isPending, refetch } = useQuery({
    queryKey: STUDENT_COURSES_KEY,
    queryFn: fetchMyStudentCourses,
  })

  const groups = data ? groupByTerm(data) : []
  const isTermOpen = (key: string, index: number) => openTerms[key] ?? index === 0
  const toggleTerm = (key: string, index: number) =>
    setOpenTerms((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))

  // ยังไม่มีวิชา = เปิดเป็นค่าเริ่มต้น ; ระหว่างโหลดถือว่าพับ (ไม่กระพริบ)
  const isJoinOpen = joinOpen ?? (data !== undefined && data.length === 0)

  /** กรอกรหัสผ่าน: แถบข้อความ + โหลดรายการใหม่ + เปิดกลุ่มภาคของวิชานั้น + พับส่วนเข้าร่วม */
  async function handleJoined({ course, joined }: JoinResult) {
    const values = { code: course.code, name: course.name }
    setNotice(
      joined
        ? { tone: 'ok', text: t('studentCourses.joined', values) }
        : { tone: 'mute', text: t('studentCourses.alreadyIn', values) },
    )
    setOpenTerms((prev) => ({ ...prev, [termKey(course)]: true }))
    setJoinOpen(false)
    await queryClient.invalidateQueries({ queryKey: STUDENT_COURSES_KEY })
  }

  const termTitle = (term: Term) =>
    t('courses.term', {
      year: term.academic_year,
      semester: t(`courses.semester${term.semester}`),
    })

  return (
    <div className="flex flex-col gap-3.5 lg:gap-[18px]">
      <h1 className="m-0 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]">
        {t('courses.title')}
      </h1>

      {notice && <Notice notice={notice} />}

      <JoinCourseSection
        open={isJoinOpen}
        onToggle={() => {
          setNotice(null)
          setJoinOpen(!isJoinOpen)
        }}
        onJoined={(result) => void handleJoined(result)}
        onFailed={() => {
          setNotice(null)
          setJoinOpen(true)
        }}
      />

      {isPending ? (
        <StateBox>
          <p className="m-0" role="status">
            {t('courses.loading')}
          </p>
        </StateBox>
      ) : !data ? (
        <StateBox>
          <div role="alert">
            <p className="m-0 font-semibold text-ink">{t('courses.loadFailed')}</p>
            <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
          </div>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('courses.retry')}
          </Button>
        </StateBox>
      ) : groups.length === 0 ? (
        <StateBox>
          <div>
            <p className="m-0 font-display text-xl font-semibold text-ink">{t('studentCourses.emptyTitle')}</p>
            <p className="m-0 mt-1">{t('studentCourses.emptyBody')}</p>
          </div>
        </StateBox>
      ) : (
        <section aria-label={t('courses.listLabel')} className="flex flex-col gap-2">
          {groups.map((group, index) => (
            <Collapsible
              key={group.key}
              open={isTermOpen(group.key, index)}
              onToggle={() => toggleTerm(group.key, index)}
              headingClassName={index === 0 ? 'text-ink' : 'text-ink-muted'}
              title={termTitle(group.term)}
              trailing={t('courses.courseCount', { total: group.items.length })}
            >
              {/* จอใหญ่: การ์ดเดียวคั่นเส้น ; มือถือ: การ์ดแยกแถวละใบ (ตาม board) */}
              <ul
                className={
                  'm-0 flex list-none flex-col gap-2.5 p-0 lg:gap-0 lg:divide-y lg:divide-line-soft ' +
                  'lg:overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface'
                }
              >
                {group.items.map((course) => (
                  <StudentCourseRow key={course.id} course={course} />
                ))}
              </ul>
            </Collapsible>
          ))}
        </section>
      )}
    </div>
  )
}

/** กล่องข้อความกำลังโหลด / โหลดไม่สำเร็จ / ยังไม่มีรายวิชา (การ์ด + ข้อความกลาง) */
function StateBox({ children }: { children: ReactNode }) {
  return (
    <Card>
      <StateMessage>{children}</StateMessage>
    </Card>
  )
}
