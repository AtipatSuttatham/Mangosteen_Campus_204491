/**
 * ช่องรหัสผ่านชั่วคราว + ปุ่ม "สุ่มรหัส" / "คัดลอก" — หน้าต่างเพิ่มผู้ใช้และรีเซ็ตรหัสผ่าน (ขั้น 2.6)
 * หน้าตาตาม board "เพิ่มผู้ใช้" / "รีเซ็ตรหัสผ่าน" (การตัดสินใจก้อน 2 "รหัสผ่านชั่วคราว")
 *
 *   รหัสผ่านชั่วคราว
 *   [hT7kPq4wNx9e        ซ่อน] [🎲 สุ่มรหัส] [⧉ คัดลอก]     ← มือถือ: ปุ่มอยู่ใต้ช่อง
 *   อย่างน้อย 8 ตัว ไม่ใช่ตัวเลขล้วน …
 *
 * - เปิดมาเห็นรหัสเป็นตัวอักษร (ผู้ดูแลระบบต้องอ่านไปแจ้งผู้ใช้) — กด "ซ่อน" ได้
 * - ผู้ดูแลระบบพิมพ์รหัสเองก็ได้ ; backend ตรวจกฎรหัสผ่าน 4 ข้อเสมอ
 */
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button, PasswordField } from '../../../components/ui'
import { generateTempPassword } from '../../../lib/passwords'
import { CopyButton } from './CopyButton'
import { DiceIcon } from './icons'

type TempPasswordFieldProps = {
  label: string
  /** class เพิ่มของป้ายชื่อ (มือถือซ่อนเมื่อหัวกล่องบอกชื่อแล้ว) */
  labelClassName?: string
  /** รหัสในช่องตอนนี้ (ให้ปุ่มคัดลอกใช้) */
  value: string
  /** ข้อความ error ใต้ช่อง */
  error?: string
  /** ใส่รหัสใหม่ลงช่อง (ปุ่ม "สุ่มรหัส") */
  onGenerate: (password: string) => void
  /** ผลของ register('…') จาก React Hook Form */
  registration: UseFormRegisterReturn
}

export function TempPasswordField({
  label,
  labelClassName,
  value,
  error,
  onGenerate,
  registration,
}: TempPasswordFieldProps) {
  const { t } = useTranslation()
  return (
    <PasswordField
      defaultVisible
      label={label}
      labelClassName={labelClassName}
      // ตัวอักษรรหัสเว้นระยะเล็กน้อย + ตัวเลขกว้างเท่ากัน (ตาม .pw ใน canvas) → อ่านตามง่าย
      inputClassName="tracking-[0.06em] tabular-nums"
      autoComplete="new-password"
      autoCapitalize="none"
      spellCheck={false}
      hint={t('userForm.passwordHint')}
      error={error}
      actions={
        <>
          <Button
            variant="secondary"
            className="h-[46px]"
            onClick={() => onGenerate(generateTempPassword())}
          >
            <DiceIcon />
            {t('userForm.generate')}
          </Button>
          <CopyButton text={value} />
        </>
      }
      {...registration}
    />
  )
}
