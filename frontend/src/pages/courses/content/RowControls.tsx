/**
 * ปุ่มท้ายแถวของหน่วย / เนื้อหา (ตาม board "แท็บเนื้อหา (ผู้สอน)" — ผู้ใช้เลือกแบบ กด1: ไม่ย่อเป็นเมนู ⋯)
 *
 *   [↑] [↓] │ แก้ไข  เผยแพร่ / ยกเลิกเผยแพร่  ลบ
 *
 * - ตัวแรกกด ↑ ไม่ได้ / ตัวสุดท้ายกด ↓ ไม่ได้ (กจ1)
 * - ทุกปุ่มมีชื่อเต็มสำหรับโปรแกรมอ่านหน้าจอ เช่น "เลื่อน หน่วยที่ 3 ขึ้น", "ลบ สรุปก่อนเรียน"
 * - onEdit ไม่ส่ง = ไม่มีปุ่ม "แก้ไข" (แก้เนื้อหามาในขั้น 4.6 — แสดงเฉพาะปุ่มที่ทำงานได้)
 *
 * โฟกัสของแป้นพิมพ์ (แก้หลังตรวจขั้น 4.5 — ผู้ใช้เลือกแบบ กภ1):
 * - ระหว่างรอผลของปุ่มใด (locked) ปุ่มใช้ aria-disabled แทน disabled — ยังรับโฟกัสได้แต่กดแล้วไม่ทำอะไร
 *   (ปุ่มที่ disabled ขณะโฟกัสอยู่ เบราว์เซอร์ทิ้งโฟกัสไปต้นหน้า → ผู้ใช้แป้นพิมพ์ต้องกด Tab ไล่ใหม่ทุกครั้ง)
 * - เลื่อนเสร็จ → คืนโฟกัสให้ลูกศรที่กด (React ย้ายแถวด้วยการถอด / ใส่ element ใหม่ ซึ่งทำให้โฟกัสหลุดได้)
 *   ถ้าเลื่อนจนถึงบนสุด / ล่างสุด ลูกศรนั้นกลายเป็น disabled จริง → โฟกัสลูกศรอีกตัวของแถวเดียวกันแทน
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui'
import { ArrowDownIcon, ArrowUpIcon } from './contentIcons'

type RowControlsProps = {
  /** ชื่อที่ใช้ในชื่อปุ่ม เช่น "หน่วยที่ 3" หรือชื่อเนื้อหา */
  name: string
  first: boolean
  last: boolean
  published: boolean
  /** ระหว่างรอผลของปุ่มอื่น → ทุกปุ่มกดไม่ได้ (แต่ยังรับโฟกัส) */
  disabled: boolean
  onMove: (direction: 'up' | 'down') => void
  onTogglePublish: () => void
  onEdit?: () => void
  onDelete: () => void
}

/** หน้าตาจางของปุ่มที่ล็อกด้วย aria-disabled (เหมือน disabled: ของปุ่มมาตรฐาน) */
const LOCKED = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

/** ปุ่มไอคอน ↑ ↓ ขนาด 40px (ตาม .ibtn ใน board) */
const ICON_BUTTON =
  'inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 ' +
  'bg-transparent p-0 text-brand not-disabled:not-aria-disabled:hover:bg-canvas disabled:cursor-not-allowed ' +
  'disabled:text-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  LOCKED

export function RowControls({
  name,
  first,
  last,
  published,
  disabled,
  onMove,
  onTogglePublish,
  onEdit,
  onDelete,
}: RowControlsProps) {
  const { t } = useTranslation()
  const upRef = useRef<HTMLButtonElement>(null)
  const downRef = useRef<HTMLButtonElement>(null)
  /** ลูกศรที่เพิ่งกด — ใช้ตัดสินว่าต้องย้ายโฟกัสไหมเมื่อเลื่อนเสร็จ */
  const movedRef = useRef<'up' | 'down' | null>(null)
  const locked = disabled || undefined

  // เลื่อนเสร็จ (ปลดล็อกแล้ว): คืนโฟกัสให้ลูกศรที่กด ; ลูกศรนั้นกดไม่ได้แล้ว (ถึงบนสุด / ล่างสุด) → ลูกศรอีกตัว
  useEffect(() => {
    if (disabled || movedRef.current === null) return
    const direction = movedRef.current
    movedRef.current = null
    const target =
      direction === 'up' ? (first ? downRef.current : upRef.current) : last ? upRef.current : downRef.current
    target?.focus()
  }, [disabled, first, last])

  /** ห่อคำสั่งของปุ่ม: ระหว่างล็อกกดแล้วไม่ทำอะไร */
  const guard = (action: () => void) => () => {
    if (!disabled) action()
  }
  /** กดลูกศร: จำว่ากดตัวไหน (ไว้คืนโฟกัสหลังเลื่อนเสร็จ) แล้วสั่งเลื่อน */
  function handleMove(direction: 'up' | 'down') {
    if (disabled) return
    movedRef.current = direction
    onMove(direction)
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5">
      <button
        ref={upRef}
        type="button"
        className={ICON_BUTTON}
        aria-label={t('content.moveUp', { name })}
        disabled={first}
        aria-disabled={locked}
        onClick={() => handleMove('up')}
      >
        <ArrowUpIcon />
      </button>
      <button
        ref={downRef}
        type="button"
        className={ICON_BUTTON}
        aria-label={t('content.moveDown', { name })}
        disabled={last}
        aria-disabled={locked}
        onClick={() => handleMove('down')}
      >
        <ArrowDownIcon />
      </button>
      {/* เส้นคั่นระหว่างปุ่มเลื่อนกับปุ่มคำสั่ง */}
      <span aria-hidden="true" className="mx-1.5 h-[22px] w-px bg-line" />
      {onEdit && (
        <Button
          variant="text"
          className={LOCKED}
          aria-disabled={locked}
          onClick={guard(onEdit)}
          aria-label={t('content.editLabel', { name })}
        >
          {t('content.edit')}
        </Button>
      )}
      <Button
        variant="text"
        className={LOCKED}
        aria-disabled={locked}
        onClick={guard(onTogglePublish)}
        aria-label={t(published ? 'content.unpublishLabel' : 'content.publishLabel', { name })}
      >
        {published ? t('content.unpublish') : t('content.publish')}
      </Button>
      <Button
        variant="danger-text"
        className={LOCKED}
        aria-disabled={locked}
        onClick={guard(onDelete)}
        aria-label={t('content.deleteLabel', { name })}
      >
        {t('content.delete')}
      </Button>
    </div>
  )
}
