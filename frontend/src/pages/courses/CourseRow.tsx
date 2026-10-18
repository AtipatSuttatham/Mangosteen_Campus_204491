/**
 * แถวรายวิชา 1 แถวในหน้า "รายวิชาของฉัน" ของผู้สอน — ตาม board "รายวิชาของฉัน (ผู้สอน)" (ขั้น 3.5)
 *
 *   ┏━━━━━━━━┓  Python พื้นฐาน                                  [ยังไม่เผยแพร่]
 *   ┃ 204111 ┃  42 ผู้เรียน    รหัสเข้าร่วม K7Q2XM9A
 *   ┗━━━━━━━━┛
 *   ป้ายรหัสวิชาบอกสถานะ + ป้ายข้อความ (เฉพาะยังไม่เผยแพร่ / ปิดแล้ว) สำหรับคนที่แยกสีไม่ออก
 *
 * ขั้น 3.5 ยังไม่มีหน้ารายวิชา จึงยังกดแถวไม่ได้ (กฎ "แสดงเฉพาะสิ่งที่ทำเสร็จแล้ว") —
 * ขั้น 3.6 ทำทั้งแถวเป็นลิงก์ไปหน้ารายวิชา + ลูกศร › ตาม board
 * ซ่อนจำนวนหน่วยการเรียนไว้จนถึงก้อน 4 (ข้อตกลงก้อน 3)
 */
import { useTranslation } from 'react-i18next'
import { courseState, type Course } from '../../api/courses'
import { CourseBadge, StatusBadge } from '../../components/ui'
import { EyeOffIcon, LockIcon } from './icons'

export function CourseRow({ course }: { course: Course }) {
  const { t } = useTranslation()
  const state = courseState(course)

  // ข้อมูลใต้ชื่อวิชา (ตาม board): จำนวนผู้เรียน + รหัสเข้าร่วม ; วิชาที่ปิดแล้วบอกว่าดูย้อนหลังได้อย่างเดียว
  const stats = [
    course.student_count > 0
      ? t('courses.studentCount', { total: course.student_count.toLocaleString('th-TH') })
      : t('courses.noStudents'),
    state === 'closed'
      ? t('courses.closedNote')
      : course.join_code_enabled && course.join_code
        ? t('courses.joinCode', { code: course.join_code })
        : t('courses.joinCodeOff'),
  ]

  return (
    <li className="flex items-center gap-3.5 px-3.5 py-3.5 lg:gap-5 lg:py-4 lg:pr-5 lg:pl-4">
      <CourseBadge code={course.code} state={state} />
      <div className="min-w-0 grow">
        <h3
          className={
            'm-0 font-display text-lg leading-[1.4] font-semibold lg:text-[21px] lg:leading-[1.35] ' +
            (state === 'published' ? 'text-ink' : 'text-ink-muted')
          }
        >
          {course.name}
        </h3>
        <p className="m-0 mt-0.5 flex flex-wrap gap-x-5 gap-y-1 text-sm leading-[1.6] text-ink-muted">
          {stats.map((text) => (
            <span key={text}>{text}</span>
          ))}
        </p>
        {/* มือถือ: ป้ายสถานะอยู่ใต้ข้อมูล (แถวแคบ) */}
        <StateFlag state={state} className="mt-1.5 lg:hidden" />
      </div>
      {/* จอใหญ่: ป้ายสถานะอยู่ขวาสุด */}
      <StateFlag state={state} className="max-lg:hidden" />
    </li>
  )
}

/** ป้ายข้อความของสถานะ (วิชาที่เผยแพร่แล้วไม่มีป้าย — ตาม board) */
function StateFlag({ state, className }: { state: ReturnType<typeof courseState>; className: string }) {
  const { t } = useTranslation()
  if (state === 'published') return null
  return (
    <StatusBadge
      tone="mute"
      icon={state === 'closed' ? <LockIcon /> : <EyeOffIcon />}
      className={`w-fit shrink-0 ${className}`}
    >
      {state === 'closed' ? t('courses.closed') : t('courses.draft')}
    </StatusBadge>
  )
}
