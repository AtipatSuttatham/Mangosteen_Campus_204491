/**
 * ชิ้นส่วนหน้าตาที่ทุกส่วนของแท็บตั้งค่าใช้ร่วมกัน (แยกจาก SettingsTab.tsx — รอบปรับโครงสร้างหลังขั้น 3.8)
 *
 * - Section: กรอบของ 1 ส่วน — จอใหญ่ซ้ายหัวข้อ ขวาเนื้อหา (อยู่ในการ์ดเดียวกัน) ; มือถือเป็นการ์ดแยก
 * - ResultLine: ป้ายผลของการกดล่าสุด ท้ายส่วน
 * - Switch: สวิตช์เปิด / ปิด
 * - Hint: ข้อความอธิบายตัวเล็กสีรอง
 */
import type { ReactNode } from 'react'
import { StatusBadge } from '../../../components/ui'
import { CheckIcon } from '../icons'
import type { SectionResult } from './useSettingsActions'

/** ส่วนหนึ่งของแท็บ: หัวข้อ + คำอธิบาย แล้วตามด้วยเนื้อหา ; danger = หัวข้อสีแดง ขอบแดง (ปิด / ลบ) */
export function Section({
  title,
  body,
  danger = false,
  className = '',
  children,
}: {
  title: string
  body: string
  danger?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={
        'flex flex-col gap-3.5 rounded-card border bg-surface px-4 py-[18px] ' +
        'lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-7 lg:py-[26px] ' +
        `${danger ? 'border-bad-line' : 'border-line'} ${className}`
      }
    >
      <div>
        <h2
          className={`m-0 font-display text-lg leading-[1.4] font-semibold lg:text-[19px] ${danger ? 'text-bad' : ''}`}
        >
          {title}
        </h2>
        <p className="m-0 mt-1 text-sm leading-[1.6] text-ink-muted">{body}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}

/** ผลของการกดล่าสุด ขึ้นท้ายส่วนนั้น (role=status / alert ให้โปรแกรมอ่านหน้าจออ่าน) ; null = ไม่แสดง */
export function ResultLine({ result }: { result: SectionResult | null }) {
  if (!result) return null
  return result.tone === 'ok' ? (
    <div role="status">
      <StatusBadge tone="ok" icon={<CheckIcon />} className="w-fit">
        {result.text}
      </StatusBadge>
    </div>
  ) : (
    <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
      {result.text}
    </p>
  )
}

/** สวิตช์เปิด / ปิด ตาม .sw ใน board */
export function Switch({
  checked,
  labelledBy,
  disabled,
  onChange,
}: {
  checked: boolean
  labelledBy: string
  disabled: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onChange}
      className={
        'relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-0 p-0 disabled:cursor-not-allowed ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
        (checked ? 'bg-brand' : 'bg-line-strong')
      }
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] size-[22px] rounded-full bg-surface ${checked ? 'left-[23px]' : 'left-[3px]'}`}
      />
    </button>
  )
}

/** ข้อความอธิบายตัวเล็กสีรอง (ใต้ปุ่ม / ใต้ช่อง) */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">{children}</p>
}
