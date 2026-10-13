/**
 * ปุ่มมาตรฐานของระบบ — หน้าตาตาม class .btn / .btn2 / .act ใน design canvas
 *
 * แบบ (variant):
 *   - primary      ปุ่มหลัก: พื้นม่วงทึบ ตัวอักษรขาว สูง 46px (เช่น "เข้าสู่ระบบ", "บันทึกคะแนน")
 *   - secondary    ปุ่มรอง: พื้นขาว ขอบเทา ตัวอักษรม่วง สูง 44px (เช่น "ยกเลิก", "จัดการรายวิชา")
 *   - text         ปุ่มตัวอักษร: ไม่มีพื้น ตัวอักษรม่วง สูง 40px (เช่น "แก้ไข", "แสดง")
 *   - danger-text  ปุ่มตัวอักษรสีแดง สำหรับการกระทำที่ย้อนยาก (เช่น "ระงับ", "ลบ")
 *   - danger       ปุ่มแดงทึบ ตัวอักษรขาว สูง 46px — ปุ่มยืนยันในหน้าต่างยืนยัน (เช่น "ระงับบัญชี" — ขั้น 2.6)
 *
 * ใช้เหมือน <button> ปกติทุกอย่าง (onClick, type, disabled, ref ...)
 */
import type { ComponentProps } from 'react'
import { buttonClassName, type ButtonVariant } from './buttonStyles'

// ComponentProps<'button'> มี ref ด้วย (React 19) — ส่ง ref ให้ปุ่มได้ เช่น โฟกัสปุ่ม "ยกเลิก" ของ ConfirmDialog
type ButtonProps = ComponentProps<'button'> & {
  /** แบบของปุ่ม (ค่าเริ่มต้น primary) */
  variant?: ButtonVariant
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
      className={`${buttonClassName(variant)} ${className}`}
      {...props}
    />
  )
}
