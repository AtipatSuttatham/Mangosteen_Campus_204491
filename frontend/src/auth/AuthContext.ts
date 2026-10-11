/**
 * ข้อมูลการเข้าสู่ระบบที่ทุกหน้าใช้ร่วมกัน (context) + hook useAuth()
 * ตัวจัดการจริงอยู่ใน AuthProvider.tsx — แยกไฟล์ไว้เพราะไฟล์ component ควรมีแต่ component
 *
 * ตัวอย่าง:
 *   const { status, user, login, logout } = useAuth()
 */
import { createContext, useContext } from 'react'
import type { TokenResponse, User } from '../api/auth'

/** สถานะการเข้าสู่ระบบ */
export type AuthStatus =
  /** กำลังตรวจตอนเปิดหน้าเว็บ (แลกบัตรจาก cookie อยู่) */
  | 'loading'
  /** เข้าสู่ระบบอยู่ */
  | 'authenticated'
  /** ไม่ได้เข้าสู่ระบบ */
  | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  /** ผู้ใช้ที่เข้าสู่ระบบอยู่ ; null เมื่อไม่ได้เข้าสู่ระบบ */
  user: User | null
  /** true = เพิ่งถูกให้ออกจากระบบกลางคัน (หน้าเข้าสู่ระบบแสดง "หมดเวลาการใช้งาน") */
  sessionExpired: boolean
  /** เข้าสู่ระบบ — ไม่สำเร็จจะโยน ApiError (เช่น invalid_credentials) */
  login: (identifier: string, password: string) => Promise<void>
  /** ออกจากระบบ (ทุกแท็บของเว็บนี้ไปหน้าเข้าสู่ระบบด้วย) */
  logout: () => Promise<void>
  /**
   * ใช้ข้อมูลผู้ใช้ชุดใหม่ที่ได้จาก API (หลังแก้ชื่อ/อีเมล/รูป — ขั้น 1.8)
   * ชื่อและรูปทั่วหน้าจอ (sidebar, แถบมือถือ, หน้าแรก) เปลี่ยนทันที + แท็บอื่นเปลี่ยนตาม
   */
  updateUser: (user: User) => void
  /** ใช้บัตรชุดใหม่ที่ได้หลังเปลี่ยนรหัสผ่าน (เครื่องนี้อยู่ในระบบต่อ — ขั้น 1.8) */
  acceptSession: (result: TokenResponse) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** ใช้ข้อมูลการเข้าสู่ระบบ — ต้องอยู่ภายใต้ <AuthProvider> */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return value
}
