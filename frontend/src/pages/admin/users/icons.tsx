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

// ---------- ขั้น 2.6: ไอคอนของปุ่มและหน้าต่างเพิ่ม/แก้ไข/รีเซ็ต (รูปทรงจาก board ก้อน 2: เส้น 1.7px) ----------

/** กรอบร่วมของไอคอนเส้นบาง (ตกแต่งอย่างเดียว) */
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

/** + ปุ่ม "เพิ่มผู้ใช้" / "เพิ่มอีกคน" */
export function PlusIcon() {
  return (
    <LineIcon>
      <path d="M12 5v14M5 12h14" />
    </LineIcon>
  )
}

/** ลูกเต๋า: ปุ่ม "สุ่มรหัส" */
export function DiceIcon() {
  return (
    <LineIcon>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" />
      <circle cx="15" cy="15" r="1.1" fill="currentColor" />
      <circle cx="15" cy="9" r="1.1" fill="currentColor" />
      <circle cx="9" cy="15" r="1.1" fill="currentColor" />
    </LineIcon>
  )
}

/** กระดาษซ้อน: ปุ่ม "คัดลอก" */
export function CopyIcon() {
  return (
    <LineIcon>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </LineIcon>
  )
}

/** ✓ ปุ่ม "คัดลอกแล้ว" (เส้นหนา) / วงกลมของหน้า "สร้างบัญชีแล้ว" (size 22) */
export function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <LineIcon size={size} strokeWidth={2.2}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </LineIcon>
  )
}

/** บัตรประจำตัว: หัวกล่อง "ข้อมูลผู้ใช้" (มือถือ) */
export function IdCardIcon() {
  return (
    <LineIcon size={17}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16a3.4 3.4 0 0 1 6.4 0M14.5 10h4M14.5 13.5h3" />
    </LineIcon>
  )
}

/** โล่: หัวกล่อง "บทบาท" (มือถือ) */
export function ShieldIcon() {
  return (
    <LineIcon size={17}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
    </LineIcon>
  )
}

/** กุญแจ: หัวกล่อง "รหัสผ่านชั่วคราว" (มือถือ) */
export function KeyIcon() {
  return (
    <LineIcon size={17}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3" />
    </LineIcon>
  )
}

/** ⓘ กล่องข้อความแนะนำ */
export function InfoIcon() {
  return (
    <LineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.1" />
    </LineIcon>
  )
}

/** ⚠ กล่องเตือน (สีส้ม) */
export function WarnIcon() {
  return (
    <LineIcon>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.2v.1" />
    </LineIcon>
  )
}

/** แม่กุญแจ: ช่องบทบาทที่ล็อก (แก้ไขบัญชีตัวเอง) */
export function LockIcon() {
  return (
    <LineIcon size={16}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </LineIcon>
  )
}

// ---------- ขั้น 2.7: หน้านำเข้า CSV (รูปทรงจาก board "นำเข้า CSV") ----------

/** ลูกศรขึ้นจากถาด: ปุ่ม "นำเข้าจาก CSV" (18) / วงกลมในช่องลากวาง (26) */
export function UploadIcon({ size = 18 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M12 15V5M8 9l4-4 4 4" />
      <path d="M5 15v4h14v-4" />
    </LineIcon>
  )
}

/** ลูกศรลงสู่ถาด: ปุ่ม "ดาวน์โหลดไฟล์ตัวอย่าง" / "ดาวน์โหลดไฟล์รหัสผ่าน" */
export function DownloadIcon() {
  return (
    <LineIcon>
      <path d="M12 5v10M8 11l4 4 4-4" />
      <path d="M5 15v4h14v-4" />
    </LineIcon>
  )
}

/** ‹ ลิงก์กลับ "จัดการบัญชีผู้ใช้" */
export function BackIcon() {
  return (
    <LineIcon>
      <path d="M15 6l-6 6 6 6" />
    </LineIcon>
  )
}

/** กระดาษ: ชื่อไฟล์ที่เลือก (หน้า "ตรวจข้อมูล") */
export function FileIcon() {
  return (
    <LineIcon>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </LineIcon>
  )
}
