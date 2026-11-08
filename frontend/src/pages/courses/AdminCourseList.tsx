/**
 * รายการรายวิชาทั้งระบบของผู้ดูแลระบบ — ตาม board "จัดการรายวิชา (ผู้ดูแลระบบ)" (ขั้น 3.8)
 *
 *   จอใหญ่ (ตาราง):
 *   รายวิชา                    ภาคเรียน     ผู้สอน               ผู้เรียน  สถานะ
 *   [204111] Python พื้นฐาน     2569 ภาค 1   กมล ศรีวงศ์              42   [เผยแพร่แล้ว]   จัดการ ›
 *   [204252] การวิเคราะห์…      2569 ภาค 1   ปรียา อินทร์แก้ว          27   [เผยแพร่แล้ว]   จัดการ ›
 *                                           บัญชีผู้สอนถูกระงับ   ← ข้อความแดง
 *
 *   มือถือ (การ์ดละวิชา — ไม่มี board มือถือ ใช้แบบหน้ารายชื่อผู้ใช้):
 *   ┌ [204111]  Python พื้นฐาน                    › ┐
 *   │           2569 ภาค 1   ผู้สอน กมล ศรีวงศ์       │
 *   │           42 ผู้เรียน   [เผยแพร่แล้ว]           │
 *   └────────────────────────────────────────────┘
 *
 * - ทั้งแถว / ทั้งการ์ดกดได้ (กฎก้อน 3 "แถวรายวิชากดได้ทั้งแถว") ; คำว่า "จัดการ" ท้ายแถวตาม board
 *   เป็นส่วนหนึ่งของลิงก์เดียวกัน — โปรแกรมอ่านหน้าจออ่านชื่อเต็ม "จัดการรายวิชา 204111 …"
 * - ตาราง: ลิงก์อยู่ในคอลัมน์สุดท้าย แล้วยืดพื้นที่กดให้เต็มแถว (after:inset-0 บน <tr> ที่ relative)
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { courseState, type Course, type CourseState } from '../../api/courses'
import { Card, CourseBadge, StatusBadge } from '../../components/ui'
import { teacherName } from './adminCourseData'
import { ChevronIcon, EyeIcon, EyeOffIcon, LockIcon } from './icons'

const TH = 'border-b border-line px-3 py-3 text-left text-sm font-semibold whitespace-nowrap text-ink-muted'
const TD = 'border-b border-line-soft px-3 py-3 align-middle text-[15px]'

/** ป้ายสถานะของวิชา (ทั้ง 3 สถานะ — หน้านี้กรองตามสถานะ จึงแสดงทุกแถว) */
function CourseStateBadge({ state }: { state: CourseState }) {
  const { t } = useTranslation()
  if (state === 'published') {
    return (
      <StatusBadge tone="ok" icon={<EyeIcon />}>
        {t('coursePage.published')}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone="mute" icon={state === 'closed' ? <LockIcon /> : <EyeOffIcon />}>
      {state === 'closed' ? t('courses.closed') : t('courses.draft')}
    </StatusBadge>
  )
}

/** ภาคเรียนแบบสั้น เช่น "2569 ภาค 1" / "2569 ภาคฤดูร้อน" */
function useTermShort() {
  const { t } = useTranslation()
  return (course: Course) =>
    course.semester === 3
      ? t('adminCourses.termShortSummer', { year: course.academic_year })
      : t('adminCourses.termShort', { year: course.academic_year, semester: course.semester })
}

/** ชื่อผู้สอน + ข้อความแดงเมื่อบัญชีถูกระงับ */
function TeacherCell({ course }: { course: Course }) {
  const { t } = useTranslation()
  return (
    <>
      <span>{teacherName(course.teacher)}</span>
      {!course.teacher.is_active && (
        <span className="block text-[13px] leading-[1.5] font-semibold text-danger">
          {t('adminCourses.teacherSuspended')}
        </span>
      )}
    </>
  )
}

export function AdminCourseList({ courses }: { courses: Course[] }) {
  const { t } = useTranslation()
  const termShort = useTermShort()
  const linkLabel = (course: Course) =>
    t('adminCourses.manageLabel', { code: course.code, name: course.name, term: termShort(course) })
  const count = (course: Course) => course.student_count.toLocaleString('th-TH')

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <table className="hidden w-full table-fixed border-collapse lg:table">
        <colgroup>
          <col />
          <col className="w-[120px]" />
          <col className="w-[200px]" />
          <col className="w-[84px]" />
          <col className="w-[160px]" />
          <col className="w-[104px]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${TH} pl-6`}>
              {t('adminCourses.columnCourse')}
            </th>
            <th scope="col" className={TH}>
              {t('adminCourses.columnTerm')}
            </th>
            <th scope="col" className={TH}>
              {t('adminCourses.columnTeacher')}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {t('adminCourses.columnStudents')}
            </th>
            <th scope="col" className={TH}>
              {t('adminCourses.columnStatus')}
            </th>
            <th scope="col" className={`${TH} pr-6`}>
              <span className="sr-only">{t('adminCourses.columnActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {courses.map((course) => {
            const state = courseState(course)
            return (
              <tr key={course.id} className="relative hover:bg-canvas">
                <td className={`${TD} pl-6`}>
                  <div className="flex min-w-0 items-center gap-3.5">
                    <CourseBadge code={course.code} state={state} size="sm" className="shrink-0" />
                    <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{course.name}</span>
                  </div>
                </td>
                <td className={`${TD} whitespace-nowrap`}>{termShort(course)}</td>
                <td className={TD}>
                  <TeacherCell course={course} />
                </td>
                <td className={`${TD} text-right tabular-nums`}>{count(course)}</td>
                <td className={TD}>
                  <CourseStateBadge state={state} />
                </td>
                <td className={`${TD} pr-6 text-right`}>
                  <Link
                    to={`/courses/${course.id}`}
                    aria-label={linkLabel(course)}
                    className={
                      'inline-flex h-10 items-center gap-0.5 px-2 text-[14.5px] font-semibold whitespace-nowrap ' +
                      'text-brand no-underline after:absolute after:inset-0 after:content-[""] ' +
                      'focus-visible:outline-none focus-visible:after:outline-2 ' +
                      'focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent'
                    }
                  >
                    {t('adminCourses.manage')}
                    <ChevronIcon />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* มือถือ: การ์ดละวิชา ทั้งการ์ดเป็นลิงก์ */}
      <ul aria-label={t('adminCourses.listLabel')} className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
        {courses.map((course) => {
          const state = courseState(course)
          return (
            <Card as="li" key={course.id} className="overflow-hidden">
              <Link
                to={`/courses/${course.id}`}
                aria-label={linkLabel(course)}
                className={
                  'flex items-start gap-3.5 py-3.5 pr-3 pl-3.5 text-inherit no-underline hover:bg-canvas ' +
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent'
                }
              >
                <CourseBadge code={course.code} state={state} size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0 grow">
                  <h3 className="m-0 font-display text-lg leading-[1.4] font-semibold [overflow-wrap:anywhere]">
                    {course.name}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-[1.6] text-ink-muted">
                    <span>{termShort(course)}</span>
                    <span>{t('coursePage.teacher', { name: teacherName(course.teacher) })}</span>
                  </div>
                  {!course.teacher.is_active && (
                    <p className="m-0 text-[13px] leading-[1.5] font-semibold text-danger">
                      {t('adminCourses.teacherSuspended')}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
                    <span>{t('adminCourses.studentCount', { total: count(course) })}</span>
                    <CourseStateBadge state={state} />
                  </div>
                </div>
                <span className="mt-2 text-brand">
                  <ChevronIcon />
                </span>
              </Link>
            </Card>
          )
        })}
      </ul>
    </>
  )
}
