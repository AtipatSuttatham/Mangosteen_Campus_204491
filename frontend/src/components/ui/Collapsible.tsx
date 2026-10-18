/**
 * ส่วนที่พับ/เปิดได้ (ขั้น 3.5 — ผู้ใช้ขอในขั้น 3.1 ; board "รายวิชาของฉัน" แถวก้อน 3)
 *
 *   ⌄ ปีการศึกษา 2569 ภาคเรียนที่ 1                    3 รายวิชา    ← หัว = ปุ่มทั้งแถว (เปิดอยู่)
 *   ┌ เนื้อหา ───────────────────────────────────────────────┐
 *   › ปีการศึกษา 2568 ภาคเรียนที่ 2                    1 รายวิชา    ← พับอยู่: ลูกศรชี้ขวา ไม่มีเนื้อหา
 *
 * - หัวเป็น <button> จริงใน <h2> (หรือระดับที่กำหนด) มี aria-expanded + aria-controls
 *   → กด Tab แล้ว Enter / Space ได้ และโปรแกรมอ่านหน้าจอบอกว่า "พับอยู่ / เปิดอยู่"
 * - ลูกศรหมุนเฉพาะตอนผู้ใช้กด ; เครื่องที่ตั้งลดการเคลื่อนไหว → ไม่หมุนแบบเคลื่อนไหว (motion-safe)
 * - ควบคุมจากภายนอก (open / onToggle) — หน้าที่ใช้เป็นคนจำค่า (เช่น useStoredState)
 * - พับแล้วไม่วาดเนื้อหา (ไม่ใช่แค่ซ่อน) ลดของในหน้าที่โปรแกรมอ่านหน้าจอต้องอ่าน
 */
import { useId, type ReactNode } from 'react'

type CollapsibleProps = {
  /** ข้อความหัว */
  title: ReactNode
  /** ข้อความท้ายหัว (ชิดขวา) เช่น "3 รายวิชา" */
  trailing?: ReactNode
  open: boolean
  onToggle: () => void
  /** ระดับหัวข้อ (ค่าเริ่มต้น h2) */
  headingLevel?: 'h2' | 'h3'
  /** class เพิ่มของหัวข้อ (สี / ระยะห่างด้านบน) */
  headingClassName?: string
  children: ReactNode
}

/** ลูกศร ⌄ — หมุน -90° (ชี้ขวา) ตอนพับ */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={
        'shrink-0 text-brand motion-safe:transition-transform motion-safe:duration-150 ' +
        (open ? '' : '-rotate-90')
      }
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** ส่วนที่พับ/เปิดได้ */
export function Collapsible({
  title,
  trailing,
  open,
  onToggle,
  headingLevel: Heading = 'h2',
  headingClassName = '',
  children,
}: CollapsibleProps) {
  const contentId = useId()
  return (
    <div>
      <Heading className={`m-0 text-base font-semibold ${headingClassName}`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          className={
            '-ml-1.5 flex min-h-11 w-[calc(100%+12px)] cursor-pointer items-center gap-2.5 rounded-control ' +
            'border-0 bg-transparent pr-2.5 pl-1.5 text-left font-[inherit] text-inherit hover:bg-track ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          }
        >
          <Chevron open={open} />
          <span className="min-w-0 grow">{title}</span>
          {trailing && <span className="shrink-0 text-sm font-medium text-ink-muted">{trailing}</span>}
        </button>
      </Heading>
      {open && (
        <div id={contentId} className="mt-2">
          {children}
        </div>
      )}
    </div>
  )
}
