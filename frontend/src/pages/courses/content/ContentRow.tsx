/**
 * แถวเนื้อหา 1 ชิ้นในหน่วยที่เปิดอยู่ (ตาม board "แท็บเนื้อหา (ผู้สอน)" — ขั้น 4.5)
 *
 *   จอใหญ่:  [ไอคอน] สไลด์: while และ for loop        [ยังไม่เผยแพร่]  ↑ ↓ │ แก้ไข เผยแพร่ ลบ
 *                   PDF  2.1 MB  ปิดการดาวน์โหลด
 *   มือถือ:  ไอคอน + ชื่อ + รายละเอียด แล้วปุ่มขึ้นบรรทัดใหม่ (ตาม board มือถือ)
 *
 * - ไอคอนชนิด + คำกำกับชนิดเสมอ (แยกชนิดได้โดยไม่พึ่งรูปอย่างเดียว)
 * - ยังไม่เผยแพร่: ป้ายเทา + ไอคอน / ชื่อจางลงเล็กน้อย (ตาม .draft-row ใน board)
 * - readOnly (ผู้ดูแลระบบ / วิชาที่ปิด): ไม่มีปุ่มจัดการ แต่ยังกดชื่อดูตัวอย่างได้ (อ่านอย่างเดียว)
 * - กดชื่อ → "ตัวอย่างที่ผู้เรียนจะเห็น" ใต้แถว (กฒ1 — ขั้น 4.7 ข) ใช้ส่วนแสดงผลชุดเดียวกับหน้าบทเรียน (กฟ1)
 *     ⌄ if-elif-else                       ↑ ↓ │ แก้ไข …
 *       วิดีโอ MP4 64.2 MB
 *       ┌ 👁 ตัวอย่างที่ผู้เรียนจะเห็น ────────────┐   ← พื้นม่วงอ่อน (board .pv) จอใหญ่เยื้องตรงกับชื่อ
 *       │ [ตัวเล่น 320px  ขยาย]  ดาวน์โหลด       │      มือถือเต็มความกว้าง
 *   เปิดได้ทีละรายการ (ขค1 — ContentTab ถือว่าเปิดรายการไหน) ; ผู้เรียนยังไม่เห็น (รายการ / หน่วยยังไม่เผยแพร่)
 *   → หัวกล่อง "… เมื่อเผยแพร่" ; ปุ่มชื่อกดได้แม้ระหว่างรอผลของปุ่มอื่น (ไม่ได้เปลี่ยนข้อมูล)
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Content } from '../../../api/content'
import { StatusBadge } from '../../../components/ui'
import { EyeIcon, EyeOffIcon } from '../icons'
import { ContentView } from '../lesson/ContentView'
import { ContentKindIcon, ToggleIcon } from './contentIcons'
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
  /** แก้ไข (ขั้น 4.6 ก) — ปุ่มใช้กติกาโฟกัสเดียวกับปุ่มอื่นในแถว (กภ1) */
  onEdit: () => void
  /** ตัวอย่างของรายการนี้เปิดอยู่ไหม + กดชื่อเพื่อเปิด / ปิด (ขั้น 4.7 ข) */
  previewOpen: boolean
  onTogglePreview: () => void
  /** หน่วยที่อยู่ / รายวิชายังไม่เผยแพร่ — ผู้เรียนยังไม่เห็นแม้รายการนี้เผยแพร่แล้ว */
  parentHidden: boolean
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
  onEdit,
  previewOpen,
  onTogglePreview,
  parentHidden,
}: ContentRowProps) {
  const { t } = useTranslation()
  const previewId = useId()
  const draft = !content.is_published
  const meta = contentMeta(content, t)
  // ผู้เรียนยังไม่เห็นรายการนี้ (ตัวรายการ / หน่วย / รายวิชายังไม่เผยแพร่)
  const hiddenFromStudents = draft || parentHidden

  return (
    <li className="py-2.5">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3.5">
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
            {/* ชื่อรายการเป็นปุ่มเปิด / ปิดตัวอย่าง (board .ttog: ลูกศร + ขีดเส้นใต้เมื่อชี้) */}
            <button
              type="button"
              aria-expanded={previewOpen}
              aria-controls={previewId}
              // ชื่อสำหรับโปรแกรมอ่านหน้าจอบอกว่าปุ่มทำอะไร (ตาเห็นจากลูกศร) — ขึ้นต้นด้วยชื่อที่มองเห็น
              aria-label={t('content.previewToggle', { title: content.title })}
              onClick={onTogglePreview}
              className={
                'group -ml-1 flex cursor-pointer items-start gap-1.5 rounded-[6px] border-0 bg-transparent py-0.5 ' +
                'pr-1.5 pl-1 text-left text-ink focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                'focus-visible:outline-accent'
              }
            >
              <span className="mt-0.5 flex shrink-0 text-brand">
                <ToggleIcon open={previewOpen} size={18} />
              </span>
              <span
                className={
                  'text-[15px] leading-[1.45] font-semibold break-words group-hover:underline ' +
                  (draft ? 'opacity-75' : '')
                }
              >
                {content.title}
              </span>
            </button>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-6 text-[13.5px] text-ink-muted">
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
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </div>
        )}
      </div>

      {previewOpen && (
        <section
          id={previewId}
          aria-label={t(hiddenFromStudents ? 'content.previewHeadingDraft' : 'content.previewHeading')}
          className="mt-2.5 mb-1 flex flex-col gap-2.5 rounded-[12px] bg-canvas p-4 lg:ml-[54px]"
        >
          <p className="m-0 flex items-center gap-2 text-[13.5px] text-ink-muted">
            <EyeIcon />
            {t(hiddenFromStudents ? 'content.previewHeadingDraft' : 'content.previewHeading')}
          </p>
          {/* เปลี่ยนไฟล์แล้ว (ชื่อ / ขนาดเปลี่ยน) → วาดตัวเล่นใหม่ — ตัวเล่นจำลิงก์ของตัวเอง ไม่งั้นยังเห็นไฟล์เก่า
              แต่เลื่อน / เผยแพร่รายการอื่นไม่ทำให้วิดีโอที่เล่นอยู่เริ่มใหม่ */}
          <ContentView
            key={`${content.file_name}:${content.file_size ?? ''}`}
            content={content}
            showTitle={false}
          />
        </section>
      )}
    </li>
  )
}
