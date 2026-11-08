/**
 * ล้างข้อมูลบัญชีที่หน้าเว็บเก็บไว้ หลังสร้าง / แก้ / ระงับ / เปิดใช้งาน / นำเข้าบัญชี (ขั้น 3.8 รอบเก็บงาน)
 *
 * - รายชื่อผู้ใช้ (หน้าจัดการผู้ใช้)
 * - รายชื่อผู้สอน (ช่องเลือกผู้สอน + ตัวกรองในหน้าจัดการรายวิชา) — เก็บไว้ 5 นาทีโดยไม่ขอใหม่ จึงต้องล้างเองที่นี่
 *   ไม่งั้นระงับผู้สอนแล้วกลับไปหน้ารายวิชาทันที ช่องเลือกอาจยังให้เลือกคนที่ถูกระงับ (backend ปฏิเสธอยู่ดี)
 */
import type { QueryClient } from '@tanstack/react-query'
import { ADMIN_TEACHERS_KEY } from '../../courses/adminCourseData'

export function invalidateUserLists(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    queryClient.invalidateQueries({ queryKey: ADMIN_TEACHERS_KEY }),
  ]).then(() => undefined)
}
