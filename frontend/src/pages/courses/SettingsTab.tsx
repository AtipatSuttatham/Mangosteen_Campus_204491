/**
 * แท็บตั้งค่าของหน้ารายวิชา (UC-07 — ขั้น 3.6) ตาม board "แท็บตั้งค่า" + "ยืนยันปิดรายวิชา" + มือถือ
 *
 *   จอใหญ่: การ์ดเดียว แต่ละส่วนซ้าย = หัวข้อ ขวา = เนื้อหา ; ปิด / ลบ แยกเป็นการ์ดขอบแดงด้านล่าง
 *   มือถือ: การ์ดแยกกัน เรียง การเผยแพร่ → รหัสเข้าร่วม → ข้อมูลรายวิชา → ปิด / ลบ (ตาม board มือถือ)
 *
 * - ยืนยันก่อน: ยกเลิกเผยแพร่ (ง1), สร้างรหัสใหม่ (ค1), ปิดรายวิชา, ลบรายวิชา
 * - ทำทันที: เผยแพร่, เปิด / ปิดการใช้รหัส
 * - วิชาที่ปิดแล้ว: ดูข้อมูลได้อย่างเดียว + "ปิดเมื่อ … โดย …" ; เปิดคืนได้เฉพาะผู้ดูแลระบบ (ขั้น 3.8)
 * - ปุ่มลบแสดงตาม can_delete จาก backend (backend ตรวจซ้ำตอนลบ)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import {
  deleteCourse,
  runCourseAction,
  updateCourse,
  type Course,
  type CourseAction,
} from '../../api/courses'
import { errorMessage } from '../../api/errors'
import { Button, ConfirmDialog, StatusBadge } from '../../components/ui'
import { formatDateTime } from '../../lib/datetime'
import { CopyButton } from '../admin/users/CopyButton'
import { CourseFields } from './CourseFields'
import {
  applyCourseSaveError,
  changedCourseData,
  courseToForm,
  type CourseFormValues,
} from './courseForm'
import { EyeIcon, EyeOffIcon, LockIcon, RefreshIcon } from './icons'
import { useCoursePage, useRefreshCourse } from './useCoursePage'

/** หน้าต่างยืนยันที่เปิดอยู่ */
type Confirming = 'unpublish' | 'regenerate' | 'close' | 'delete'

