/**
 * ช่องค้นหา — หน้าตาตาม class .inp ของช่อง "ค้นหาชื่อ รหัส หรืออีเมล" ใน board "รายชื่อผู้ใช้" (ขั้น 2.5)
 *
 * ต่างจาก TextField ตรงที่ไม่มีป้ายชื่อในตัว (ใน wireframe ป้าย "ค้นหาผู้ใช้" ซ่อนไว้ให้โปรแกรมอ่านหน้าจอ)
 * → ผู้ใช้ต้องผูกป้ายเองด้วย <label htmlFor> หรือ aria-label
 * เป็น <input type="search">: เบราว์เซอร์มีปุ่ม ✕ ล้างคำค้น และกด Esc เพื่อล้างได้เอง
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
        className
      }
      {...props}
    />
  )
}
