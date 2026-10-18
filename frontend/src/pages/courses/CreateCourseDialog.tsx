/**
 * หน้าต่าง "สร้างรายวิชา" ของผู้สอน (UC-07 — ขั้น 3.5) เปิดจากปุ่ม "สร้างรายวิชา" บนหัวหน้า /courses
 * หน้าตาตาม board "สร้างรายวิชา — รหัสวิชาซ้ำในภาคเดียวกัน" (มือถือ = เต็มจอแบบหน้าต่างอื่นของระบบ)
 *
 *   ปี / ภาค (เริ่มที่ภาคเรียนปัจจุบัน) · รหัสวิชา · ชื่อ · คำอธิบาย (ไม่บังคับ) + หมายเหตุ
 *   → "สร้างรายวิชา" → POST /api/v1/courses/
 *
 * - backend ปฏิเสธรายช่อง (รหัสซ้ำในภาค, ปีนอกช่วง ฯลฯ) → ข้อความใต้ช่องนั้น ; อื่น ๆ → ข้อความเหนือปุ่ม
 * - ระหว่างบันทึก: ปุ่มกดไม่ได้ + "กำลังสร้างรายวิชา…" และปิดหน้าต่างไม่ได้ (กันสร้างซ้อน)
 * - สำเร็จ → ปิดหน้าต่าง แล้วหน้าหลักแสดงแถบเขียว + เปิดกลุ่มภาคของวิชาใหม่ (onCreated)
 *   (ขั้น 3.6 จะพาไปหน้ารายวิชาที่เพิ่งสร้างแทน — ตอนนี้ยังไม่มีหน้านั้น)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createCourse, type Course } from '../../api/courses'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui'
import { CourseFields } from './CourseFields'
import { applyCourseSaveError, emptyCourseForm, toCourseData, type CourseFormValues } from './courseForm'
import { InfoIcon } from './icons'

type CreateCourseDialogProps = {
  onClose: () => void
  /** สร้างสำเร็จ (หน้าต่างปิดตามหลังจากนี้) */
  onCreated: (course: Course) => void
}

export function CreateCourseDialog({ onClose, onCreated }: CreateCourseDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  // error ที่ไม่ผูกกับช่องใด (เช่น ติดต่อเซิร์ฟเวอร์ไม่ได้)
  const [formError, setFormError] = useState<string>()
  // ค่าเริ่มต้นคำนวณครั้งเดียวตอนเปิดหน้าต่าง
  const [initialValues] = useState(() => emptyCourseForm())

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormValues>({ defaultValues: initialValues })

  /** ส่งฟอร์ม (เรียกเมื่อกรอกช่องบังคับครบแล้ว) */
  async function onSubmit(values: CourseFormValues) {
    setFormError(undefined)
    try {
      const course = await createCourse(toCourseData(values))
      // รายการด้านหลังโหลดใหม่ (วิชาใหม่ขึ้นในกลุ่มภาคของมัน)
      await queryClient.invalidateQueries({ queryKey: ['my-courses'] })
      onCreated(course)
      onClose()
    } catch (caught) {
      setFormError(applyCourseSaveError(caught, setError))
    }
  }

  // ระหว่างบันทึกปิดหน้าต่างไม่ได้ (รอผลก่อน)
  const requestClose = () => {
    if (!isSubmitting) onClose()
  }

  return (
    <Dialog labelledBy={titleId} onClose={requestClose} initialFocusRef={firstFieldRef}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex grow flex-col">
        <DialogHeader
          titleId={titleId}
          title={t('courseForm.createTitle')}
          eyebrow={t('courses.title')}
          onClose={requestClose}
          closeDisabled={isSubmitting}
        />
        <DialogBody>
          <CourseFields
            register={register}
            errors={errors}
            firstFieldRef={firstFieldRef}
            disabled={isSubmitting}
          />
          {/* หมายเหตุ: วิชาใหม่ยังไม่เผยแพร่ (ตาม board) */}
          <div className="flex items-start gap-2.5 rounded-[10px] bg-mute-soft px-3.5 py-3 text-[13.5px] leading-[1.55] text-mute">
            <span className="mt-0.5">
              <InfoIcon />
            </span>
            <p className="m-0">{t('courseForm.note')}</p>
          </div>
          {formError && (
            <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
              {formError}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
            {t('dialog.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('courseForm.creating') : t('courseForm.create')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
