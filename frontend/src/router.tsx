/**
 * แผนที่ของหน้าทั้งหมด (React Router) — ที่อยู่ → หน้า + ยามหน้าประตู
 *
 *   /login            หน้าเข้าสู่ระบบ (เข้าสู่ระบบอยู่แล้ว → พาไปหน้าที่ตั้งใจจะไป)
 *   /                 หน้าแรก (ต้องเข้าสู่ระบบ — ทุกบทบาท)
 *   /profile          ข้อมูลส่วนตัว (ต้องเข้าสู่ระบบ — ทุกบทบาท ตาม UC-02)
 *   /dev/components   ตัวอย่างคอมโพเนนต์ (เฉพาะโหมดพัฒนา)
 *   /dev/health       ทดสอบสุขภาพระบบ (เฉพาะโหมดพัฒนา)
 *   อื่น ๆ             ไม่มีหน้านี้ → พากลับหน้าแรก (หน้า "ไม่พบหน้านี้" ยังไม่มี wireframe)
 */
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RedirectIfAuthed, RequireAuth } from './auth/guards'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'

// หน้าสำหรับนักพัฒนา: โหลดแยกไฟล์เมื่อเปิดหน้านั้นเท่านั้น
// import.meta.env.DEV เป็น false ตอน build → Vite ตัดโค้ดส่วนนี้ทิ้ง ไม่อยู่ในไฟล์ที่ deploy
const ComponentGallery = import.meta.env.DEV ? lazy(() => import('./dev/ComponentGallery')) : null
const HealthPage = import.meta.env.DEV ? lazy(() => import('./dev/HealthPage')) : null

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
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
    </Routes>
  )
}
