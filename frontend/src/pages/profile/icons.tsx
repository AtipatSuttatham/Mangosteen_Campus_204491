/**
 * ไอคอนเส้นของหน้าข้อมูลส่วนตัว (คัดลอกรูปทรงจาก board "ข้อมูลส่วนตัว" ใน design canvas: เส้น 1.7px ปลายมน)
 * ทุกไอคอนเป็นการตกแต่ง (aria-hidden) — ชื่อของปุ่มอยู่ในตัวอักษรหรือ aria-label
 */
import type { ReactNode } from 'react'

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

/** 📷 ปุ่มเปลี่ยนรูปที่มุมรูปประจำตัว */
export function CameraIcon() {
  return (
    <StrokeIcon size={18}>
      <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </StrokeIcon>
  )
}

/** ⬆ เมนู "เลือกรูปใหม่" */
export function UploadIcon() {
  return (
    <StrokeIcon size={18}>
      <path d="M12 15V5M8 9l4-4 4 4" />
      <path d="M5 15v4h14v-4" />
    </StrokeIcon>
  )
}

/** 🗑 เมนู "ลบรูป" */
export function TrashIcon() {
  return (
    <StrokeIcon size={18}>
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
    </StrokeIcon>
  )
}

/** ✓ ป้าย "บันทึกแล้ว" */
export function CheckIcon() {
  return (
    <StrokeIcon size={16}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </StrokeIcon>
  )
}
