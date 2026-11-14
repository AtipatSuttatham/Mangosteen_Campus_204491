/**
 * ชื่อที่เก็บข้อมูล (query key ของ TanStack Query) ของหน้ารายวิชาทั้งหมด + "หลังแก้อะไร ต้องล้างแคชไหนบ้าง"
 * รวมไว้ที่เดียว (รอบปรับโครงสร้างหลังขั้น 3.8) — เดิมพิมพ์ชื่อตรง ๆ กระจายหลายไฟล์ พิมพ์ผิดแล้วข้อมูลไม่โหลดใหม่โดยไม่มีใครเตือน
 *
 * หลักการ: ล้างแคช (invalidate) = บอกว่าข้อมูลชุดนั้นเก่าแล้ว → หน้าที่ใช้อยู่โหลดใหม่ทันที หน้าที่ไม่ได้เปิดโหลดใหม่ตอนเปิด
 * ล้างชุดที่ไม่มีในแคช (เช่น ผู้สอนไม่เคยโหลดรายการของผู้ดูแลระบบ) ไม่มีผลอะไร
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query'

// ---- ชื่อที่เก็บข้อมูล ----

/** รายวิชาของฉัน (ผู้สอน) */
export const MY_COURSES_KEY = ['my-courses'] as const
/** รายวิชาของฉัน (ผู้เรียน) */
export const STUDENT_COURSES_KEY = ['my-student-courses'] as const
/** รายการรายวิชาทั้งระบบของผู้ดูแลระบบ (คำต่อท้ายคือตัวกรอง) */
export const ADMIN_COURSES_KEY = ['admin-courses'] as const
/** รายชื่อผู้สอนทั้งหมด (ช่องเลือกผู้สอน + ตัวกรอง) */
export const ADMIN_TEACHERS_KEY = ['admin-teachers'] as const
/** ภาคเรียนที่มีรายวิชา (ตัวกรอง) */
export const ADMIN_TERMS_KEY = ['admin-terms'] as const

/** ข้อมูลวิชา 1 วิชาของหน้ารายวิชา (ผู้สอน / ผู้ดูแลระบบ) */
export const courseKey = (courseId: number) => ['course', courseId] as const
/** หน้ารายวิชาของผู้เรียน */
export const studentCourseKey = (courseId: number) => ['student-course', courseId] as const
/** รายชื่อผู้เรียนในวิชา (คำต่อท้ายคือตัวกรอง) */
export const rosterKey = (courseId: number) => ['roster', courseId] as const
/** ผลค้นหาผู้เรียนเพื่อเพิ่มเข้าวิชา (คำต่อท้ายคือคำค้น) */
export const candidatesKey = (courseId: number) => ['enrollment-candidates', courseId] as const

// ---- หลังแก้ข้อมูล ต้องล้างอะไรบ้าง ----

/** ล้างหลายชุดพร้อมกัน แล้วรอจนครบ */
async function invalidate(queryClient: QueryClient, keys: readonly QueryKey[]): Promise<void> {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

/** รายการที่แสดงวิชา (ชื่อ / สถานะ / จำนวนผู้เรียน) — ใช้หลังเปลี่ยนอะไรก็ตามของวิชา */
const COURSE_LISTS = [MY_COURSES_KEY, ADMIN_COURSES_KEY]

/** เผยแพร่ / รหัสเข้าร่วม / ปิด / เปิดคืน : เปลี่ยนแค่สถานะที่เห็นในรายการ */
export function afterCourseAction(queryClient: QueryClient): Promise<void> {
  return invalidate(queryClient, COURSE_LISTS)
}

/** บันทึกข้อมูลรายวิชา: ปี / ภาคที่แก้ อาจทำให้รายการภาคในตัวกรองของผู้ดูแลระบบเปลี่ยน */
export function afterCourseSaved(queryClient: QueryClient): Promise<void> {
  return invalidate(queryClient, [...COURSE_LISTS, ADMIN_TERMS_KEY])
}

/** เปลี่ยนผู้สอน: จำนวนวิชาของผู้สอนเดิม / ใหม่เปลี่ยน (ตัวกรอง "ผู้สอน" แสดงเฉพาะคนที่มีวิชา) */
export function afterTeacherChanged(queryClient: QueryClient): Promise<void> {
  return invalidate(queryClient, [...COURSE_LISTS, ADMIN_TEACHERS_KEY])
}

/** สร้างรายวิชา: มีวิชาใหม่ในรายการ + อาจมีภาคใหม่ + จำนวนวิชาของผู้สอนเปลี่ยน */
export function afterCourseCreated(queryClient: QueryClient): Promise<void> {
  return invalidate(queryClient, [...COURSE_LISTS, ADMIN_TERMS_KEY, ADMIN_TEACHERS_KEY])
}

/** ลบรายวิชา: เหมือนสร้าง + ทิ้งข้อมูลของวิชานั้น (ไม่มีวิชานี้แล้ว ไม่ต้องโหลดใหม่) */
export async function afterCourseDeleted(queryClient: QueryClient, courseId: number): Promise<void> {
  await afterCourseCreated(queryClient)
  queryClient.removeQueries({ queryKey: courseKey(courseId) })
}

/** ข้อมูลของวิชานี้ทั้งหมด (หัวรายวิชา, รายชื่อ, ผลค้นหา) + รายการวิชา — ใช้เมื่อไม่แน่ใจว่าวิชาเปลี่ยนไปแค่ไหน */
export function refreshCourse(queryClient: QueryClient, courseId: number): Promise<void> {
  return invalidate(queryClient, [
    courseKey(courseId),
    rosterKey(courseId),
    candidatesKey(courseId),
    ...COURSE_LISTS,
  ])
}
