/**
 * แถวรายวิชา 1 แถวในหน้า "รายวิชาของฉัน" ของผู้เรียน — ตาม board "รายวิชาของฉัน (ผู้เรียน)" (ขั้น 3.7)
 *
 *   ┏━━━━━━━━┓  Python พื้นฐาน                                [ปิดรายวิชาแล้ว]  ›
 *   ┃ 204111 ┃  ผู้สอน กมล ศรีวงศ์
 *   ┗━━━━━━━━┛
 *
 * - ทั้งแถวเป็นลิงก์ไปหน้ารายวิชา ; จอใหญ่อยู่ในการ์ดเดียวคั่นเส้น มือถือแยกการ์ดละแถว (ตาม board มือถือ)
 * - ผู้เรียนเห็นเฉพาะวิชาที่เผยแพร่แล้ว → ป้ายข้อความมีแค่ "ปิดรายวิชาแล้ว"
 * - board เขียน "อ.กมล" แต่ระบบไม่มีช่องคำนำหน้าชื่อ จึงแสดงชื่อ–นามสกุลตามบัญชี
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { StudentCourse } from '../../api/courses'
import { CourseBadge, StatusBadge } from '../../components/ui'
import { ChevronIcon, LockIcon } from './icons'

export function StudentCourseRow({ course }: { course: StudentCourse }) {
  const { t } = useTranslation()
  const state = course.is_closed ? 'closed' : 'published'
  const teacher = `${course.teacher.first_name} ${course.teacher.last_name}`

  const closedFlag = (className: string) =>
    course.is_closed && (
      <StatusBadge tone="mute" icon={<LockIcon />} className={`w-fit shrink-0 ${className}`}>
        {t('courses.closed')}
      </StatusBadge>
    )

  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface lg:rounded-none lg:border-0 lg:bg-transparent">
      <Link
        to={`/courses/${course.id}`}
        className={
          'flex items-center gap-3.5 py-3.5 pr-3 pl-3.5 text-inherit no-underline hover:bg-canvas ' +
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ' +
          'lg:gap-5 lg:py-4 lg:pr-5 lg:pl-4'
        }
      >
        <CourseBadge code={course.code} state={state} />
        <div className="min-w-0 grow">
          <h3
            className={
              'm-0 font-display text-lg leading-[1.4] font-semibold lg:text-[21px] lg:leading-[1.35] ' +
              (course.is_closed ? 'text-ink-muted' : 'text-ink')
            }
          >
            {course.name}
          </h3>
          <p className="m-0 mt-0.5 text-sm leading-[1.6] text-ink-muted">
            {t('studentCourses.teacher', { name: teacher })}
          </p>
          {/* มือถือ: ป้ายอยู่ใต้ข้อมูล */}
          {closedFlag('mt-1.5 lg:hidden')}
        </div>
        {closedFlag('max-lg:hidden')}
        <span className="text-brand">
          <ChevronIcon />
        </span>
      </Link>
    </li>
  )
}
