/**
 * ช่องเลือกผู้สอน — เฉพาะผู้ดูแลระบบ (ขั้น 3.8)
 * ใช้ในหน้าต่าง "สร้างรายวิชา" (สร้างแทนผู้สอน) และส่วน "ผู้สอน" ในแท็บตั้งค่า (เปลี่ยนผู้สอน)
 * ตาม board "สร้างรายวิชา (ผู้ดูแลระบบ)" + "ตั้งค่ารายวิชาที่ปิดแล้ว (ผู้ดูแลระบบ)"
 *
 *   ผู้สอน
 *   [กมล ศรีวงศ์ (T1024)          ⌄]
 *   เลือกได้เฉพาะบัญชีผู้สอนที่ใช้งานได้        ← คำแนะนำ / ข้อความแดงเมื่อผิด
 *
 * - รายชื่อมาจาก GET /admin/courses/teachers/ (ผู้ใช้เลือกแบบ ล1) ; ตัวเลือกที่กดได้ = assignable
 * - ผู้สอนปัจจุบันของวิชาที่เลือกไม่ได้แล้ว (บัญชีถูกระงับ) ยังแสดงเป็นตัวเลือกที่กดไม่ได้
 *   เพื่อให้ช่องบอกได้ว่าตอนนี้เป็นใคร
 * - backend ตรวจซ้ำเสมอ (teacher_not_assignable)
 */
import { useId, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { CourseTeacher } from '../../api/courses'
import { Select } from '../../components/ui'
import { teacherOptionLabel, useAdminTeachers } from './adminCourseData'

type TeacherSelectProps = {
  label: string
  /** รหัสผู้ใช้ของผู้สอนที่เลือก (ข้อความว่าง = ยังไม่เลือก) */
  value: string
  onChange: (value: string) => void
  /** ผู้สอนปัจจุบันของวิชา (แท็บตั้งค่า) — ไม่ส่ง = หน้าต่างสร้างรายวิชา (มีตัวเลือก "เลือกผู้สอน") */
  current?: CourseTeacher
  hint: string
  error?: string
  disabled?: boolean
  selectRef?: Ref<HTMLSelectElement>
}

export function TeacherSelect({
  label,
  value,
  onChange,
  current,
  hint,
  error,
  disabled = false,
  selectRef,
}: TeacherSelectProps) {
  const { t } = useTranslation()
  const id = useId()
  const hintId = useId()
  const { data, isPending, isError } = useAdminTeachers()

  /** ข้อความของตัวเลือก: "กมล ศรีวงศ์ (T1024)" ; ไม่มีรหัสพนักงาน = ชื่ออย่างเดียว */
  const optionLabel = (teacher: CourseTeacher & { student_or_staff_id?: string | null }) =>
    teacherOptionLabel(teacher, t)

  const options = (data ?? []).filter((teacher) => teacher.assignable)
  const currentListed = current && options.some((teacher) => teacher.id === current.id)
  const currentRow = current && data?.find((teacher) => teacher.id === current.id)

  // ข้อความใต้ช่อง: ผิด → สีแดง ; โหลดไม่ได้ / ไม่มีผู้สอน → บอกสาเหตุ ; ปกติ → คำแนะนำ
  const message =
    error ??
    (isPending
      ? t('courseForm.teachersLoading')
      : isError
        ? t('courseForm.teachersFailed')
        : options.length === 0
          ? t('courseForm.noTeachers')
          : hint)
  const isProblem = Boolean(error) || isError || (!isPending && options.length === 0)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      <Select
        id={id}
        ref={selectRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || isPending || isError}
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
      >
        {!current && (
          <option value="" disabled>
            {t('courseForm.teacherPlaceholder')}
          </option>
        )}
        {/* ผู้สอนปัจจุบันที่เลือกไม่ได้แล้ว: แสดงไว้ แต่กดไม่ได้ */}
        {current && !currentListed && (
          <option value={String(current.id)} disabled>
            {t('courseSettings.teacherCurrentSuspended', {
              name: optionLabel({ ...current, student_or_staff_id: currentRow?.student_or_staff_id }),
            })}
          </option>
        )}
        {options.map((teacher) => (
          <option key={teacher.id} value={String(teacher.id)}>
            {optionLabel(teacher)}
          </option>
        ))}
      </Select>
      <p
        id={hintId}
        className={'m-0 text-[13.5px] leading-[1.55] ' + (isProblem ? 'text-danger' : 'text-ink-muted')}
      >
        {message}
      </p>
    </div>
  )
}
