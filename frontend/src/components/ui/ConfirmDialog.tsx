/**
 * หน้าต่างยืนยันก่อนทำสิ่งที่ย้อนยาก — หน้าตาตาม board "หน้าต่างยืนยัน (ใช้ซ้ำได้) — ระงับบัญชี" (ขั้น 2.6)
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ ระงับบัญชี วิชัย ทองมา?                         │  ← หัวข้อเป็นคำถาม
 *   │ ผู้ใช้จะออกจากระบบทันที และเข้าสู่ระบบไม่ได้…      │  ← ผลที่จะเกิด (สีรอง)
 *   │ ข้อมูลและคะแนนของผู้ใช้ยังอยู่ครบ                 │
 *   │                       [ยกเลิก]  [ระงับบัญชี]   │  ← โฟกัสที่ "ยกเลิก" ก่อน
 *   └──────────────────────────────────────────────┘
 *
 * - เป็น alertdialog: โปรแกรมอ่านหน้าจออ่านหัวข้อ + คำอธิบายทันทีที่เปิด
 * - **โฟกัสที่ "ยกเลิก" ก่อน** (การตัดสินใจก้อน 2) — กด Enter พลาดจะไม่ไปโดนปุ่มอันตราย
 * - ระหว่างกำลังทำ (pending): ปุ่มยืนยันขึ้นข้อความรอและกดไม่ได้, ปุ่มยกเลิก/Esc ไม่ปิดหน้าต่าง
 * - ทำไม่สำเร็จ: แสดงข้อความ error (จาก th.ts) เหนือปุ่ม — หน้าต่างยังเปิดอยู่ให้ลองใหม่หรือยกเลิก
 * ใช้ซ้ำได้ทุกก้อน เช่น ปิดรายวิชา ลบแบบทดสอบที่ยังไม่เผยแพร่
 */
import { useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { Dialog } from './Dialog'

type ConfirmDialogProps = {
  /** คำถาม เช่น "ระงับบัญชี วิชัย ทองมา?" */
  title: string
  /** คำอธิบายผลที่จะเกิด (ย่อหน้าละ 1 ข้อความ) */
  description: ReactNode[]
  /** ข้อความปุ่มยืนยัน เช่น "ระงับบัญชี" */
  confirmLabel: string
  /** ข้อความบนปุ่มยืนยันระหว่างกำลังทำ เช่น "กำลังระงับ…" */
  pendingLabel?: string
  /** danger = ปุ่มแดงทึบ (ค่าเริ่มต้น) ; primary = ปุ่มม่วง */
  tone?: 'danger' | 'primary'
  /** กำลังทำอยู่หรือไม่ */
  pending?: boolean
  /** ข้อความ error (แปลแล้ว) เมื่อทำไม่สำเร็จ */
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

/** หน้าต่างยืนยัน */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  tone = 'danger',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog
      role="alertdialog"
      layout="center"
      size="xs"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={cancelRef}
      // ระหว่างกำลังทำ กด Esc แล้วไม่ปิด (รอผลก่อน)
      onClose={() => {
        if (!pending) onCancel()
      }}
    >
      <div className="px-7 pt-[26px] pb-[22px]">
        <h2 id={titleId} className="m-0 font-display text-[22px] leading-[1.4] font-semibold text-ink">
          {title}
        </h2>
        <div id={descriptionId}>
          {description.map((paragraph, index) => (
            <p
              key={index}
              className={`mb-0 text-[15px] leading-[1.65] text-ink-muted ${index === 0 ? 'mt-2' : 'mt-1.5'}`}
            >
              {paragraph}
            </p>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 mb-0 text-[14.5px] leading-[1.55] text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          {/* ปุ่มยกเลิกไม่ disabled ระหว่างรอ (โฟกัสจะได้ไม่หลุดออกจากหน้าต่าง) — แค่ไม่ทำอะไร */}
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={() => {
              if (!pending) onCancel()
            }}
            aria-disabled={pending || undefined}
          >
            {t('dialog.cancel')}
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={pending}>
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
