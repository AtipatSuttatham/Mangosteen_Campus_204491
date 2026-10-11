/**
 * ช่องรหัสผ่าน + ปุ่ม "แสดง" / "ซ่อน" ด้านขวาในช่อง — ตามหน้าเข้าสู่ระบบใน design canvas (ภาพ 5.1)
 *
 *   รหัสผ่าน
 *   ┌──────────────────────────┬──────┐
 *   │ ••••••••                 │ แสดง │   ← กดแล้วเห็นรหัสที่พิมพ์ ; กดอีกครั้ง = ซ่อน
 *   └──────────────────────────┴──────┘
 *
 * ใช้เหมือน TextField ทุกอย่าง (รวม error / invalid / ref ของ React Hook Form)
 * ใช้ซ้ำได้ในหน้าข้อมูลส่วนตัว (เปลี่ยนรหัสผ่าน — ขั้น 1.8)
 */
import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField } from './TextField'

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>

/** ช่องรหัสผ่านที่กดดูรหัสได้ */
export function PasswordField({ label, ...props }: PasswordFieldProps) {
  const { t } = useTranslation()
  // true = แสดงรหัสเป็นตัวอักษร ; false = ซ่อนเป็นจุด (ค่าเริ่มต้น)
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      label={label}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          // ชื่อปุ่มสำหรับโปรแกรมอ่านหน้าจอ: "แสดงรหัสผ่าน" / "ซ่อนรหัสผ่าน" (มีคำที่เห็นบนปุ่มอยู่ในชื่อ)
          aria-label={visible ? t('passwordField.hideLabel') : t('passwordField.showLabel')}
          aria-pressed={visible}
          className={
            'h-10 cursor-pointer rounded-control bg-transparent px-2 text-[14.5px] font-semibold text-brand ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          }
        >
          {visible ? t('passwordField.hide') : t('passwordField.show')}
        </button>
      }
      {...props}
    />
  )
}
