/**
 * ชิ้นส่วนเล็ก ๆ ที่ใช้ร่วมกันในหน้ารายวิชา (ขั้น 3.6)
 *   Notice       แถบข้อความหลังทำรายการ: สำเร็จ = เขียว ✓ / ไม่สำเร็จ = แดง / แจ้งให้ทราบ = เทา (ขั้น 3.7)
 *   Segmented    กลุ่มปุ่มสลับตาม .seg ใน board (ตัวกรองสถานะ, วิธีเพิ่มผู้เรียน)
 *   CountPill    เลขจำนวนในแท็บและปุ่มสลับ
 *   StateMessage กล่องข้อความกำลังโหลด / ว่าง / ผิดพลาด
 *   ManagingBanner แถบส้ม "คุณกำลังจัดการรายวิชานี้แทนผู้สอน" ของผู้ดูแลระบบ (ขั้น 3.8)
 */
import type { ReactNode } from 'react'
import { CheckIcon, WarnIcon } from './icons'

/**
 * ข้อความหลังทำรายการ
 * ok = สำเร็จ (เขียว ✓) / bad = ไม่สำเร็จ (แดง) /
 * mute = แจ้งให้ทราบ ไม่มีอะไรเปลี่ยน (เทา) เช่น "คุณอยู่ในรายวิชา … อยู่แล้ว" (ขั้น 3.7 แบบ ภ1)
 */
export type NoticeValue = { tone: 'ok' | 'bad' | 'mute'; text: string }

const NOTICE_TONE: Record<NoticeValue['tone'], string> = {
  ok: 'bg-ok-soft text-ok',
  bad: 'bg-bad-soft text-bad',
  mute: 'bg-mute-soft text-mute',
}

export function Notice({ notice }: { notice: NoticeValue }) {
  return (
    <div
      role={notice.tone === 'bad' ? 'alert' : 'status'}
      className={
        'flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-sm leading-[1.55] font-semibold ' +
        NOTICE_TONE[notice.tone]
      }
    >
      {notice.tone === 'ok' && <CheckIcon />}
      {notice.text}
    </div>
  )
}

/**
 * แถบเตือนผู้ดูแลระบบว่ากำลังแก้รายวิชาของคนอื่น — ตาม board "ตั้งค่ารายวิชาที่ปิดแล้ว (ผู้ดูแลระบบ)"
 * อยู่เหนือปุ่มกลับ แสดงทุกแท็บของหน้ารายวิชา (ไม่ใช่ role=alert — เป็นข้อมูลประจำหน้า ไม่ใช่เหตุการณ์ใหม่)
 */
export function ManagingBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-warn-soft px-3.5 py-3 text-sm leading-[1.55] font-semibold text-warn">
      <span className="mt-0.5 shrink-0">
        <WarnIcon />
      </span>
      <p className="m-0">{children}</p>
    </div>
  )
}

export function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full bg-track px-2 text-[12.5px] font-semibold text-ink-muted">
      {children}
    </span>
  )
}

type SegmentedOption<T extends string> = { value: T; label: string; count?: number }

type SegmentedProps<T extends string> = {
  /** ชื่อของกลุ่ม (สำหรับโปรแกรมอ่านหน้าจอ) */
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

/** กลุ่มปุ่มสลับ: ปุ่มที่เลือกเป็นพื้นขาว */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`gap-1 rounded-[10px] bg-track p-1 ${className}`}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={
              'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border-0 px-3.5 ' +
              'text-[14.5px] font-semibold whitespace-nowrap disabled:cursor-not-allowed ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
              (selected ? 'bg-surface text-ink shadow-segment' : 'bg-transparent text-ink-muted')
            }
          >
            {option.label}
            {option.count !== undefined && <CountPill>{option.count.toLocaleString('th-TH')}</CountPill>}
          </button>
        )
      })}
    </div>
  )
}

/** กล่องข้อความสถานะกลางพื้นที่รายการ */
export function StateMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3.5 px-6 py-12 text-center text-[15px] leading-[1.6] text-ink-muted">
      {children}
    </div>
  )
}
