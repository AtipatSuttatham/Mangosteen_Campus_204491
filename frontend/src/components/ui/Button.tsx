/**
 * ปุ่มมาตรฐานของระบบ — หน้าตาตาม class .btn / .btn2 / .act ใน design canvas
 *
 * แบบ (variant):
 *   - primary      ปุ่มหลัก: พื้นม่วงทึบ ตัวอักษรขาว สูง 46px (เช่น "เข้าสู่ระบบ", "บันทึกคะแนน")
 *   - secondary    ปุ่มรอง: พื้นขาว ขอบเทา ตัวอักษรม่วง สูง 44px (เช่น "ยกเลิก", "จัดการรายวิชา")
 *   - text         ปุ่มตัวอักษร: ไม่มีพื้น ตัวอักษรม่วง สูง 40px (เช่น "แก้ไข", "แสดง")
 *   - danger-text  ปุ่มตัวอักษรสีแดง สำหรับการกระทำที่ย้อนยาก (เช่น "ระงับ", "ลบ")
 *
 * ใช้เหมือน <button> ปกติทุกอย่าง (onClick, type, disabled ...)
 */
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger-text'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** แบบของปุ่ม (ค่าเริ่มต้น primary) */
  variant?: ButtonVariant
}

/** ส่วนที่ทุกแบบใช้ร่วมกัน: จัดกลาง, ตัวอักษรหนา, ไม่ตัดบรรทัด, กดไม่ได้เมื่อ disabled */
const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

/** focus ring ของปุ่ม: เส้นสีเขียว 2px ห่างจากปุ่ม 2px (ตาม canvas) — เห็นเมื่อใช้แป้นพิมพ์ */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** หน้าตาเฉพาะของแต่ละแบบ */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'h-[46px] px-5 rounded-control bg-brand text-white text-[15px] ' +
    'enabled:hover:bg-brand-hover',
  secondary:
    'h-11 px-[18px] rounded-control border border-line-strong bg-surface text-brand text-[14.5px] ' +
    'enabled:hover:border-brand',
  text: 'h-10 px-2 bg-transparent text-brand text-[14.5px]',
  'danger-text': 'h-10 px-2 bg-transparent text-bad text-[14.5px]',
}

/** ปุ่มมาตรฐาน */
export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      // ค่าเริ่มต้นเป็น type="button" กันฟอร์มถูกส่งโดยไม่ตั้งใจ (ปุ่มส่งฟอร์มให้ระบุ type="submit")
      type={type}
      className={`${BASE} ${FOCUS} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
