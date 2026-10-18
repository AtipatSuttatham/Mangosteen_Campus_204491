/**
 * ตัวช่วยของฟอร์มรายวิชา (สร้าง — ขั้น 3.5 ; แก้ในแท็บตั้งค่า — ขั้น 3.6)
 * ชนิดข้อมูลในฟอร์ม, ค่าเริ่มต้น, ข้อความใต้ช่อง, แปลง error จาก backend
 * แยกจากไฟล์หน้าจอเพราะไฟล์ component ควร export แต่ component (กฎ react-refresh ของ ESLint)
 */
import type { FieldErrors, UseFormSetError } from 'react-hook-form'
import { ApiError } from '../../api/client'
import type { CourseCreate, Semester } from '../../api/courses'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../api/errors'
import { currentTerm } from '../../lib/terms'

/** ข้อมูลในฟอร์ม — ช่องตัวเลขเก็บเป็นข้อความระหว่างพิมพ์ แล้วแปลงตอนส่ง */
export type CourseFormValues = {
  academic_year: string
  semester: string
  code: string
  name: string
  description: string
}

/** ช่องที่ backend อาจตอบ error รายช่องกลับมา */
const COURSE_FORM_FIELDS = ['academic_year', 'semester', 'code', 'name', 'description'] as const

/** ฟอร์มเปล่าของ "สร้างรายวิชา": ปี / ภาคเริ่มที่ภาคเรียนปัจจุบัน (แก้ได้) */
export function emptyCourseForm(now: Date = new Date()): CourseFormValues {
  const term = currentTerm(now)
  return {
    academic_year: String(term.academic_year),
    semester: String(term.semester),
    code: '',
    name: '',
    description: '',
  }
}

/** แปลงค่าในฟอร์มเป็นข้อมูลที่ส่ง API (ตัดช่องว่าง ; backend ตรวจช่วงปีและรหัสซ้ำอีกครั้งเสมอ) */
export function toCourseData(values: CourseFormValues): CourseCreate {
  return {
    academic_year: Number(values.academic_year.trim()),
    semester: Number(values.semester) as Semester,
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
  }
}

/**
 * ข้อความใต้ช่อง: ช่องว่าง (ตรวจในหน้าเว็บ — required / validate "มีแต่ช่องว่าง") → "กรุณากรอกข้อมูลช่องนี้"
 * หรือข้อความจาก backend (type = server)
 */
export function courseFieldMessage(
  errors: FieldErrors<CourseFormValues>,
  field: keyof CourseFormValues,
): string | undefined {
  const error = errors[field]
  if (!error) return undefined
  return error.type === 'server' ? error.message : fieldErrorMessage('required')
}

/**
 * แปลง error จากการบันทึกเป็นข้อความบนหน้าจอ
 *   - กรอกผิดรายช่อง (validation_error) → ข้อความใต้ช่องนั้น เช่น "รหัสวิชานี้มีอยู่แล้วในภาคเรียนนี้" (คืน undefined)
 *   - อื่น ๆ (ติดต่อไม่ได้, course_closed ฯลฯ) → คืนข้อความรวมไว้แสดงเหนือปุ่ม
 */
export function applyCourseSaveError(
  caught: unknown,
  setError: UseFormSetError<CourseFormValues>,
): string | undefined {
  if (caught instanceof ApiError && caught.code === 'validation_error') {
    let placed = false
    for (const field of COURSE_FORM_FIELDS) {
      const message = fieldErrorsMessage(caught.fields[field])
      if (message) {
        setError(field, { type: 'server', message })
        placed = true
      }
    }
    return placed ? undefined : errorMessage('validation_error')
  }
  return errorMessage(caught instanceof ApiError ? caught.code : 'unknown')
}
