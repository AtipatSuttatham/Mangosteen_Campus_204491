/**
 * ส่วน "ข้อมูลรายวิชา" ของแท็บตั้งค่า (ขั้น 3.6) — ฟอร์มแก้รหัส / ชื่อ / ปี / ภาค / คำอธิบาย
 *
 * - บันทึกส่งเฉพาะช่องที่เปลี่ยน ; ปุ่มบันทึกกดไม่ได้จนกว่าจะแก้
 * - สำเร็จ → ป้าย "บันทึกข้อมูลรายวิชาแล้ว" ข้างปุ่ม จนกว่าจะแก้ช่องใดอีก (แบบหน้าข้อมูลส่วนตัว)
 * - วิชาที่ปิดแล้ว: ดูได้อย่างเดียว ไม่มีปุ่มบันทึก
 * - ใช้สถานะ "กำลังบันทึก" ของฟอร์มเอง ไม่ล็อกปุ่มของส่วนอื่น (เหมือนก่อนแยกไฟล์)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { updateCourse } from '../../../api/courses'
import { Button, StatusBadge } from '../../../components/ui'
import { afterCourseSaved, courseKey } from '../courseCache'
import { CourseFields } from '../CourseFields'
import { applyCourseSaveError, changedCourseData, courseToForm, type CourseFormValues } from '../courseForm'
import { CheckIcon } from '../icons'
import { useCoursePage, useRefreshCourse } from '../useCoursePage'
import { Hint, Section } from './SettingsSection'

export function CourseInfoSection({ className }: { className: string }) {
  const { t } = useTranslation()
  const { course, notify, isAdmin } = useCoursePage()
  const refresh = useRefreshCourse(course.id)
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string>()
  // บันทึกสำเร็จ → ป้าย "บันทึกข้อมูลรายวิชาแล้ว" ข้างปุ่ม จนกว่าจะแก้ช่องใดอีก
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CourseFormValues>({ values: courseToForm(course) })
  const closed = course.is_closed
  const teacher = `${course.teacher.first_name} ${course.teacher.last_name}`

  async function onSubmit(values: CourseFormValues) {
    setFormError(undefined)
    setSaved(false)
    notify(null)
    const changes = changedCourseData(course, values)
    // ต่างแค่ช่องว่างหน้า / หลัง → ไม่มีอะไรต้องบันทึก คืนค่าในช่องให้ตรงข้อมูลจริง
    if (Object.keys(changes).length === 0) {
      reset(courseToForm(course))
      return
    }
    try {
      const updated = await updateCourse(course.id, changes)
      queryClient.setQueryData(courseKey(course.id), updated)
      reset(courseToForm(updated))
      await afterCourseSaved(queryClient)
      setSaved(true)
    } catch (caught) {
      setFormError(applyCourseSaveError(caught, setError))
      if (caught instanceof ApiError && caught.code === 'course_closed') await refresh()
    }
  }

  return (
    <Section title={t('courseSettings.infoTitle')} body={t('courseSettings.infoBody')} className={className}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <CourseFields register={register} errors={errors} disabled={closed || isSubmitting} readOnlyView={closed} />
        {/* ผู้ดูแลระบบมีส่วน "ผู้สอน" แยกอยู่แล้ว → ไม่ต้องบอกซ้ำ */}
        {!isAdmin && <Hint>{t('courseSettings.teacherHint', { name: teacher })}</Hint>}
        {formError && (
          <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
            {formError}
          </p>
        )}
        {!closed && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            {/* role=status: โปรแกรมอ่านหน้าจออ่านเมื่อป้ายปรากฏ ; แก้ช่องใดอีก (isDirty) → ป้ายหาย */}
            <div role="status">
              {saved && !isDirty && (
                <StatusBadge tone="ok" icon={<CheckIcon />} className="w-fit">
                  {t('courseSettings.saved')}
                </StatusBadge>
              )}
            </div>
            <Button type="submit" disabled={!isDirty || isSubmitting} className="max-lg:w-full">
              {isSubmitting ? t('courseSettings.saving') : t('courseSettings.save')}
            </Button>
          </div>
        )}
      </form>
    </Section>
  )
}
