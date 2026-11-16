/**
 * แถวเนื้อหา 1 ชิ้นในหน่วยที่เปิดอยู่ (ตาม board "แท็บเนื้อหา (ผู้สอน)" — ขั้น 4.5)
 *
 *   จอใหญ่:  [ไอคอน] สไลด์: while และ for loop        [ยังไม่เผยแพร่]  ↑ ↓ │ เผยแพร่ ลบ
 *                   PDF  2.1 MB  ปิดการดาวน์โหลด
 *   มือถือ:  ไอคอน + ชื่อ + รายละเอียด แล้วปุ่มขึ้นบรรทัดใหม่ (ตาม board มือถือ)
 *
 * - ไอคอนชนิด + คำกำกับชนิดเสมอ (แยกชนิดได้โดยไม่พึ่งรูปอย่างเดียว)
 * - ยังไม่เผยแพร่: ป้ายเทา + ไอคอน / ชื่อจางลงเล็กน้อย (ตาม .draft-row ใน board)
 * - readOnly (ผู้ดูแลระบบ / วิชาที่ปิด): ไม่มีปุ่ม
 * - กดชื่อเพื่อดูตัวอย่าง (กฒ1) มาในขั้น 4.7 พร้อมตัวแสดงเนื้อหาของผู้เรียน (ผู้ใช้เลือกแบบ กฟ1)
 */
import { useTranslation } from 'react-i18next'
import type { Content } from '../../../api/content'
import { StatusBadge } from '../../../components/ui'
import { EyeOffIcon } from '../icons'
import { ContentKindIcon } from './contentIcons'
import { contentMeta } from './contentLabels'
import { RowControls } from './RowControls'

type ContentRowProps = {
  content: Content
  first: boolean
  last: boolean
  readOnly: boolean
  disabled: boolean
  onMove: (direction: 'up' | 'down') => void
  onTogglePublish: () => void
  onDelete: () => void
}

export function ContentRow({
  content,
  first,
  last,
  readOnly,
  disabled,
  onMove,
  onTogglePublish,
  onDelete,
}: ContentRowProps) {
  const { t } = useTranslation()
  const draft = !content.is_published
  const meta = contentMeta(content, t)

  return (
    <li className="flex flex-col gap-1 py-2.5 lg:flex-row lg:items-center lg:gap-3.5">
      <div className="flex min-w-0 grow items-center gap-3 lg:gap-3.5">
        <span
          className={
            'flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-canvas text-brand ' +
            (draft ? 'opacity-75' : '')
          }
        >
          <ContentKindIcon kind={content.content_type} />
        </span>
        <div className="min-w-0">
          <div
            className={'text-[15px] leading-[1.45] font-semibold break-words ' + (draft ? 'opacity-75' : '')}
          >
            {content.title}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13.5px] text-ink-muted">
            {meta.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </div>
        </div>
      </div>
      {(draft || !readOnly) && (
        <div className="flex flex-wrap items-center gap-2 pl-[52px] lg:shrink-0 lg:pl-0">
          {draft && (
            <StatusBadge tone="mute" icon={<EyeOffIcon />}>
              {t('content.draft')}
            </StatusBadge>
          )}
          {!readOnly && (
            <RowControls
              name={content.title}
              first={first}
              last={last}
              published={content.is_published}
              disabled={disabled}
              onMove={onMove}
              onTogglePublish={onTogglePublish}
              onDelete={onDelete}
            />
          )}
        </div>
      )}
    </li>
  )
}
