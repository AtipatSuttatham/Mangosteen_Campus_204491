/**
 * แผนที่ของหน้าทั้งหมด (React Router) — ที่อยู่ → หน้า + ยามหน้าประตู
 *
 *   /login            หน้าเข้าสู่ระบบ (เข้าสู่ระบบอยู่แล้ว → พาไปหน้าที่ตั้งใจจะไป)
 *   ── หน้าที่ต้องเข้าสู่ระบบ: อยู่ในโครงหน้าจอ AppShell (sidebar / เมนูมือถือ) ตรวจการเข้าสู่ระบบที่โครงจุดเดียว
 *   /                 หน้าแรก (ทุกบทบาท)
 *   /profile          ข้อมูลส่วนตัว (ทุกบทบาท ตาม UC-02)
 *   /dev/components   ตัวอย่างคอมโพเนนต์ (เฉพาะโหมดพัฒนา)
 *   /dev/health       ทดสอบสุขภาพระบบ (เฉพาะโหมดพัฒนา)
 *   อื่น ๆ             ไม่มีหน้านี้ → พากลับหน้าแรก (หน้า "ไม่พบหน้านี้" ยังไม่มี wireframe)
 */
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RedirectIfAuthed, RequireAuth } from './auth/guards'
import AppShell from './components/layout/AppShell'
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
    </Routes>
  )
}
