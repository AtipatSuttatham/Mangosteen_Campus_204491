/**
 * แผนที่ของหน้าทั้งหมด (React Router) — ที่อยู่ → หน้า + ยามหน้าประตู
 *
 *   /login            หน้าเข้าสู่ระบบ (เข้าสู่ระบบอยู่แล้ว → พาไปหน้าที่ตั้งใจจะไป)
 *   ── หน้าที่ต้องเข้าสู่ระบบ: อยู่ในโครงหน้าจอ AppShell (sidebar / เมนูมือถือ) ตรวจการเข้าสู่ระบบที่โครงจุดเดียว
 *   /                 หน้าแรก (ทุกบทบาท)
 *   /profile          ข้อมูลส่วนตัว (ทุกบทบาท ตาม UC-02)
 *   /users            จัดการบัญชีผู้ใช้ (เฉพาะผู้ดูแลระบบ — UC-04 ขั้น 2.5) ; บทบาทอื่น → กลับหน้าแรก
 *   /users/import     นำเข้าผู้ใช้จาก CSV 3 ขั้น (เฉพาะผู้ดูแลระบบ — ขั้น 2.7)
 *   /courses          รายวิชาของฉัน (ผู้สอน — ขั้น 3.5 ; ผู้เรียนเพิ่มในขั้น 3.7)
 *                     (ไม่ใช้ /admin/... เพราะตอน deploy Django ใช้ /admin/ เป็นหน้า Django admin
 *                      บนโดเมนเดียวกัน — รีเฟรชหน้า /admin/users จะไปโผล่หน้า Django แทน)
 *   /dev/components   ตัวอย่างคอมโพเนนต์ (เฉพาะโหมดพัฒนา)
 *   /dev/health       ทดสอบสุขภาพระบบ (เฉพาะโหมดพัฒนา)
 *   อื่น ๆ             ไม่มีหน้านี้ → พากลับหน้าแรก (หน้า "ไม่พบหน้านี้" ยังไม่มี wireframe)
 *
 * รูปแบบ router (ขั้น 2.7 — ผู้ใช้เลือกข้อ 2.ก): ใช้ "data router" (createBrowserRouter + RouterProvider)
 * แทน <BrowserRouter> เดิม เพราะมีตัวกันออกจากหน้า (useBlocker) ที่กันได้ทุกทาง — เมนู, ปุ่มย้อนกลับ,
 * ลิงก์ — ใช้ในหน้านำเข้า CSV (กันรหัสผ่านหายก่อนดาวน์โหลด) และหน้าอื่นในก้อนหลังได้
 * ที่อยู่และหน้าทุกหน้าเหมือนเดิม — เปลี่ยนแค่วิธีประกอบ router
 */
import { lazy, Suspense } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  type RouteObject,
} from 'react-router'
import { RedirectIfAuthed, RequireAuth } from './auth/guards'
import AppShell from './components/layout/AppShell'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/profile/ProfilePage'
import CsvImportPage from './pages/admin/users/import/CsvImportPage'
import TeacherCoursesPage from './pages/courses/TeacherCoursesPage'
import UsersPage from './pages/admin/users/UsersPage'

// หน้าสำหรับนักพัฒนา: โหลดแยกไฟล์เมื่อเปิดหน้านั้นเท่านั้น
// import.meta.env.DEV เป็น false ตอน build → Vite ตัดโค้ดส่วนนี้ทิ้ง ไม่อยู่ในไฟล์ที่ deploy
const ComponentGallery = import.meta.env.DEV ? lazy(() => import('./dev/ComponentGallery')) : null
const HealthPage = import.meta.env.DEV ? lazy(() => import('./dev/HealthPage')) : null

/** แผนที่ของหน้าทั้งหมด (ใช้ทั้งในแอปจริงและใน test — test สร้าง router ในหน่วยความจำจากแผนที่เดียวกัน) */
export const appRoutes: RouteObject[] = createRoutesFromElements(
  <>
    <Route
      path="/login"
      element={
        <RedirectIfAuthed>
          <LoginPage />
        </RedirectIfAuthed>
      }
    />
    {/* โครงหน้าจอหลัก: หน้าลูกแสดงตรง <Outlet /> ของ AppShell — เพิ่มหน้าใหม่ของก้อนถัดไปที่นี่ */}
    <Route
      element={
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      }
    >
      <Route path="/" element={<HomePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      {/* หน้าของผู้ดูแลระบบ: ยามชั้นที่สองตรวจบทบาท (ซ่อนหน้าจอเท่านั้น — backend ตรวจสิทธิ์ทุกคำขอ) */}
      <Route
        path="/users"
        element={
          <RequireAuth roles={['admin']}>
            <UsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users/import"
        element={
          <RequireAuth roles={['admin']}>
            <CsvImportPage />
          </RequireAuth>
        }
      />
      {/* รายวิชาของฉัน: ขั้น 3.5 เฉพาะผู้สอน (หน้าของผู้เรียนมาในขั้น 3.7) */}
      <Route
        path="/courses"
        element={
          <RequireAuth roles={['teacher']}>
            <TeacherCoursesPage />
          </RequireAuth>
        }
      />
    </Route>
    {ComponentGallery && (
      <Route
        path="/dev/components"
        element={
          <Suspense fallback={null}>
            <ComponentGallery />
          </Suspense>
        }
      />
    )}
    {HealthPage && (
      <Route
        path="/dev/health"
        element={
          <Suspense fallback={null}>
            <HealthPage />
          </Suspense>
        }
      />
    )}
    <Route path="*" element={<Navigate to="/" replace />} />
  </>,
)

/** router ของแอปจริง (ใช้ที่อยู่ในแถบที่อยู่ของเบราว์เซอร์) — Root.tsx สร้างครั้งเดียว */
export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