/** ส่วนหนึ่งของแท็บ: หัวข้อ + คำอธิบาย แล้วตามด้วยเนื้อหา */
function Section({
  title,
  body,
  danger = false,
  className = '',
  children,
}: {
  title: string
  body: string
  danger?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={
        'flex flex-col gap-3.5 rounded-card border bg-surface px-4 py-[18px] ' +
        'lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-7 lg:py-[26px] ' +
        `${danger ? 'border-bad-line' : 'border-line'} ${className}`
      }
    >
      <div>
        <h2
          className={`m-0 font-display text-lg leading-[1.4] font-semibold lg:text-[19px] ${danger ? 'text-bad' : ''}`}
        >
          {title}
        </h2>
        <p className="m-0 mt-1 text-sm leading-[1.6] text-ink-muted">{body}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}

/** สวิตช์เปิด / ปิด ตาม .sw ใน board */
function Switch({
  checked,
  labelledBy,
  disabled,
  onChange,
}: {
  checked: boolean
  labelledBy: string
  disabled: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onChange}
      className={
        'relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-0 p-0 disabled:cursor-not-allowed ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
        (checked ? 'bg-brand' : 'bg-line-strong')
      }
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] size-[22px] rounded-full bg-surface ${checked ? 'left-[23px]' : 'left-[3px]'}`}
      />
    </button>
  )
}

const HINT = 'm-0 text-[13.5px] leading-[1.55] text-ink-muted'

/** ฟอร์มข้อมูลรายวิชา */
function InfoForm({ course, className }: { course: Course; className: string }) {
  const { t } = useTranslation()
  const { notify } = useCoursePage()
  const refresh = useRefreshCourse(course.id)
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CourseFormValues>({ values: courseToForm(course) })
  const closed = course.is_closed
  const teacher = `${course.teacher.first_name} ${course.teacher.last_name}`

  async function onSubmit(values: CourseFormValues) {
    setFormError(undefined)
    notify(null)
    try {
      const updated = await updateCourse(course.id, changedCourseData(course, values))
      queryClient.setQueryData(['course', course.id], updated)
      await queryClient.invalidateQueries({ queryKey: ['my-courses'] })
      notify({ tone: 'ok', text: t('courseSettings.saved') })
    } catch (caught) {
      setFormError(applyCourseSaveError(caught, setError))
      if (caught instanceof ApiError && caught.code === 'course_closed') await refresh()
    }
  }

  return (
    <Section title={t('courseSettings.infoTitle')} body={t('courseSettings.infoBody')} className={className}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <CourseFields register={register} errors={errors} disabled={closed || isSubmitting} />
        <p className={HINT}>{t('courseSettings.teacherHint', { name: teacher })}</p>
        {formError && (
          <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
            {formError}
          </p>
        )}
        {!closed && (
          <div className="flex lg:justify-end">
            <Button type="submit" disabled={!isDirty || isSubmitting} className="max-lg:w-full">
              {isSubmitting ? t('courseSettings.saving') : t('courseSettings.save')}
            </Button>
          </div>
        )}
      </form>
    </Section>
  )
}

export default function SettingsTab() {
  const { t } = useTranslation()
  const { course, notify } = useCoursePage()
  const refresh = useRefreshCourse(course.id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // ปุ่มที่ทำทันทีกำลังรอผล (ปุ่มกลุ่มนั้นกดไม่ได้)
  const [running, setRunning] = useState(false)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [confirmError, setConfirmError] = useState<string>()
  const closeConfirm = () => {
    setConfirming(null)
    setConfirmError(undefined)
  }

  const apiMessage = (caught: unknown) =>
    errorMessage(caught instanceof ApiError ? caught.code : 'unknown')

  /** ส่งคำสั่ง แล้วใช้ข้อมูลวิชาล่าสุดที่ backend ส่งกลับมา */
  async function apply(action: CourseAction) {
    const updated = await runCourseAction(course.id, action)
    queryClient.setQueryData(['course', course.id], updated)
    await queryClient.invalidateQueries({ queryKey: ['my-courses'] })
  }

  /** ปุ่มที่ทำทันที */
  async function runNow(action: CourseAction, noticeText?: string) {
    setRunning(true)
    notify(null)
    try {
      await apply(action)
      if (noticeText) notify({ tone: 'ok', text: noticeText })
    } catch (caught) {
      notify({ tone: 'bad', text: t('courseSettings.actionFailed', { reason: apiMessage(caught) }) })
      await refresh()
    } finally {
      setRunning(false)
    }
  }

  /** ปุ่มยืนยันในหน้าต่าง */
  async function runConfirmed(action: CourseAction, noticeText: string) {
    setRunning(true)
    setConfirmError(undefined)
    try {
      await apply(action)
      notify({ tone: 'ok', text: noticeText })
      closeConfirm()
    } catch (caught) {
      setConfirmError(apiMessage(caught))
      await refresh()
    } finally {
      setRunning(false)
    }
  }

  /** ลบรายวิชา แล้วกลับหน้ารายวิชาของฉันพร้อมแถบเขียว */
  async function confirmDelete() {
    setRunning(true)
    setConfirmError(undefined)
    try {
      await deleteCourse(course.id)
      await queryClient.invalidateQueries({ queryKey: ['my-courses'] })
      queryClient.removeQueries({ queryKey: ['course', course.id] })
      const notice = t('courseSettings.deletedNotice', { code: course.code, name: course.name })
      await navigate('/courses', { state: { notice } })
    } catch (caught) {
      setConfirmError(apiMessage(caught))
      await refresh()
      setRunning(false)
    }
  }

  const closed = course.is_closed
  const published = course.is_published
  const joinLabelId = `course-${course.id}-join`

  return (
    <>
      {closed && (
        <div className="flex flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3.5 lg:px-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge tone="mute" icon={<LockIcon />}>
              {t('courses.closed')}
            </StatusBadge>
            {course.closed_at && (
              <span className="text-sm text-ink-muted">
                {t('courseSettings.closedNote', {
                  date: formatDateTime(course.closed_at),
                  name: course.closed_by ?? '',
                })}
              </span>
            )}
          </div>
          <p className={HINT}>{t('courseSettings.closedHint')}</p>
        </div>
      )}

      {/* จอใหญ่: การ์ดเดียว ส่วนต่าง ๆ คั่นด้วยเส้น ; มือถือ: การ์ดแยก เรียงตาม order */}
      <div className="flex flex-col gap-3 lg:gap-0 lg:divide-y lg:divide-line-soft lg:rounded-card lg:border lg:border-line lg:bg-surface">
        <InfoForm course={course} className="order-3 lg:order-none" />

        {!closed && (
          <Section
            title={t('courseSettings.publishTitle')}
            body={t('courseSettings.publishBody')}
            className="order-1 lg:order-none"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3.5">
              <StatusBadge
                tone={published ? 'ok' : 'mute'}
                icon={published ? <EyeIcon /> : <EyeOffIcon />}
                className="w-fit"
              >
                {published ? t('coursePage.published') : t('courses.draft')}
              </StatusBadge>
              <span className="text-sm leading-[1.6] text-ink-muted">
                {published ? t('courseSettings.publishedNote') : t('courseSettings.draftNote')}
              </span>
              {published ? (
                <Button
                  variant="secondary"
                  disabled={running}
                  onClick={() => setConfirming('unpublish')}
                  className="lg:ml-auto"
                >
                  {t('courseSettings.unpublish')}
                </Button>
              ) : (
                <Button
                  disabled={running}
                  onClick={() => void runNow('publish', t('courseSettings.publishedNotice'))}
                  className="lg:ml-auto"
                >
                  {t('courseSettings.publish')}
                </Button>
              )}
            </div>
            {published && <p className={HINT}>{t('courseSettings.unpublishHint')}</p>}
          </Section>
        )}

        {!closed && (
          <Section
            title={t('courseSettings.joinTitle')}
            body={t('courseSettings.joinBody')}
            className="order-2 lg:order-none"
          >
            <div className="flex items-center gap-3.5">
              <Switch
                checked={course.join_code_enabled}
                labelledBy={joinLabelId}
                disabled={running}
                onChange={() =>
                  void runNow(course.join_code_enabled ? 'join-code/disable' : 'join-code/enable')
                }
              />
              <span id={joinLabelId} className="text-[15px] font-semibold">
                {t('courseSettings.joinSwitch')}
              </span>
            </div>
            {course.join_code_enabled && course.join_code ? (
              <>
                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-canvas px-[18px] py-4">
                  <div>
                    <div className="text-sm leading-[1.6] text-ink-muted">{t('courseSettings.joinCode')}</div>
                    <div className="text-[30px] leading-[1.3] font-semibold tracking-[0.2em] tabular-nums">
                      {course.join_code}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:ml-auto">
                    <CopyButton text={course.join_code} className="h-11!" />
                    <Button variant="secondary" disabled={running} onClick={() => setConfirming('regenerate')}>
                      <RefreshIcon />
                      {t('courseSettings.regenerate')}
                    </Button>
                  </div>
                </div>
                <p className={HINT}>{t('courseSettings.regenerateHint')}</p>
              </>
            ) : (
              <p className={HINT}>{t('courseSettings.joinOffHint')}</p>
            )}
          </Section>
        )}
      </div>

      {/* เผยแพร่แล้ว = ปิดรายวิชาได้ ; ลบได้ = ยังไม่เผยแพร่และไม่เคยมีผู้เรียน */}
      {!closed && (published || course.can_delete) && (
        <div className="lg:rounded-card lg:border lg:border-bad-line lg:bg-surface">
          <Section
            danger
            title={published ? t('courseSettings.closeTitle') : t('courseSettings.deleteTitle')}
            body={published ? t('courseSettings.closeBody') : t('courseSettings.deleteBody')}
          >
            <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:gap-4">
              <p className="m-0 grow text-sm leading-[1.6] text-ink-muted">
                {published ? t('courseSettings.closeNote') : t('courseSettings.deleteNote')}
              </p>
              <Button
                variant="danger"
                disabled={running}
                onClick={() => setConfirming(published ? 'close' : 'delete')}
                className="shrink-0"
              >
                {published ? t('courseSettings.close') : t('courseSettings.delete')}
              </Button>
            </div>
          </Section>
        </div>
      )}

      {confirming === 'unpublish' && (
        <ConfirmDialog
          tone="primary"
          title={t('courseSettings.unpublishTitle', { name: course.name })}
          description={[t('courseSettings.unpublishHint')]}
          confirmLabel={t('courseSettings.unpublish')}
          pendingLabel={t('courseSettings.unpublishing')}
          pending={running}
          error={confirmError}
          onConfirm={() => void runConfirmed('unpublish', t('courseSettings.unpublishedNotice'))}
          onCancel={closeConfirm}
        />
      )}
      {confirming === 'regenerate' && (
        <ConfirmDialog
          tone="primary"
          title={t('courseSettings.regenerateTitle')}
          description={[
            t('courseSettings.regenerateBody', { code: course.join_code }),
            t('courseSettings.regenerateBody2'),
          ]}
          confirmLabel={t('courseSettings.regenerate')}
          pendingLabel={t('courseSettings.regenerating')}
          pending={running}
          error={confirmError}
          onConfirm={() =>
            void runConfirmed('join-code/regenerate', t('courseSettings.regeneratedNotice'))
          }
          onCancel={closeConfirm}
        />
      )}
      {confirming === 'close' && (
        <ConfirmDialog
          title={t('courseSettings.closeConfirmTitle', { name: course.name })}
          description={[
            t('courseSettings.closeConfirm1', { total: course.student_count }),
            t('courseSettings.closeConfirm2'),
            t('courseSettings.closeConfirm3'),
          ]}
          confirmLabel={t('courseSettings.close')}
          pendingLabel={t('courseSettings.closing')}
          pending={running}
          error={confirmError}
          onConfirm={() => void runConfirmed('close', t('courseSettings.closedNotice'))}
          onCancel={closeConfirm}
        />
      )}
      {confirming === 'delete' && (
        <ConfirmDialog
          title={t('courseSettings.deleteConfirmTitle', { name: course.name })}
          description={[t('courseSettings.deleteConfirm')]}
          confirmLabel={t('courseSettings.delete')}
          pendingLabel={t('courseSettings.deleting')}
          pending={running}
          error={confirmError}
          onConfirm={() => void confirmDelete()}
          onCancel={closeConfirm}
        />
      )}
    </>
  )
}
