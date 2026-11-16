/**
 * ชิ้นส่วนที่หน้าต่างเพิ่ม / แก้เนื้อหาใช้ร่วมกัน (ขั้น 4.6 ก)
 *
 * - KindField: ชนิดเนื้อหาแบบแสดงอย่างเดียว (ชนิดเปลี่ยนหลังสร้างไม่ได้)
 * - ModuleField: ช่อง "อยู่ในหน่วย" — เปลี่ยนหน่วย = ย้ายไปต่อท้ายหน่วยนั้น
 * - MarkdownTextarea: ช่องข้อความยาว (ใช้ Markdown ได้) + คำแนะนำใต้ช่อง
 * - MarkdownEditor: เนื้อความของข้อความ + แท็บ "เขียน / ดูตัวอย่าง" (ผู้ใช้เลือกแบบ กร1)
 * - FormError: ข้อความ error รวมเหนือปุ่ม (แบบเดียวกับหน้าต่างหน่วย)
 * (ข้อความที่ใช้หลายหน้าต่าง — contentKindName / fileProblemMessage — อยู่ใน contentNames.ts)
 */
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Content, Module } from '../../../api/content'
import { Markdown, Select } from '../../../components/ui'
import { contentKindName } from './contentNames'

/** หน้าตาของช่องข้อความยาว (เหมือนช่องคำอธิบายในหน้าต่างหน่วย) */
const TEXTAREA_CLASS =
  'w-full resize-y rounded-control border border-line-strong bg-surface px-3.5 py-3 text-[15px] ' +
  'leading-[1.6] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-brand ' +
  'disabled:border-line disabled:bg-canvas disabled:text-ink-muted'

/** ป้ายชื่อช่อง (ตัวหนา 15px) + "(ไม่บังคับ)" ถ้าส่ง optional */
function FieldLabel({
  htmlFor,
  id,
  children,
  optional = false,
}: {
  htmlFor?: string
  id?: string
  children: ReactNode
  optional?: boolean
}) {
  const { t } = useTranslation()
  const content = (
    <>
      {children}
      {optional && (
        <>
          {' '}
          <span className="font-normal text-ink-muted">{t('content.optional')}</span>
        </>
      )}
    </>
  )
  // มีช่องให้ผูก = <label> (กดป้ายแล้วไปที่ช่อง) ; ไม่มี (เช่น ชนิดเนื้อหาที่แสดงอย่างเดียว) = ข้อความธรรมดา
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className="text-[15px] font-semibold">
      {content}
    </label>
  ) : (
    <span id={id} className="text-[15px] font-semibold">
      {content}
    </span>
  )
}

/** คำแนะนำสีรองใต้ช่อง */
export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
      {children}
    </p>
  )
}

/** ชนิดเนื้อหาแบบแสดงอย่างเดียว + คำอธิบายว่าทำไมเปลี่ยนไม่ได้ */
export function KindField({ content }: { content: Content }) {
  const { t } = useTranslation()
  const labelId = useId()
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-labelledby={labelId}>
      <FieldLabel id={labelId}>{t('content.kindLabel')}</FieldLabel>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-control bg-canvas px-3 py-1.5 text-[15px] font-semibold">
          {contentKindName(content, t)}
        </span>
        <FieldHint>{content.file_link ? t('content.kindFixedFromFile') : t('content.kindFixed')}</FieldHint>
      </div>
    </div>
  )
}

/** ช่อง "อยู่ในหน่วย" — ตัวเลือก "3. ชื่อหน่วย" ตามลำดับบนจอ */
export function ModuleField({
  modules,
  disabled,
  ...props
}: ComponentProps<'select'> & { modules: Module[] }) {
  const { t } = useTranslation()
  const id = useId()
  const hintId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{t('content.moduleLabel')}</FieldLabel>
      <Select id={id} disabled={disabled} aria-describedby={hintId} {...props}>
        {modules.map((module, index) => (
          <option key={module.id} value={String(module.id)}>
            {t('content.moduleOption', { number: index + 1, title: module.title })}
          </option>
        ))}
      </Select>
      <FieldHint id={hintId}>{t('content.moduleHint')}</FieldHint>
    </div>
  )
}

/** ช่องข้อความยาว (Markdown) พร้อมป้ายชื่อ + คำแนะนำ */
export function MarkdownTextarea({
  label,
  hint,
  optional = false,
  rows = 4,
  ...props
}: ComponentProps<'textarea'> & { label: string; hint: string; optional?: boolean }) {
  const id = useId()
  const hintId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <textarea id={id} rows={rows} aria-describedby={hintId} className={TEXTAREA_CLASS} {...props} />
      <FieldHint id={hintId}>{hint}</FieldHint>
    </div>
  )
}

/**
 * เนื้อความของข้อความ + แท็บ "เขียน / ดูตัวอย่าง" (board "แก้ไขเนื้อหาแบบข้อความ" — กร1)
 * แท็บเป็นปุ่ม 2 ปุ่มแบบกดค้าง (aria-pressed) ; ดูตัวอย่างใช้ Markdown ตัวเดียวกับหน้าผู้เรียน
 * ช่องพิมพ์ซ่อนด้วย hidden ตอนดูตัวอย่าง (ไม่ถอดออก — React Hook Form ยังอ่านค่าได้)
 */
export function MarkdownEditor({
  label,
  value,
  ...props
}: ComponentProps<'textarea'> & { label: string; value: string }) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState(false)
  const id = useId()
  const hintId = useId()
  const tabClass = (active: boolean) =>
    'min-h-9 cursor-pointer rounded-control border-0 px-3.5 text-sm font-semibold ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    (active ? 'bg-surface text-brand shadow-segment' : 'bg-transparent text-ink-muted hover:text-ink')

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <FieldLabel htmlFor={preview ? undefined : id}>{label}</FieldLabel>
        <div
          role="group"
          aria-label={t('content.bodyTabs')}
          className="flex gap-1 rounded-[10px] bg-canvas p-1"
        >
          <button
            type="button"
            aria-pressed={!preview}
            className={tabClass(!preview)}
            onClick={() => setPreview(false)}
          >
            {t('content.tabWrite')}
          </button>
          <button
            type="button"
            aria-pressed={preview}
            className={tabClass(preview)}
            onClick={() => setPreview(true)}
          >
            {t('content.tabPreview')}
          </button>
        </div>
      </div>
      <textarea
        id={id}
        rows={9}
        hidden={preview}
        aria-describedby={hintId}
        className={TEXTAREA_CLASS}
        {...props}
      />
      {preview && (
        <div className="min-h-[220px] rounded-control border border-line bg-surface px-3.5 py-3">
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="m-0 text-sm text-ink-muted">{t('content.previewEmpty')}</p>
          )}
        </div>
      )}
      <FieldHint id={hintId}>{t('content.bodyHint')}</FieldHint>
    </div>
  )
}

/** หมายเหตุสีเทาพร้อมไอคอน (เช่น "เนื้อหาใหม่ยังไม่เผยแพร่…") */
export function DialogNote({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-mute-soft px-3.5 py-3 text-[13.5px] leading-[1.55] text-mute">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="m-0">{children}</p>
    </div>
  )
}

/** ข้อความ error รวมเหนือปุ่ม (ไม่มี = ไม่แสดง) */
export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
      {message}
    </p>
  )
}
