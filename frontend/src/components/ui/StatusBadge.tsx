/**
 * ป้ายสถานะทรงวงรี — หน้าตาตาม class .flag + .warn/.ok/.bad/.mute ใน design canvas
 *
 * สี (tone):
 *   - warn  ส้ม   เช่น "ใกล้ครบกำหนด", "ส่งช้า"
 *   - ok    เขียว เช่น "ส่งแล้ว", "ตรวจแล้ว"
 *   - bad   แดง   เช่น "ยังไม่ส่ง", "ระงับ"
 *   - mute  เทา   เช่น "ยังไม่เผยแพร่", "ปิดแล้ว"
 *
 * ข้อความในป้ายส่งเข้ามาเป็น children (ข้อความจาก th.ts) ; ใส่ไอคอนนำหน้าได้ผ่าน icon
ขนาด (size — ขั้น 2.5): md สูง 28px (ค่าเริ่มต้น) / sm สูง 22px ตัวอักษร 12px
  เช่น ป้าย "คุณ" ต่อท้ายชื่อในหน้ารายชื่อผู้ใช้ (ตาม board "รายชื่อผู้ใช้")
 */
import type { ReactNode } from 'react'

export type StatusTone = 'warn' | 'ok' | 'bad' | 'mute'
export type StatusSize = 'md' | 'sm'

type StatusBadgeProps = {
  /** สีของป้าย */
  tone: StatusTone
  /** ข้อความในป้าย */
  children: ReactNode
  /** ไอคอนนำหน้า (ไม่บังคับ) — ควรเป็น svg ที่ใส่ aria-hidden */
  icon?: ReactNode
  /** ขนาดของป้าย (ค่าเริ่มต้น md) */
  size?: StatusSize
  className?: string
}

/** สีพื้นและสีตัวอักษรของแต่ละแบบ */
const TONE_CLASSES: Record<StatusTone, string> = {
  warn: 'bg-warn-soft text-warn',
  ok: 'bg-ok-soft text-ok',
  bad: 'bg-bad-soft text-bad',
  mute: 'bg-mute-soft text-mute',
}

/** ความสูง / ระยะขอบ / ขนาดตัวอักษรของแต่ละขนาด */
const SIZE_CLASSES: Record<StatusSize, string> = {
  md: 'h-7 px-[11px] text-[13px]',
  sm: 'h-[22px] px-2 text-[12px]',
}

/** ป้ายสถานะ */
export function StatusBadge({ tone, children, icon, size = 'md', className = '' }: StatusBadgeProps) {
  return (
    <span
      data-tone={tone}
      className={
        `inline-flex items-center gap-1.5 rounded-full font-semibold ${SIZE_CLASSES[size]} ` +
        `whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`
      }
    >
      {icon}
      {children}
    </span>
  )
}
