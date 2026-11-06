/**
 * หัวรายวิชา — การ์ดเดียวตาม board "หน้ารายวิชา" (ขั้น 3.6)
 *
 *   จอใหญ่:  [ป้ายรหัสวิชา] ชื่อ [สถานะ]                │ รหัสเข้าร่วม
 *            ปีการศึกษา 2569 ภาคเรียนที่ 1  ผู้สอน …     │ K7Q2XM9A [คัดลอก]
 *            ─────────────────────────────────────────
 *            ผู้เรียน 42 │ ตั้งค่า
 *   มือถือ:  ป้าย + ชื่อ / กล่องรหัสเข้าร่วม / แท็บ เรียงลงมา ไม่มีการ์ดครอบ
 *
 * รหัสเข้าร่วมแสดงเฉพาะตอนเปิดใช้และวิชายังไม่ปิด (ผู้สอนคัดลอกไปแจกได้เลย)
 */
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { courseState, type Course } from '../../api/courses'
import { CourseBadge, StatusBadge } from '../../components/ui'
import { CopyButton } from '../admin/users/CopyButton'
import { CountPill } from './courseBits'
import { EyeIcon, EyeOffIcon, LockIcon } from './icons'

/** แท็บ 1 อัน: ขีดม่วงใต้แท็บที่เปิดอยู่ */
const tabClass = ({ isActive }: { isActive: boolean }) =>
  'inline-flex items-center gap-2 border-b-2 px-0.5 py-3 text-[15px] no-underline ' +
  'focus-visible:outline-2 focus-visible:outline-accent ' +
  (isActive ? 'border-brand font-semibold text-ink' : 'border-transparent text-ink-muted')

export function CourseHeader({ course }: { course: Course }) {
  const { t } = useTranslation()
  const state = courseState(course)
  const teacher = `${course.teacher.first_name} ${course.teacher.last_name}`
  const showCode = course.join_code_enabled && course.join_code && !course.is_closed

  return (
    <section className="flex flex-col gap-3.5 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:gap-[22px] lg:px-7 lg:pt-6">
        <div className="flex min-w-0 grow items-center gap-3.5 lg:gap-[22px]">
          {/* ป้ายใหญ่บนจอใหญ่ ป้ายกลางบนมือถือ */}
          <CourseBadge code={course.code} state={state} size="lg" className="max-lg:hidden" />
          <CourseBadge code={course.code} state={state} size="md" className="lg:hidden" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="m-0 font-display text-2xl leading-[1.3] font-semibold lg:text-[32px]">
                {course.name}
              </h1>
              {state === 'published' ? (
                <StatusBadge tone="ok" icon={<EyeIcon />}>
                  {t('coursePage.published')}
                </StatusBadge>
              ) : (
                <StatusBadge tone="mute" icon={state === 'closed' ? <LockIcon /> : <EyeOffIcon />}>
                  {state === 'closed' ? t('courses.closed') : t('courses.draft')}
                </StatusBadge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-sm text-ink-muted lg:text-[14.5px]">
              <span>
                {t('courses.term', {
                  year: course.academic_year,
                  semester: t(`courses.semester${course.semester}`),
                })}
              </span>
              <span>{t('coursePage.teacher', { name: teacher })}</span>
            </div>
          </div>
        </div>
        {showCode && (
          // มือถือ: ป้าย + รหัสซ้อนกันทางซ้าย ปุ่มอยู่ขวา ; จอใหญ่: ป้ายอยู่บน รหัส + ปุ่มอยู่แถวล่าง
          <div
            className={
              'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[10px] border border-line bg-surface ' +
              'py-1.5 pr-1.5 pl-3.5 lg:shrink-0 lg:gap-y-1.5 lg:rounded-none lg:border-0 lg:border-l ' +
              'lg:border-line-soft lg:py-0 lg:pr-0 lg:pl-6'
            }
          >
            <span className="col-start-1 text-[13.5px] leading-[1.3] text-ink-muted">
              {t('coursePage.joinCode')}
            </span>
            <b className="col-start-1 text-[17px] font-semibold tracking-[0.14em] tabular-nums lg:text-xl lg:tracking-[0.16em]">
              {course.join_code}
            </b>
            <div className="col-start-2 row-span-2 row-start-1 lg:row-span-1 lg:row-start-2">
              <CopyButton text={course.join_code ?? ''} className="h-10! px-3!" />
            </div>
          </div>
        )}
      </div>
      <nav
        aria-label={t('coursePage.tabsLabel')}
        className="flex gap-7 border-b border-line lg:mt-[18px] lg:border-t lg:border-b-0 lg:border-line-soft lg:px-7"
      >
        <NavLink to={`/courses/${course.id}`} end className={tabClass}>
          {t('coursePage.tabStudents')}
          <CountPill>{course.student_count.toLocaleString('th-TH')}</CountPill>
        </NavLink>
        <NavLink to={`/courses/${course.id}/settings`} className={tabClass}>
          {t('coursePage.tabSettings')}
        </NavLink>
      </nav>
    </section>
  )
}
