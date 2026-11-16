/**
 * ปุ่มท้ายแถวของหน่วย / เนื้อหา (ตาม board "แท็บเนื้อหา (ผู้สอน)" — ผู้ใช้เลือกแบบ กด1: ไม่ย่อเป็นเมนู ⋯)
 *
 *   [↑] [↓] │ แก้ไข  เผยแพร่ / ยกเลิกเผยแพร่  ลบ
 *
 * - ตัวแรกกด ↑ ไม่ได้ / ตัวสุดท้ายกด ↓ ไม่ได้ (กจ1)
 * - ทุกปุ่มมีชื่อเต็มสำหรับโปรแกรมอ่านหน้าจอ เช่น "เลื่อน หน่วยที่ 3 ขึ้น", "ลบ สรุปก่อนเรียน"
 * - onEdit ไม่ส่ง = ไม่มีปุ่ม "แก้ไข" (แก้เนื้อหามาในขั้น 4.6 — แสดงเฉพาะปุ่มที่ทำงานได้)
 */
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui'
import { ArrowDownIcon, ArrowUpIcon } from './contentIcons'

type RowControlsProps = {
  /** ชื่อที่ใช้ในชื่อปุ่ม เช่น "หน่วยที่ 3" หรือชื่อเนื้อหา */
  name: string
  first: boolean
  last: boolean
  published: boolean
  /** ระหว่างรอผลของปุ่มอื่น → ทุกปุ่มกดไม่ได้ */
  disabled: boolean
  onMove: (direction: 'up' | 'down') => void
  onTogglePublish: () => void
  onEdit?: () => void
  onDelete: () => void
}

/** ปุ่มไอคอน ↑ ↓ ขนาด 40px (ตาม .ibtn ใน board) */
const ICON_BUTTON =
  'inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 ' +
  'bg-transparent p-0 text-brand not-disabled:hover:bg-canvas disabled:cursor-not-allowed ' +
  'disabled:text-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

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
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5">
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={t('content.moveUp', { name })}
        disabled={disabled || first}
        onClick={() => onMove('up')}
      >
        <ArrowUpIcon />
      </button>
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={t('content.moveDown', { name })}
        disabled={disabled || last}
        onClick={() => onMove('down')}
      >
        <ArrowDownIcon />
      </button>
      {/* เส้นคั่นระหว่างปุ่มเลื่อนกับปุ่มคำสั่ง */}
      <span aria-hidden="true" className="mx-1.5 h-[22px] w-px bg-line" />
      {onEdit && (
        <Button
          variant="text"
          disabled={disabled}
          onClick={onEdit}
          aria-label={t('content.editLabel', { name })}
        >
          {t('content.edit')}
        </Button>
      )}
      <Button
        variant="text"
        disabled={disabled}
        onClick={onTogglePublish}
        aria-label={t(published ? 'content.unpublishLabel' : 'content.publishLabel', { name })}
      >
        {published ? t('content.unpublish') : t('content.publish')}
      </Button>
      <Button
        variant="danger-text"
        disabled={disabled}
        onClick={onDelete}
        aria-label={t('content.deleteLabel', { name })}
      >
        {t('content.delete')}
      </Button>
    </div>
  )
}
