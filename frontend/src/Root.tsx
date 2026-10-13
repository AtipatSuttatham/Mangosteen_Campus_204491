/**
 * โครงนอกสุดของแอป — ครอบทุกหน้าด้วยของที่ใช้ร่วมกัน (ลำดับมีผล: ตัวในใช้ตัวนอกได้)
 *
 *   QueryClientProvider  ระบบดึง/แคชข้อมูลจาก API (TanStack Query)
 *   AuthProvider         "สมอง" ของการเข้าสู่ระบบ (ใช้ QueryClient ล้างแคชตอนออกจากระบบ)
 *   RouterProvider       ระบบหลายหน้าตามที่อยู่ (React Router แบบ data router — router.tsx)
 *                        อยู่ข้างใน AuthProvider → ทุกหน้า/ยามหน้าประตูใช้ "สมอง" ได้ ;
 *                        AuthProvider ไม่ได้ใช้ของของ router จึงอยู่ด้านนอกได้
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { ApiError } from './api/client'
import { createAppRouter } from './router'

/** ตั้งค่าเริ่มต้นของการดึงข้อมูล */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // error ที่ลองใหม่ไปก็ไม่หาย (ไม่มีสิทธิ์ / ไม่พบ / ไม่ได้เข้าสู่ระบบ) → ไม่ลองซ้ำ ;
        // error อื่น (เช่น เน็ตหลุด) ลองซ้ำได้ 1 ครั้ง
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 1,
        // ไม่ดึงข้อมูลใหม่ทุกครั้งที่สลับกลับมาที่แท็บ (ลดคำขอไปที่เซิร์ฟเวอร์ฟรี)
        refetchOnWindowFocus: false,
      },
    },
  })
}

export default function Root() {
  // สร้าง QueryClient ครั้งเดียวต่อการเปิดแอป
  const [queryClient] = useState(createQueryClient)
  // สร้าง router ครั้งเดียวต่อการเปิดแอป
  const [router] = useState(createAppRouter)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
