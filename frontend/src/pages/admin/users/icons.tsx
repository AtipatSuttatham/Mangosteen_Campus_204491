/**
 * ไอคอนในป้ายสถานะบัญชีของหน้ารายชื่อผู้ใช้ (รูปทรงจาก board "รายชื่อผู้ใช้": เส้น 2px, ปลายมน)
 * เป็นการตกแต่งอย่างเดียว (aria-hidden) — ความหมายอยู่ในข้อความของป้าย
 */
import type { ReactNode } from 'react'

/** กรอบร่วมของไอคอนในป้าย (15px) */
function BadgeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

/** ✓ ใช้งานได้ */
export function ActiveIcon() {
  return (
    <BadgeIcon>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </BadgeIcon>
  )
}

/** แม่กุญแจ: ระงับการใช้งาน */
export function SuspendedIcon() {
  return (
    <BadgeIcon>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </BadgeIcon>
  )
}
