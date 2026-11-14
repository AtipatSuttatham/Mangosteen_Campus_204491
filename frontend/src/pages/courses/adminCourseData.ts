/**
 * ข้อมูลประกอบของหน้าผู้ดูแลระบบที่ใช้หลายจุด (ขั้น 3.8)
 * แยกจากไฟล์หน้าจอเพราะไฟล์ component ควร export แต่ component (กฎ react-refresh ของ ESLint)
 *
 * - รายชื่อผู้สอน: ช่องเลือกผู้สอน (สร้างแทน / เปลี่ยนผู้สอน) + ตัวกรอง "ผู้สอน"
 * - ภาคเรียนที่มีรายวิชา: ตัวกรอง "ภาคเรียน"
 */
import { useQuery } from '@tanstack/react-query'
import { fetchAdminTeachers, fetchAdminTerms } from '../../api/courses'
import { ADMIN_TEACHERS_KEY, ADMIN_TERMS_KEY } from './courseCache'

/**
 * ใช้ข้อมูลที่โหลดไว้ต่อได้ 5 นาทีโดยไม่ขอใหม่ (เดิมขอใหม่ทุกครั้งที่เปิดหน้า / หน้าต่าง)
 * ปลอดภัยเพราะทุกจุดที่เปลี่ยนข้อมูลชุดนี้ล้างแคชเอง: สร้าง / แก้ปีภาค / ลบวิชา / เปลี่ยนผู้สอน (`courseCache.ts`)
 * และสร้าง / แก้ / ระงับ / เปิดใช้งาน / นำเข้าบัญชี (invalidateUserLists ในหน้าจัดการผู้ใช้)
 */
const ADMIN_LOOKUP_STALE_MS = 5 * 60 * 1000

/** รายชื่อผู้สอนทั้งหมด (โหลดครั้งเดียว ใช้ร่วมกันทุกจุด) — enabled = false เมื่อไม่ใช่ผู้ดูแลระบบ (กัน 403) */
export function useAdminTeachers(enabled = true) {
  return useQuery({
    queryKey: ADMIN_TEACHERS_KEY,
    queryFn: fetchAdminTeachers,
    enabled,
    staleTime: ADMIN_LOOKUP_STALE_MS,
  })
}

/** ภาคเรียนที่มีรายวิชาอยู่ */
export function useAdminTerms() {
  return useQuery({ queryKey: ADMIN_TERMS_KEY, queryFn: fetchAdminTerms, staleTime: ADMIN_LOOKUP_STALE_MS })
}

/** ชื่อเต็มของผู้สอน */
export function teacherName(teacher: { first_name: string; last_name: string }): string {
  return `${teacher.first_name} ${teacher.last_name}`
}

/**
 * ข้อความของผู้สอน 1 คนในช่องเลือก / ตัวกรอง: "กมล ศรีวงศ์ (T1024)" ; ไม่มีรหัสพนักงาน = ชื่ออย่างเดียว
 * ใส่รหัสเพราะชื่อซ้ำกันได้ (พบตอนทดสอบใน Chrome — ผู้สอน 2 คนชื่อเดียวกันแยกไม่ออก)
 */
export function teacherOptionLabel(
  teacher: { first_name: string; last_name: string; student_or_staff_id?: string | null },
  t: (key: 'courseForm.teacherOption', values: { name: string; id: string }) => string,
): string {
  return teacher.student_or_staff_id
    ? t('courseForm.teacherOption', { name: teacherName(teacher), id: teacher.student_or_staff_id })
    : teacherName(teacher)
}
