/**
 * หน้ารายวิชาของผู้เรียน /courses/:courseId (ขั้น 3.7 — ผู้ใช้เลือกแบบ ก ในขั้น 3.1)
 * หน้าตาตาม board "หน้ารายวิชา (ผู้เรียน) — ยังไม่มีเนื้อหา" แถวก้อน 3 ใน design canvas
 *
 *   ‹ รายวิชาของฉัน
 *   ┌ [204111]  Python พื้นฐาน  [ปิดรายวิชาแล้ว]                     ┐  ← ป้ายสถานะเฉพาะวิชาที่ปิด
 *   │           ปีการศึกษา 2569 ภาคเรียนที่ 1   ผู้สอน กมล ศรีวงศ์   │
 *   └─────────────────────────────────────────────────────┘
 *   ┌ เกี่ยวกับรายวิชา  (คำอธิบายแบบ Markdown — ซ่อนถ้าไม่มี)        ┐
 *   ┌            ✿  ยังไม่มีเนื้อหาในรายวิชานี้                        ┐  ← ก้อน 4 เติมเนื้อหาตรงนี้
 *
 * - backend ตรวจทุกครั้งว่ากำลังเรียนอยู่และวิชาเผยแพร่แล้ว ; ไม่ผ่าน = 404 → "ไม่พบรายวิชา"
 *   (เหมือนไม่มีวิชา — ไม่บอกว่าวิชามีอยู่จริงไหม)
 * - /courses/:courseId/settings เป็นของผู้สอน → ผู้เรียนเปิดแล้วได้ "ไม่พบรายวิชา" เช่นกัน
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useMatch, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { fetchStudentCourse, type StudentCourse } from '../../api/courses'
import { errorMessage } from '../../api/errors'
import { Button, Card, CourseBadge, Markdown, StatusBadge } from '../../components/ui'
import { CalyxPattern } from '../../components/brand/CalyxPattern'
import { StateMessage } from './courseBits'
import { BackIcon, LockIcon } from './icons'

export default function StudentCoursePage() {
  const { t } = useTranslation()
  const { courseId } = useParams()
  const id = Number(courseId)
  // ที่อยู่ย่อยของผู้สอน (แท็บตั้งค่า) ไม่มีสำหรับผู้เรียน
  const onTeacherOnlyPath = useMatch('/courses/:courseId/*')?.params['*'] !== ''
  const validId = Number.isInteger(id) && id > 0 && !onTeacherOnlyPath

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['student-course', id],
    queryFn: () => fetchStudentCourse(id),
    enabled: validId,
  })

  const notFound = !validId || (error instanceof ApiError && error.status === 404)

  return (
    <div className="flex flex-col gap-3.5 lg:gap-[18px]">
      <Link
        to="/courses"
        className={
          '-ml-1.5 inline-flex h-9 w-fit items-center gap-1 rounded-control px-1.5 text-[14.5px] font-semibold ' +
          'text-brand no-underline hover:bg-track focus-visible:outline-2 focus-visible:outline-accent'
        }
      >
        <BackIcon />
        {t('coursePage.back')}
      </Link>

      {notFound ? (
        <Card>
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-display text-xl font-semibold text-ink">{t('coursePage.notFoundTitle')}</p>
              <p className="m-0 mt-1">{t('coursePage.notFoundBody')}</p>
            </div>
          </StateMessage>
        </Card>
      ) : isPending ? (
        <Card>
          <StateMessage>
            <p className="m-0" role="status">
              {t('coursePage.loading')}
            </p>
          </StateMessage>
        </Card>
      ) : !data ? (
        <Card>
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-semibold text-ink">{t('coursePage.loadFailed')}</p>
              <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
            </div>
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('coursePage.retry')}
            </Button>
          </StateMessage>
        </Card>
      ) : (
        <CourseContent course={data} />
      )}
    </div>
  )
}

/** หัวรายวิชา + เกี่ยวกับรายวิชา + กล่องยังไม่มีเนื้อหา */
function CourseContent({ course }: { course: StudentCourse }) {
  const { t } = useTranslation()
  const state = course.is_closed ? 'closed' : 'published'
  const teacher = `${course.teacher.first_name} ${course.teacher.last_name}`
  const description = course.description.trim()

  return (
    <>
      {/* หัวรายวิชา: จอใหญ่ = การ์ด ; มือถือ = ไม่มีการ์ดครอบ (เหมือนหน้ารายวิชาของผู้สอน) */}
      <section className="flex items-center gap-3.5 lg:gap-[22px] lg:rounded-card lg:border lg:border-line lg:bg-surface lg:px-7 lg:py-6">
        <CourseBadge code={course.code} state={state} size="lg" className="max-lg:hidden" />
        <CourseBadge code={course.code} state={state} size="md" className="lg:hidden" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 font-display text-2xl leading-[1.3] font-semibold lg:text-[32px]">{course.name}</h1>
            {course.is_closed && (
              <StatusBadge tone="mute" icon={<LockIcon />}>
                {t('courses.closed')}
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
          {course.is_closed && (
            <p className="m-0 mt-1.5 text-[13.5px] leading-[1.55] text-ink-muted">{t('studentCourses.closedBody')}</p>
          )}
        </div>
      </section>

      {/* เกี่ยวกับรายวิชา — ผู้สอนไม่ได้เขียนคำอธิบายก็ไม่แสดงส่วนนี้ */}
      {description && (
        <section className="rounded-card border border-line bg-surface px-[18px] py-[18px] lg:px-7 lg:py-[22px]">
          <h2 className="m-0 mb-2 font-display text-lg font-semibold lg:text-[19px]">{t('studentCourses.about')}</h2>
          <Markdown text={description} className="max-w-[720px] lg:text-[15.5px] lg:leading-[1.75]" />
        </section>
      )}

      {/* ยังไม่มีเนื้อหา (ก้อน 4 แทนด้วยหน่วยการเรียน / แบบทดสอบ / งาน) */}
      <section className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-6 py-12 text-center">
        <CalyxPattern size={72} strokeWidth={1.2} className="text-brand opacity-45" />
        <h2 className="m-0 mt-1.5 font-display text-xl font-semibold lg:text-[21px]">
          {t('studentCourses.noContentTitle')}
        </h2>
        <p className="m-0 text-[15px] leading-[1.6] text-ink-muted">{t('studentCourses.noContentBody')}</p>
      </section>
    </>
  )
}
