/**
 * เลือกหน้ารายวิชาตามบทบาท (ขั้น 3.7 ; ผู้ดูแลระบบขั้น 3.8 แบบ ร1) — ทุกบทบาทใช้ที่อยู่เดียวกัน แต่เห็นคนละหน้า
 *
 *   /courses             ผู้สอน → TeacherCoursesPage   ผู้เรียน → StudentCoursesPage
 *                        ผู้ดูแลระบบ → AdminCoursesPage (จัดการรายวิชาทั้งระบบ)
 *   /courses/:courseId   ผู้สอน / ผู้ดูแลระบบ → CoursePage (+ แท็บ)  ผู้เรียน → StudentCoursePage
 *                        (ผู้ดูแลระบบเห็นแถบส้ม "กำลังจัดการแทนผู้สอน" + ส่วนที่มีเฉพาะผู้ดูแลระบบ)
 *
 * ยามหน้าประตู (RequireAuth roles) อยู่ใน router.tsx — ที่นี่แค่สลับหน้าจอ
 * สิทธิ์จริงตรวจที่ backend ทุกคำขอ (เช่น ผู้เรียนเรียก API ของแท็บตั้งค่า → 403 / 404)
 */
import { useAuth } from '../../auth/AuthContext'
import AdminCoursesPage from './AdminCoursesPage'
import CoursePage from './CoursePage'
import StudentCoursePage from './StudentCoursePage'
import StudentCoursesPage from './StudentCoursesPage'
import TeacherCoursesPage from './TeacherCoursesPage'

/** /courses */
export function MyCoursesRoute() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <AdminCoursesPage />
  return user?.role === 'student' ? <StudentCoursesPage /> : <TeacherCoursesPage />
}

/** /courses/:courseId (ผู้สอนมีแท็บลูกใน <Outlet /> ; ผู้เรียนไม่มี) */
export function CourseRoute() {
  const { user } = useAuth()
  return user?.role === 'student' ? <StudentCoursePage /> : <CoursePage isAdmin={user?.role === 'admin'} />
}
