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

/** ‹ ลิงก์กลับ "รายวิชาของฉัน" */
export function BackIcon() {
  return (
    <LineIcon>
      <path d="M15 6l-6 6 6 6" />
    </LineIcon>
  )
}

/** › ท้ายแถวรายวิชา */
export function ChevronIcon() {
  return (
    <LineIcon>
      <path d="M9 6l6 6-6 6" />
    </LineIcon>
  )
}

/** ลูกศรวน: ปุ่ม "สร้างรหัสใหม่" */
export function RefreshIcon() {
  return (
    <LineIcon>
      <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
    </LineIcon>
  )
}

/** ⚠ กล่องรายการที่เพิ่มไม่ได้ */
export function WarnIcon() {
  return (
    <LineIcon>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.2v.1" />
    </LineIcon>
  )
}

/** ลูกศรขึ้น: พื้นที่เลือกไฟล์ */
export function UploadIcon() {
  return (
    <LineIcon size={22}>
      <path d="M12 15V5M8 9l4-4 4 4" />
      <path d="M5 15v4h14v-4" />
    </LineIcon>
  )
}

/** ตาราง: แถบบอกไฟล์ที่อ่านแล้ว */
export function SheetIcon() {
  return (
    <LineIcon size={22}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 15h16M10 10v10" />
    </LineIcon>
  )
}

/** ตา: ป้าย "เผยแพร่แล้ว" */
export function EyeIcon() {
  return (
    <LineIcon size={15} strokeWidth={2}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </LineIcon>
  )
}

/** วงกลมขีดฆ่า: ป้าย "บัญชีถูกระงับ" */
export function BlockedIcon() {
  return (
    <LineIcon size={14} strokeWidth={2}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
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
