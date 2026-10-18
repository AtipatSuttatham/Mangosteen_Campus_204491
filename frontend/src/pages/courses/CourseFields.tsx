/**
 * ช่องกรอกข้อมูลรายวิชา — ใช้ในหน้าต่างสร้างรายวิชา (ขั้น 3.5) และแท็บตั้งค่า (ขั้น 3.6)
 * ตาม board "สร้างรายวิชา":
 *
 *   ปีการศึกษา   [2569     ]   ภาคเรียน [ภาคเรียนที่ 1 ⌄]
 *   รหัสวิชา      [204212                                ]
 *                 รหัสวิชานี้มีอยู่แล้วในภาคเรียนนี้        ← error จาก backend
 *   ชื่อรายวิชา    [โครงสร้างข้อมูล                         ]
 *   คำอธิบายรายวิชา [                                      ]  (ไม่บังคับ — Markdown)
 */
import { useId, type RefObject } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Select, TextField } from '../../components/ui'
import { courseFieldMessage, type CourseFormValues } from './courseForm'

type CourseFieldsProps = {
  register: UseFormRegister<CourseFormValues>
  errors: FieldErrors<CourseFormValues>
  /** ช่องแรก (ปีการศึกษา) — หน้าต่างโฟกัสที่นี่ตอนเปิด */
  firstFieldRef?: RefObject<HTMLInputElement | null>
  /** ล็อกทุกช่อง (เช่น ระหว่างบันทึก) */
  disabled?: boolean
}

/** ช่องกรอกข้อมูลรายวิชาทั้งชุด */
export function CourseFields({ register, errors, firstFieldRef, disabled = false }: CourseFieldsProps) {
  const { t } = useTranslation()
  const semesterId = useId()
  const descriptionId = useId()
  const descriptionHintId = useId()

  const yearField = register('academic_year', { required: true })
  const descriptionError = courseFieldMessage(errors, 'description')

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <TextField
          label={t('courseForm.year')}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          disabled={disabled}
          error={courseFieldMessage(errors, 'academic_year')}
          {...yearField}
          ref={(element) => {
            yearField.ref(element)
            if (firstFieldRef) firstFieldRef.current = element
          }}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={semesterId} className="text-[15px] font-semibold">
            {t('courseForm.semester')}
          </label>
          <Select id={semesterId} disabled={disabled} {...register('semester')}>
            <option value="1">{t('courses.semester1')}</option>
            <option value="2">{t('courses.semester2')}</option>
            <option value="3">{t('courses.semester3')}</option>
          </Select>
        </div>
      </div>
      <TextField
        label={t('courseForm.code')}
        autoComplete="off"
        maxLength={20}
        disabled={disabled}
        error={courseFieldMessage(errors, 'code')}
        {...register('code', { required: true, validate: (value) => value.trim() !== '' })}
      />
      <TextField
        label={t('courseForm.name')}
        autoComplete="off"
        maxLength={200}
        disabled={disabled}
        error={courseFieldMessage(errors, 'name')}
        {...register('name', { required: true, validate: (value) => value.trim() !== '' })}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={descriptionId} className="text-[15px] font-semibold">
          {t('courseForm.description')}
        </label>
        <textarea
          id={descriptionId}
          rows={3}
          disabled={disabled}
          placeholder={t('courseForm.descriptionPlaceholder')}
          aria-describedby={descriptionHintId}
          aria-invalid={descriptionError ? true : undefined}
          className={
            'w-full resize-y rounded-control border bg-surface px-3.5 py-3 text-[15px] leading-[1.6] text-ink ' +
            'placeholder:text-ink-muted/75 focus:outline-2 focus:outline-offset-1 focus:outline-brand ' +
            'disabled:border-line disabled:bg-canvas disabled:text-ink-muted ' +
            (descriptionError ? 'border-danger' : 'border-line-strong')
          }
          {...register('description')}
        />
        <p
          id={descriptionHintId}
          className={'m-0 text-[13.5px] leading-[1.55] ' + (descriptionError ? 'text-danger' : 'text-ink-muted')}
        >
          {descriptionError ?? t('courseForm.descriptionHint')}
        </p>
      </div>
    </>
  )
}
