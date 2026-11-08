/**
 * ข้อมูลที่หน้ารายวิชาส่งให้แท็บ + ตัวช่วยโหลดข้อมูลใหม่หลังแก้ไข (ขั้น 3.6)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useOutletContext } from 'react-router'
import type { Course } from '../../api/courses'
import type { NoticeValue } from './courseBits'

export type CoursePageContext = {
  course: Course
  /** ผู้ดูแลระบบกำลังจัดการแทนผู้สอน → แท็บตั้งค่ามีส่วนเปลี่ยนผู้สอน / เปิดคืน (ขั้น 3.8) */
  isAdmin: boolean
  /** แสดงแถบข้อความใต้หัวรายวิชา (null = ซ่อน) */
  notify: (notice: NoticeValue | null) => void
}

/** ข้อมูลวิชาและแถบข้อความของหน้ารายวิชา (ใช้ในแท็บ) */
export function useCoursePage(): CoursePageContext {
  return useOutletContext<CoursePageContext>()
}

/** โหลดข้อมูลของวิชานี้ใหม่ทั้งหมด: หัวรายวิชา, รายชื่อ, ผลค้นหาผู้เรียน, หน้ารายวิชาของฉัน / จัดการรายวิชา */
export function useRefreshCourse(courseId: number) {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
      queryClient.invalidateQueries({ queryKey: ['roster', courseId] }),
      queryClient.invalidateQueries({ queryKey: ['enrollment-candidates', courseId] }),
      queryClient.invalidateQueries({ queryKey: ['my-courses'] }),
      // รายการทั้งระบบของผู้ดูแลระบบ (ขั้น 3.8 — ชื่อเดียวกับ ADMIN_COURSES_KEY)
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] }),
    ])
  }, [queryClient, courseId])
}
