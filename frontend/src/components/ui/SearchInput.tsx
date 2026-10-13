/**
 * ช่องค้นหา — หน้าตาตาม class .inp ของช่อง "ค้นหาชื่อ รหัส หรืออีเมล" ใน board "รายชื่อผู้ใช้" (ขั้น 2.5)
 *
 * ต่างจาก TextField ตรงที่ไม่มีป้ายชื่อในตัว (ใน wireframe ป้าย "ค้นหาผู้ใช้" ซ่อนไว้ให้โปรแกรมอ่านหน้าจอ)
 * → ผู้ใช้ต้องผูกป้ายเองด้วย <label htmlFor> หรือ aria-label
 * เป็น <input type="search">: กด Esc เพื่อล้างคำค้นได้ ; ซ่อนปุ่ม ✕ ของเบราว์เซอร์ (Chrome วาดเป็นสีฟ้า
 * ไม่เข้ากับสีของระบบ และ wireframe ไม่มีปุ่มนี้)
 * ความสูงเริ่มต้น 46px — ปรับได้ผ่าน className เช่น "lg:h-[42px]"
 */
import type { ComponentProps } from 'react'

/** ช่องค้นหา */
export function SearchInput({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type="search"
      className={
        'h-[46px] rounded-control border border-line-strong bg-surface px-3.5 text-[15px] text-ink ' +
        'placeholder:text-ink-muted focus:outline-2 focus:outline-offset-1 focus:outline-brand ' +
        '[&::-webkit-search-cancel-button]:hidden ' +
        className
      }
      {...props}
    />
  )
}
