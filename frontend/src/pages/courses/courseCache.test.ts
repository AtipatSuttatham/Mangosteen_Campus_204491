/**
 * test ของ courseCache: หลังแก้ข้อมูลแต่ละแบบ ต้องล้างแคชชุดที่ถูกต้อง — ไม่ขาด (หน้าอื่นแสดงข้อมูลเก่า)
 * และไม่เกิน (รายชื่อผู้สอน / ภาคเรียนเก็บไว้ 5 นาที ล้างโดยไม่จำเป็นก็ขอใหม่โดยเปล่าประโยชน์)
 * (รอบปรับโครงสร้างหลังขั้น 3.8)
 */
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_COURSES_KEY,
  ADMIN_TEACHERS_KEY,
  ADMIN_TERMS_KEY,
  afterCourseAction,
  afterCourseCreated,
  afterCourseDeleted,
  afterCourseSaved,
  afterTeacherChanged,
  candidatesKey,
  courseKey,
  MY_COURSES_KEY,
  refreshCourse,
  rosterKey,
} from './courseCache'

/** แคชตัวอย่าง: มีข้อมูลทุกชุด (วิชา 5 + วิชาอื่น 6) */
function filledClient() {
  const queryClient = new QueryClient()
  for (const key of [
    MY_COURSES_KEY,
    [...ADMIN_COURSES_KEY, { page: 1 }],
    ADMIN_TEACHERS_KEY,
    ADMIN_TERMS_KEY,
    courseKey(5),
    [...rosterKey(5), { status: 'active' }],
    [...candidatesKey(5), 'กม'],
    courseKey(6),
  ]) {
    queryClient.setQueryData(key, [])
  }
  return queryClient
}

/** ชื่อชุดที่ถูกล้าง (เรียงตามที่ใส่ในแคช) */
function invalidatedKeys(queryClient: QueryClient) {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.isInvalidated)
    .map((query) => query.queryKey[0])
}

describe('courseCache — หลังแก้อะไร ล้างอะไร', () => {
  it('เผยแพร่ / รหัสเข้าร่วม / ปิด / เปิดคืน → รายการวิชาเท่านั้น', async () => {
    const queryClient = filledClient()
    await afterCourseAction(queryClient)
    expect(invalidatedKeys(queryClient)).toEqual(['my-courses', 'admin-courses'])
  })

  it('บันทึกข้อมูลรายวิชา → รายการวิชา + ภาคเรียน', async () => {
    const queryClient = filledClient()
    await afterCourseSaved(queryClient)
    expect(invalidatedKeys(queryClient)).toEqual(['my-courses', 'admin-courses', 'admin-terms'])
  })

  it('เปลี่ยนผู้สอน → รายการวิชา + รายชื่อผู้สอน', async () => {
    const queryClient = filledClient()
    await afterTeacherChanged(queryClient)
    expect(invalidatedKeys(queryClient)).toEqual(['my-courses', 'admin-courses', 'admin-teachers'])
  })

  it('สร้างรายวิชา → รายการวิชา + รายชื่อผู้สอน + ภาคเรียน', async () => {
    const queryClient = filledClient()
    await afterCourseCreated(queryClient)
    expect(invalidatedKeys(queryClient)).toEqual([
      'my-courses',
      'admin-courses',
      'admin-teachers',
      'admin-terms',
    ])
  })

  it('ลบรายวิชา → เหมือนสร้าง + ข้อมูลของวิชานั้นถูกทิ้ง (วิชาอื่นยังอยู่)', async () => {
    const queryClient = filledClient()
    await afterCourseDeleted(queryClient, 5)
    expect(invalidatedKeys(queryClient)).toEqual([
      'my-courses',
      'admin-courses',
      'admin-teachers',
      'admin-terms',
    ])
    expect(queryClient.getQueryData(courseKey(5))).toBeUndefined()
    expect(queryClient.getQueryData(courseKey(6))).toEqual([])
  })

  it('โหลดวิชาใหม่ทั้งหมด → ข้อมูลของวิชานั้นทุกชุด + รายการวิชา ; ไม่แตะวิชาอื่นและรายชื่อผู้สอน / ภาคเรียน', async () => {
    const queryClient = filledClient()
    await refreshCourse(queryClient, 5)
    expect(invalidatedKeys(queryClient)).toEqual([
      'my-courses',
      'admin-courses',
      'course',
      'roster',
      'enrollment-candidates',
    ])
    expect(queryClient.getQueryState(courseKey(6))?.isInvalidated).toBe(false)
  })
})
