/**
 * "ยามหน้าประตู" ของหน้าต่าง ๆ (ใช้ใน router.tsx)
 *
 * - <RequireAuth>      หน้าที่ต้องเข้าสู่ระบบ: ยังไม่เข้า → ไปหน้าเข้าสู่ระบบ (จำหน้าเดิมไว้พากลับ)
 *                       ระบุ roles ได้: บทบาทไม่ตรง → กลับหน้าแรก
 * - <RedirectIfAuthed> หน้าเข้าสู่ระบบ: เข้าสู่ระบบอยู่แล้ว → ไปหน้าที่ตั้งใจจะไป (หรือหน้าแรก)
 *
 * ระหว่างตรวจบัตรตอนเปิดหน้าเว็บ (ไม่ถึงวินาที) แสดงพื้นว่างสีเดียวกับหน้าเว็บ — กันหน้ากระพริบ
 * หมายเหตุ: นี่คือการซ่อนหน้าจอเท่านั้น — สิทธิ์จริงตรวจที่ backend ทุกคำขอ
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, type Location } from 'react-router'
import type { Role } from '../api/auth'
import { useAuth } from './AuthContext'

/** ข้อมูลที่ส่งไปหน้าเข้าสู่ระบบ: หน้าที่ผู้ใช้ตั้งใจจะเข้า */
export type LoginRedirectState = { from?: Location }

/** พื้นว่างระหว่างตรวจบัตร (โปรแกรมอ่านหน้าจออ่านว่า "กำลังโหลด") */
function SessionLoading() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-canvas" aria-busy="true">
      <span className="sr-only">{t('auth.loading')}</span>
    </div>
  )
}

/** หน้าที่ต้องเข้าสู่ระบบ (และบทบาทตรง ถ้าระบุ roles) */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <SessionLoading />
  if (status === 'anonymous' || !user) {
    const state: LoginRedirectState = { from: location }
    return <Navigate to="/login" replace state={state} />
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

/** หน้าเข้าสู่ระบบ: ถ้าเข้าสู่ระบบอยู่แล้ว พาไปหน้าที่ตั้งใจจะไป */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <SessionLoading />
  if (status === 'authenticated') {
    const from = (location.state as LoginRedirectState | null)?.from
    const target = from ? `${from.pathname}${from.search}${from.hash}` : '/'
    return <Navigate to={target} replace />
  }
  return children
}
