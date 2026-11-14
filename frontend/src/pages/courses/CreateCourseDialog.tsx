/**
 * หน้าต่าง "สร้างรายวิชา" ของผู้สอน (UC-07 — ขั้น 3.5) เปิดจากปุ่ม "สร้างรายวิชา" บนหัวหน้า /courses
 * หน้าตาตาม board "สร้างรายวิชา — รหัสวิชาซ้ำในภาคเดียวกัน" (มือถือ = เต็มจอแบบหน้าต่างอื่นของระบบ)
 *
 *   ปี / ภาค (เริ่มที่ภาคเรียนปัจจุบัน) · รหัสวิชา · ชื่อ · คำอธิบาย (ไม่บังคับ) + หมายเหตุ
 *   → "สร้างรายวิชา" → POST /api/v1/courses/
 *
 * - backend ปฏิเสธรายช่อง (รหัสซ้ำในภาค, ปีนอกช่วง ฯลฯ) → ข้อความใต้ช่องนั้น ; อื่น ๆ → ข้อความเหนือปุ่ม
 * - ระหว่างบันทึก: ปุ่มกดไม่ได้ + "กำลังสร้างรายวิชา…" และปิดหน้าต่างไม่ได้ (กันสร้างซ้อน)
 * - สำเร็จ → หน้าหลักพาไปหน้ารายวิชาที่เพิ่งสร้าง (onCreated — ขั้น 3.6)
 * - ผู้ดูแลระบบ (chooseTeacher — ขั้น 3.8 board "สร้างรายวิชา (ผู้ดูแลระบบ)"): ช่อง "ผู้สอน" เป็นช่องแรก
 *   บังคับเลือก (backend บังคับเหมือนกัน) ; ผู้สอนเลือกไม่ได้แล้ว → ข้อความแดงใต้ช่องผู้สอน
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { createCourse, type Course } from '../../api/courses'
import { fieldErrorMessage, fieldErrorsMessage } from '../../api/errors'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui'
import { ADMIN_TEACHERS_KEY, afterCourseCreated } from './courseCache'
import { CourseFields } from './CourseFields'
import { applyCourseSaveError, emptyCourseForm, toCourseData, type CourseFormValues } from './courseForm'
import { InfoIcon } from './icons'

/** ลำดับช่องบนจอ (ใช้หาช่องแรกที่ผิด) */
const COURSE_FIELD_ORDER = ['academic_year', 'semester', 'code', 'name', 'description'] as const
import { TeacherSelect } from './TeacherSelect'

type CreateCourseDialogProps = {
  onClose: () => void
  /** สร้างสำเร็จ */
  onCreated: (course: Course) => void
  /** ผู้ดูแลระบบสร้างแทนผู้สอน → มีช่องเลือกผู้สอน (ขั้น 3.8) */
  chooseTeacher?: boolean
}

