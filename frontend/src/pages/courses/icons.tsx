/**
 * ไอคอนเส้นของหน้ารายวิชา (รูปทรงจาก board แถวก้อน 3 ใน design canvas)
 * ตกแต่งอย่างเดียว (aria-hidden) — ความหมายอยู่ในข้อความข้าง ๆ เสมอ
 */
import type { ReactNode } from 'react'

/** กรอบร่วมของไอคอนเส้น */
function LineIcon({
  size = 18,
  strokeWidth = 1.7,
  children,
}: {
  size?: number
  strokeWidth?: number
  children: ReactNode
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

/** + ปุ่มสร้างรายวิชา */
export function PlusIcon() {
  return (
    <LineIcon>
      <path d="M12 5v14M5 12h14" />
    </LineIcon>
  )
}

/** ✓ แถบข้อความสำเร็จ */
export function CheckIcon() {
  return (
    <LineIcon strokeWidth={2.2}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </LineIcon>
  )
}

/** ⓘ หมายเหตุในฟอร์ม */
export function InfoIcon() {
  return (
    <LineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.1" />
    </LineIcon>
  )
}

/** ตาขีดฆ่า: ป้าย "ยังไม่เผยแพร่" */
export function EyeOffIcon() {
  return (
    <LineIcon size={15} strokeWidth={2}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1" />
    </LineIcon>
  )
}

/** แม่กุญแจ: ป้าย "ปิดรายวิชาแล้ว" */
export function LockIcon() {
  return (
    <LineIcon size={15} strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </LineIcon>
  )
}
