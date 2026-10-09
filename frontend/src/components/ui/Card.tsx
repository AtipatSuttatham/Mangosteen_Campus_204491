/**
 * การ์ด: กล่องพื้นขาวสำหรับจัดกลุ่มเนื้อหา — หน้าตาตาม class .sheet ใน design canvas
 * (พื้นขาว ขอบสี line มุมโค้ง 14px) ; ระยะขอบด้านใน (padding) กำหนดเองผ่าน className ตามแต่ละหน้า
 *
 * ใช้ได้ทั้งเป็น <div> (ค่าเริ่มต้น) หรือ element อื่น เช่น <Card as="form"> / <Card as="section">
 */
import type { ElementType, HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLElement> & {
  /** element ที่ใช้เป็นการ์ด (ค่าเริ่มต้น div) */
  as?: ElementType
}

/** การ์ดพื้นขาว */
export function Card({ as: Component = 'div', className = '', ...props }: CardProps) {
  return (
    <Component
      className={`rounded-card border border-line bg-surface ${className}`}
      {...props}
    />
  )
}
