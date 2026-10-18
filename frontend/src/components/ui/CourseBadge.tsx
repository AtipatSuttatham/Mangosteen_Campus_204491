/**
 * ป้ายรหัสวิชา — จุดเด่นของหน้ารายวิชาในก้อน 3 (ผู้ใช้เลือกแบบ ก 2026-10-15 ; board แถวก้อน 3 ใน canvas)
 *
 *   เผยแพร่แล้ว            ยังไม่เผยแพร่           ปิดแล้ว
 *   ┏━━━━━━━━━┓          ┌╌╌╌╌╌╌╌╌╌┐          ┌─────────┐
 *   ┃ 204111 ✿┃          ╎ 204331  ╎          │ 204111  │
 *   ┗━━━━━━━━━┛          └╌╌╌╌╌╌╌╌╌┘          │   🔒    │
 *   พื้นม่วงทึบ + ลาย       พื้นขาว ขอบเส้นประ      พื้นเทา ตัวอักษรจาง
 *   กลีบเลี้ยงเขียวจาง      (ยังเป็นฉบับร่าง)       + กุญแจเล็ก (ยกเว้นขนาด sm)
 *
 * ขนาด: lg 112×88 (หัวหน้ารายวิชา) · md 84×64 (รายการวิชา / มือถือ) · sm 66×40 (ตารางผู้ดูแลระบบ)
 * รหัสวิชาใช้ฟอนต์ Taviraj ตัวเลขกว้างเท่ากัน
 * สถานะต้องมีป้ายข้อความ (StatusBadge) อยู่ใกล้ ๆ ด้วยเสมอ — ป้ายนี้บอกสถานะด้วยหน้าตาอย่างเดียว
 * (คนที่แยกสีไม่ออก / โปรแกรมอ่านหน้าจอ อ่านจากป้ายข้อความ)
 */
import { CalyxPattern } from '../brand/CalyxPattern'

export type CourseBadgeState = 'published' | 'draft' | 'closed'
export type CourseBadgeSize = 'lg' | 'md' | 'sm'

type CourseBadgeProps = {
  /** รหัสวิชา เช่น "204111" */
  code: string
  state: CourseBadgeState
  size?: CourseBadgeSize
  className?: string
}

/** ขนาดกล่อง / ตัวอักษร / ลาย ของแต่ละขนาด */
const SIZE_CLASSES: Record<CourseBadgeSize, string> = {
  lg: 'h-[88px] w-28 text-[22px]',
  md: 'h-16 w-[84px] text-[16.5px]',
  sm: 'h-10 w-[66px] text-[13.5px] rounded-[10px]',
}

/** ขนาดลายกลีบเลี้ยง (ประมาณ 78% ของความกว้างป้าย ตาม canvas) */
const PATTERN_SIZE: Record<CourseBadgeSize, number> = { lg: 88, md: 66, sm: 52 }

/** สีพื้น / ขอบ / ตัวอักษรของแต่ละสถานะ */
const STATE_CLASSES: Record<CourseBadgeState, string> = {
  published: 'bg-brand text-white',
  draft: 'border-[1.5px] border-dashed border-line-strong bg-surface text-brand',
  closed: 'bg-track text-ink-muted',
}

/** กุญแจเล็กใต้รหัสของวิชาที่ปิดแล้ว (ตกแต่งอย่างเดียว) */
function LockMark() {
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
      className="relative opacity-80"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

/** ป้ายรหัสวิชา */
export function CourseBadge({ code, state, size = 'md', className = '' }: CourseBadgeProps) {
  return (
    <span
      data-state={state}
      className={
        'relative flex shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl ' +
        'font-display leading-none font-semibold tracking-[0.02em] tabular-nums lining-nums ' +
        `${SIZE_CLASSES[size]} ${STATE_CLASSES[state]} ${className}`
      }
    >
      {/* ลายกลีบเลี้ยงมุมขวาล่าง (เฉพาะวิชาที่เผยแพร่แล้ว) */}
      {state === 'published' && (
        <CalyxPattern
          size={PATTERN_SIZE[size]}
          strokeWidth={1.6}
          className="pointer-events-none absolute -right-[24%] -bottom-[34%] text-accent opacity-[0.38]"
        />
      )}
      <span className="relative">{code}</span>
      {state === 'closed' && size !== 'sm' && <LockMark />}
    </span>
  )
}
