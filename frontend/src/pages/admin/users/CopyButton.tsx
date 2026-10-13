/**
 * ปุ่มคัดลอกข้อความ (รหัสผ่านชั่วคราว) ไปที่คลิปบอร์ด — ขั้น 2.6
 *
 *   [⧉ คัดลอก]  → กด →  [✓ คัดลอกแล้ว] (พื้นเขียวอ่อน 2 วินาที) → กลับเป็นปุ่มเดิม
 *
 * - คัดลอกไม่ได้ (เช่น เบราว์เซอร์ไม่อนุญาต) → "คัดลอกไม่สำเร็จ" 2 วินาที — ผู้ใช้ยังเลือกข้อความเองได้
 * - ผลการคัดลอกประกาศให้โปรแกรมอ่านหน้าจอด้วย (role=status)
 */
import { useEffect, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui'
import { CheckIcon, CopyIcon } from './icons'

/** เวลาที่แสดง "คัดลอกแล้ว" ก่อนกลับเป็นปุ่มเดิม (มิลลิวินาที) */
const COPIED_RESET_MS = 2000

type CopyButtonProps = {
  /** ข้อความที่จะคัดลอก */
  text: string
  /** ข้อความบนปุ่ม (ค่าเริ่มต้น "คัดลอก") */
  label?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

export function CopyButton({ text, label, className = '', ref }: CopyButtonProps) {
  const { t } = useTranslation()
  // ผลการคัดลอกครั้งล่าสุด (null = ยังไม่กด / ครบเวลาแล้ว)
  const [result, setResult] = useState<'copied' | 'failed' | null>(null)

  // แสดงผลครบเวลา → กลับเป็นปุ่มเดิม
  useEffect(() => {
    if (!result) return
    const timer = window.setTimeout(() => setResult(null), COPIED_RESET_MS)
    return () => window.clearTimeout(timer)
  }, [result])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setResult('copied')
    } catch {
      setResult('failed')
    }
  }

  return (
    <>
      <Button
        ref={ref}
        variant="secondary"
        onClick={() => void copy()}
        className={
          'h-[46px] ' +
          // คัดลอกแล้ว: พื้นเขียวอ่อน ขอบเขียว (ตาม board "สร้างบัญชีแล้ว (มือถือ)")
          (result === 'copied' ? 'border-accent! bg-ok-soft! text-ok! ' : '') +
          className
        }
      >
        {result === 'copied' ? <CheckIcon /> : <CopyIcon />}
        {result === 'copied'
          ? t('userForm.copied')
          : result === 'failed'
            ? t('userForm.copyFailed')
            : (label ?? t('userForm.copy'))}
      </Button>
      <span role="status" className="sr-only">
        {result === 'copied' ? t('userForm.copied') : result === 'failed' ? t('userForm.copyFailed') : ''}
      </span>
    </>
  )
}