export function CreateCourseDialog({ onClose, onCreated, chooseTeacher = false }: CreateCourseDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const teacherRef = useRef<HTMLSelectElement | null>(null)
  // error ที่ไม่ผูกกับช่องใด (เช่น ติดต่อเซิร์ฟเวอร์ไม่ได้)
  const [formError, setFormError] = useState<string>()
  // ผู้สอนที่เลือก (เฉพาะผู้ดูแลระบบ) — แยกจากฟอร์มหลักเพราะช่องรายวิชาใช้ร่วมกับแท็บตั้งค่า
  const [teacher, setTeacher] = useState('')
  const [teacherError, setTeacherError] = useState<string>()
  // ค่าเริ่มต้นคำนวณครั้งเดียวตอนเปิดหน้าต่าง
  const [initialValues] = useState(() => emptyCourseForm())

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormValues>({
    defaultValues: initialValues,
    // ผู้ดูแลระบบ: ช่องผู้สอนอยู่บนสุดแต่ไม่ได้อยู่ในฟอร์มนี้ → ย้ายโฟกัสเอง (onInvalid) ให้ไปช่องแรกที่ผิดตามลำดับบนจอ
    shouldFocusError: !chooseTeacher,
  })

  // ระหว่างส่งฟอร์มทุกช่องถูกล็อก (disabled) → โฟกัสไม่ได้ ; จำไว้แล้วโฟกัสช่องผู้สอนเมื่อส่งเสร็จ
  const focusTeacherLater = useRef(false)
  useEffect(() => {
    if (!isSubmitting && focusTeacherLater.current) {
      focusTeacherLater.current = false
      teacherRef.current?.focus()
    }
  }, [isSubmitting])

  /** กรอกไม่ครบ (ผู้ดูแลระบบ): โฟกัสช่องผู้สอนถ้ายังไม่เลือก ไม่งั้นช่องแรกที่ผิดตามลำดับบนจอ */
  function onInvalid(fieldErrors: FieldErrors<CourseFormValues>) {
    if (!chooseTeacher) return
    if (!teacher) {
      focusTeacherLater.current = true
      return
    }
    const first = COURSE_FIELD_ORDER.find((field) => fieldErrors[field])
    if (first) setFocus(first)
  }

  /** ส่งฟอร์ม (เรียกเมื่อกรอกช่องบังคับครบแล้ว) */
  async function onSubmit(values: CourseFormValues) {
    setFormError(undefined)
    setTeacherError(undefined)
    if (chooseTeacher && !teacher) {
      setTeacherError(fieldErrorMessage('required'))
      focusTeacherLater.current = true
      return
    }
    try {
      const data = toCourseData(values)
      const course = await createCourse(chooseTeacher ? { ...data, teacher: Number(teacher) } : data)
      // รายการที่มีวิชานี้ต้องโหลดใหม่เมื่อกลับมา (ผู้สอน: รายวิชาของฉัน ; ผู้ดูแลระบบ: รายการทั้งระบบ + ตัวกรอง)
      await afterCourseCreated(queryClient)
      onCreated(course)
    } catch (caught) {
      // ผู้สอนที่เลือกใช้ไม่ได้แล้ว (เช่น เพิ่งถูกระงับ) → ข้อความใต้ช่องผู้สอน
      const teacherMessage =
        caught instanceof ApiError ? fieldErrorsMessage(caught.fields.teacher) : undefined
      if (teacherMessage) {
        setTeacherError(teacherMessage)
        await queryClient.invalidateQueries({ queryKey: ADMIN_TEACHERS_KEY })
      }
      const message = applyCourseSaveError(caught, setError)
      // มีแต่ error ของช่องผู้สอน → ไม่ต้องขึ้นข้อความรวมซ้ำ
      const onlyTeacher =
        teacherMessage &&
        caught instanceof ApiError &&
        Object.keys(caught.fields).every((field) => field === 'teacher')
      setFormError(onlyTeacher ? undefined : message)
    }
  }

  // ระหว่างบันทึกปิดหน้าต่างไม่ได้ (รอผลก่อน)
  const requestClose = () => {
    if (!isSubmitting) onClose()
  }

  return (
    <Dialog
      labelledBy={titleId}
      onClose={requestClose}
      initialFocusRef={chooseTeacher ? teacherRef : firstFieldRef}
    >
      <form
        noValidate
        onSubmit={(event) => {
          // ยังไม่เลือกผู้สอน → ขึ้นข้อความพร้อมช่องอื่นที่ยังไม่กรอก (ไม่ต้องรอช่องอื่นครบก่อน)
          if (chooseTeacher && !teacher) setTeacherError(fieldErrorMessage('required'))
          void handleSubmit(onSubmit, onInvalid)(event)
        }}
        className="flex grow flex-col"
      >
        <DialogHeader
          titleId={titleId}
          title={t('courseForm.createTitle')}
          // หัวเล็กบอกว่ามาจากหน้าไหน: ผู้ดูแลระบบ = "จัดการรายวิชา" (พบตอนตรวจมือถือ ขั้น 3.8)
          eyebrow={chooseTeacher ? t('adminCourses.title') : t('courses.title')}
          onClose={requestClose}
          closeDisabled={isSubmitting}
        />
        <DialogBody>
          {chooseTeacher && (
            <TeacherSelect
              label={t('courseForm.teacher')}
              value={teacher}
              onChange={(value) => {
                setTeacher(value)
                setTeacherError(undefined)
              }}
              hint={t('courseForm.teacherHint')}
              error={teacherError}
              disabled={isSubmitting}
              selectRef={teacherRef}
            />
          )}
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
