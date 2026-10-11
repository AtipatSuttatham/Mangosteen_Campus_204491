/**
 * ไอคอนเส้นของโครงหน้าจอ (คัดลอกรูปทรงจาก design canvas: เส้น 1.7px, ปลายมน)
 * ทุกไอคอนเป็นการตกแต่ง (aria-hidden) — ชื่อของปุ่ม/เมนูอยู่ในตัวอักษรหรือ aria-label
 */
import type { ReactNode } from 'react'
import type { NavIcon } from './navigation'

/** กรอบร่วมของไอคอนเส้นทุกตัว */
function StrokeIcon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

/** ☰ ปุ่มเปิดเมนู (แถบบนมือถือ) */
export function MenuIcon() {
  return (
    <StrokeIcon size={24}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </StrokeIcon>
  )
}

/** ✕ ปุ่มปิดเมนู (เมนูลิ้นชัก) */
export function CloseIcon() {
  return (
    <StrokeIcon size={24}>
      <path d="M6 6l12 12M18 6L6 18" />
    </StrokeIcon>
  )
}

/** ไอคอนหน้าภาพรวม: ตาราง 4 ช่อง */
function OverviewIcon() {
  return (
    <StrokeIcon size={18}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </StrokeIcon>
  )
}

/** ไอคอนของเมนูแต่ละชื่อ (navigation.ts อ้างถึงด้วยชื่อ) */
export const NAV_ICONS: Record<NavIcon, () => ReactNode> = {
  overview: OverviewIcon,
}
