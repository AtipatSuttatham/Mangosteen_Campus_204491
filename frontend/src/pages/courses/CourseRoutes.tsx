/**
 * เลือกหน้ารายวิชาตามบทบาท (ขั้น 3.7) — ผู้สอนและผู้เรียนใช้ที่อยู่เดียวกัน แต่เห็นคนละหน้า
 *
 *   /courses             ผู้สอน → TeacherCoursesPage   ผู้เรียน → StudentCoursesPage
 *   /courses/:courseId   ผู้สอน → CoursePage (+ แท็บ)  ผู้เรียน → StudentCoursePage
 *
 * ยามหน้าประตู (RequireAuth roles) อยู่ใน router.tsx — ที่นี่แค่สลับหน้าจอ
 * สิทธิ์จริงตรวจที่ backend ทุกคำขอ (เช่น ผู้เรียนเรียก API ของแท็บตั้งค่า → 403 / 404)
 */
import { useAuth } from '../../auth/AuthContext'
import CoursePage from './CoursePage'
import StudentCoursePage from './StudentCoursePage'
import StudentCoursesPage from './StudentCoursesPage'
import TeacherCoursesPage from './TeacherCoursesPage'

/** /courses */
export function MyCoursesRoute() {
  const { user } = useAuth()
  return user?.role === 'student' ? <StudentCoursesPage /> : <TeacherCoursesPage />
}

/** /courses/:courseId (ผู้สอนมีแท็บลูกใน <Outlet /> ; ผู้เรียนไม่มี) */
export function CourseRoute() {
  const { user } = useAuth()
  return user?.role === 'student' ? <StudentCoursePage /> : <CoursePage />
}
