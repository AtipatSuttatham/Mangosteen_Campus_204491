/**
 * ช่องเลือกจากรายการ (dropdown) — หน้าตาตาม class .inp ของ <select> ใน board "รายชื่อผู้ใช้" (ขั้น 2.5)
 *
 *   ┌──────────────┬─┐
 *   │ ทุกบทบาท      │⌄│   ← ขอบเทา มุมโค้ง 8px ; กดแล้วมีกรอบม่วง ; ลูกศรวาดเอง (หน้าตาเหมือนกันทุกเบราว์เซอร์)
 *   └──────────────┴─┘
 *
 * ใช้เหมือน <select> ปกติทุกอย่าง (value, onChange, id, aria-label ...) ; ตัวเลือกส่งเป็น <option> ใน children
 * ป้ายชื่อ: ผู้ใช้ทำเองด้วย <label htmlFor> (บางหน้าแสดงป้าย บางหน้าซ่อนไว้ให้โปรแกรมอ่านหน้าจอ)
 * ความสูงเริ่มต้น 46px — ปรับได้ผ่าน className ของกรอบนอก เช่น "lg:h-[42px]"
 */
import type { ComponentProps } from 'react'

type SelectProps = ComponentProps<'select'> & {
  /** class ของกรอบนอก (ความกว้าง / ความสูง) */
  className?: string
}

/** ช่องเลือกจากรายการ */
export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <div className={`relative h-[46px] ${className}`}>
      <select
        className={
          // appearance-none: ซ่อนลูกศรของเบราว์เซอร์ แล้ววาดเองด้านขวา (เว้นที่ไว้ด้วย pr-9)
          'h-full w-full cursor-pointer appearance-none rounded-control border border-line-strong ' +
          'bg-surface pr-9 pl-3 text-[15px] text-ink ' +
          'focus:outline-2 focus:outline-offset-1 focus:outline-brand'
        }
        {...props}
      >
        {children}
      </select>
      {/* ลูกศร ⌄ (ตกแต่งอย่างเดียว — กดทะลุไปที่ช่องเลือก) */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}
