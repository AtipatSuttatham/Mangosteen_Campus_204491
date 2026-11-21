/**
 * การ์ดหน่วยการเรียน 1 หน่วย (ตาม board "แท็บเนื้อหา (ผู้สอน)" จอใหญ่ + มือถือ — ขั้น 4.5)
 *
 *   จอใหญ่:  › ③ โครงสร้างควบคุมทิศทาง   [เผยแพร่แล้ว]  ↑ ↓ │ แก้ไข ยกเลิกเผยแพร่ ลบ
 *              7 รายการ
 *            ─────────────────────────────────────────────────────── (เปิดอยู่)
 *              คำอธิบายหน่วย (Markdown)
 *              แถวเนื้อหา …
 *   มือถือ:  หัว (ปุ่มพับ / เปิด) → ป้ายสถานะ → ปุ่ม เรียงลงมา (ตาม board มือถือ)
 *
 * - วงเลขหน่วย 1, 2, 3 (หน่วยเป็นลำดับจริง) ; ยังไม่เผยแพร่ = วงเส้นประ เข้าชุดกับป้ายรหัสวิชาแบบร่าง
 * - หัวหน่วยเป็นปุ่มจริง (aria-expanded + aria-controls) — กด Enter / Space ได้ ; พับแล้วไม่วาดเนื้อหา
 * - readOnly (ผู้ดูแลระบบ / วิชาที่ปิด): ไม่มีปุ่มจัดการ แต่ยังพับ / เปิดดูได้
 * - ปุ่มท้ายหน่วยที่เปิด "อัปโหลดไฟล์ · เขียนข้อความ · เพิ่มลิงก์" (กฐ1 — ขั้น 4.6 ก / ข)
 *   จอใหญ่เรียงแถว ; มือถือ "อัปโหลดไฟล์" เต็มความกว้างบรรทัดบน แล้วอีก 2 ปุ่มแบ่งครึ่ง (ตาม board)
 *   + ปุ่ม "แก้ไข" ในแถวเนื้อหา (ขั้น 4.6 ก) + กดชื่อรายการดูตัวอย่าง (ขั้น 4.7 ข — ContentRow)
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Content, Module } from '../../../api/content'
import { Button, Markdown, StatusBadge } from '../../../components/ui'
import { EyeIcon, EyeOffIcon, UploadIcon } from '../icons'
import { ContentKindIcon, ToggleIcon } from './contentIcons'
import { ContentRow } from './ContentRow'
import { LOCKED, RowControls } from './RowControls'

type ModuleCardProps = {
  module: Module
  /** ลำดับที่แสดงในวงเลข (เริ่มที่ 1) */
  number: number
  first: boolean
  last: boolean
  open: boolean
  onToggle: () => void
  readOnly: boolean
  /** ระหว่างรอผลของปุ่มใดก็ตาม → ปุ่มทุกแถวกดไม่ได้ */
  disabled: boolean
  onMove: (direction: 'up' | 'down') => void
  onTogglePublish: () => void
  onEdit: () => void
  onDelete: () => void
  onContentMove: (content: Content, direction: 'up' | 'down') => void
  onContentTogglePublish: (content: Content) => void
  onContentDelete: (content: Content) => void
  onContentEdit: (content: Content) => void
  /** รหัสเนื้อหาที่เปิดตัวอย่างอยู่ (ทั้งแท็บเปิดได้ทีละรายการ — ขค1) + กดชื่อรายการ (ขั้น 4.7 ข) */
  previewId: number | null
  /** รายวิชายังไม่เผยแพร่ — ผู้เรียนยังไม่เห็นเนื้อหาใด ๆ (หัวกล่องตัวอย่างบอก "… เมื่อเผยแพร่") */
  courseDraft: boolean
  onTogglePreview: (content: Content) => void
  /** ปุ่มท้ายหน่วย: อัปโหลดไฟล์ (ขั้น 4.6 ข) / เขียนข้อความ / เพิ่มลิงก์ (ขั้น 4.6 ก) */
  onAddFiles: () => void
  onAddText: () => void
  onAddLink: () => void
}

