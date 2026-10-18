/**
 * รายการเมนูหลักของระบบ (sidebar บนจอใหญ่ + เมนูลิ้นชักบนมือถือ ใช้รายการเดียวกัน)
 *
 * ข้อตกลงก้อน 1: แสดง**เฉพาะหน้าที่ทำเสร็จแล้ว** — ก้อนถัดไปเพิ่มเมนูที่นี่ทีละบรรทัด เช่น
 *   { to: '/courses', label: 'courses', icon: 'courses', roles: ['teacher'] }
 * (ต้องเพิ่มข้อความใน th.ts กลุ่ม nav และไอคอนใน NavMenu.tsx ด้วย)
 *
 * หมายเหตุ: การซ่อนเมนูเป็นแค่เรื่องหน้าตา — สิทธิ์จริงตรวจที่ backend ทุกคำขอ
 */
import type { Role } from '../../api/auth'
import type { th } from '../../i18n/locales/th'

/** ชื่อไอคอนที่มีให้เลือก (วาดใน NavMenu.tsx) */
export type NavIcon = 'overview' | 'users' | 'courses'

export type NavItem = {
  /** ที่อยู่ของหน้า */
  to: string
  /** รหัสข้อความในกลุ่ม nav ของ th.ts */
  label: keyof typeof th.nav
  icon: NavIcon
  /** บทบาทที่เห็นเมนูนี้ */
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'home', icon: 'overview', roles: ['admin', 'teacher', 'student'] },
  // จัดการบัญชีผู้ใช้ (ก้อน 2 — ขั้น 2.5) เฉพาะผู้ดูแลระบบ
  { to: '/users', label: 'users', icon: 'users', roles: ['admin'] },
  // รายวิชาของฉัน (ก้อน 3 — ขั้น 3.5 ผู้สอน ; ผู้เรียนเพิ่มในขั้น 3.7)
  { to: '/courses', label: 'courses', icon: 'courses', roles: ['teacher'] },
]

/** เมนูที่บทบาทนี้เห็น (เรียงตามลำดับในรายการ) */
export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
