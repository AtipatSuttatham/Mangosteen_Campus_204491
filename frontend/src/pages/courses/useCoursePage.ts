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
  /** แสดงแถบข้อความใต้หัวรายวิชา (null = ซ่อน) */
  notify: (notice: NoticeValue | null) => void
}

/** ข้อมูลวิชาและแถบข้อความของหน้ารายวิชา (ใช้ในแท็บ) */
export function useCoursePage(): CoursePageContext {
  return useOutletContext<CoursePageContext>()
}

/** โหลดข้อมูลของวิชานี้ใหม่ทั้งหมด: หัวรายวิชา, รายชื่อ, หน้ารายวิชาของฉัน */
export function useRefreshCourse(courseId: number) {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
      queryClient.invalidateQueries({ queryKey: ['roster', courseId] }),
      queryClient.invalidateQueries({ queryKey: ['my-courses'] }),
    ])
  }, [queryClient, courseId])
}