export function ModuleCard({
  module,
  number,
  first,
  last,
  open,
  onToggle,
  readOnly,
  disabled,
  onMove,
  onTogglePublish,
  onEdit,
  onDelete,
  onContentMove,
  onContentTogglePublish,
  onContentDelete,
  onContentEdit,
  previewId,
  courseDraft,
  onTogglePreview,
  onAddFiles,
  onAddText,
  onAddLink,
}: ModuleCardProps) {
  const { t } = useTranslation()
  const bodyId = useId()
  const count = module.contents.length
  const name = t('content.moduleName', { number })

  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-col gap-1.5 px-2 py-2 lg:flex-row lg:items-center lg:gap-2.5 lg:py-2.5 lg:pr-4 lg:pl-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className={
            'flex min-h-12 min-w-0 grow cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent ' +
            'px-1.5 text-left text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 ' +
            'focus-visible:outline-accent'
          }
        >
          <span className="flex shrink-0 text-brand">
            <ToggleIcon open={open} />
          </span>
          <span
            aria-hidden="true"
            className={
              'flex size-[34px] shrink-0 items-center justify-center rounded-full font-display text-base ' +
              'font-semibold text-brand ' +
              (module.is_published
                ? 'bg-canvas'
                : 'border-[1.5px] border-dashed border-line-strong bg-surface')
            }
          >
            {number}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[17px] leading-[1.35] font-semibold break-words lg:text-lg">
              {module.title}
            </span>
            <span className="block text-[13.5px] text-ink-muted">
              {count > 0 ? t('content.itemCount', { count }) : t('content.noItems')}
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 pl-2 lg:shrink-0 lg:pl-0">
          {module.is_published ? (
            <StatusBadge tone="ok" icon={<EyeIcon />}>
              {t('content.published')}
            </StatusBadge>
          ) : (
            <StatusBadge tone="mute" icon={<EyeOffIcon />}>
              {t('content.draft')}
            </StatusBadge>
          )}
          {!readOnly && (
            <RowControls
              name={name}
              first={first}
              last={last}
              published={module.is_published}
              disabled={disabled}
              onMove={onMove}
              onTogglePublish={onTogglePublish}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>

      {open && (
        <div id={bodyId} className="border-t border-line-soft px-3.5 pt-1.5 pb-3 lg:pr-4 lg:pl-[66px]">
          {module.description && (
            <Markdown text={module.description} className="my-2 text-sm! text-ink-muted" />
          )}
          {count > 0 ? (
            <ul className="m-0 list-none divide-y divide-line-soft p-0">
              {module.contents.map((content, index) => (
                <ContentRow
                  key={content.id}
                  content={content}
                  first={index === 0}
                  last={index === count - 1}
                  readOnly={readOnly}
                  disabled={disabled}
                  onMove={(direction) => onContentMove(content, direction)}
                  onTogglePublish={() => onContentTogglePublish(content)}
                  onDelete={() => onContentDelete(content)}
                  onEdit={() => onContentEdit(content)}
                  previewOpen={previewId === content.id}
                  onTogglePreview={() => onTogglePreview(content)}
                  parentHidden={courseDraft || !module.is_published}
                />
              ))}
            </ul>
          ) : (
            <p className="m-0 py-3 text-sm text-ink-muted">{t('content.moduleEmpty')}</p>
          )}
          {!readOnly && (
            // ปุ่มเพิ่มเนื้อหาท้ายหน่วย — ชื่อเต็มบอกหน่วยด้วย (เปิดหลายหน่วยพร้อมกันได้)
            // ระหว่างรอผลของปุ่มอื่น: aria-disabled (ยังรับโฟกัส กดแล้วไม่ทำอะไร — กติกาเดียวกับปุ่มในแถว กภ1)
            <div
              role="group"
              aria-label={t('content.addGroupLabel', { name })}
              className="mt-2.5 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap"
            >
              <Button
                variant="secondary"
                className={`col-span-2 ${LOCKED}`}
                aria-disabled={disabled || undefined}
                onClick={() => {
                  if (!disabled) onAddFiles()
                }}
                aria-label={t('content.addFileLabel', { name })}
              >
                <UploadIcon />
                {t('content.addFile')}
              </Button>
              <Button
                variant="secondary"
                className={LOCKED}
                aria-disabled={disabled || undefined}
                onClick={() => {
                  if (!disabled) onAddText()
                }}
                aria-label={t('content.addTextLabel', { name })}
              >
                <ContentKindIcon kind="text" size={18} />
                {t('content.addText')}
              </Button>
              <Button
                variant="secondary"
                className={LOCKED}
                aria-disabled={disabled || undefined}
                onClick={() => {
                  if (!disabled) onAddLink()
                }}
                aria-label={t('content.addLinkLabel', { name })}
              >
                <ContentKindIcon kind="link" size={18} />
                {t('content.addLink')}
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
