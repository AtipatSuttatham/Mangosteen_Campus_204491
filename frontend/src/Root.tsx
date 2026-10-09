/**
 * ตัวเลือกหน้าที่จะแสดงตามที่อยู่ในเบราว์เซอร์ (ชั่วคราว — router จริงจะเพิ่มในก้อน 1)
 *
 * - /dev/components → หน้ารวมตัวอย่างคอมโพเนนต์ (เฉพาะโหมดพัฒนา)
 * - ที่อยู่อื่น ๆ       → หน้าทดสอบสุขภาพระบบ (App)
 */
import { lazy, Suspense } from 'react'
import App from './App'

// โหลดหน้ารวมตัวอย่างแยกไฟล์ เฉพาะเมื่อเปิดหน้านั้น
// import.meta.env.DEV เป็น false ตอน build → Vite ตัดโค้ดส่วนนี้ทิ้ง ไม่อยู่ในไฟล์ที่ deploy
const ComponentGallery = import.meta.env.DEV ? lazy(() => import('./dev/ComponentGallery')) : null

/** เลือกหน้าที่จะแสดง */
export default function Root() {
  if (ComponentGallery && window.location.pathname === '/dev/components') {
    return (
      <Suspense fallback={null}>
        <ComponentGallery />
      </Suspense>
    )
  }
  return <App />
}
