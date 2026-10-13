/**
 * หน้าต่างซ้อน (dialog) — หน้าตาตาม board ก้อน 2 ใน design canvas (ขั้น 2.6):
 * "เพิ่มผู้ใช้", "แก้ไขบัญชีตัวเอง", "รีเซ็ตรหัสผ่าน", "สร้างบัญชีแล้ว" และ "เพิ่มผู้ใช้ (มือถือ)"
 *
 *   จอใหญ่ (≥ 1024px) — หน้าต่างกลางจอ            มือถือ — เต็มจอ (layout="sheet")
 *   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░             ┌────────────────────────┐
 *   ░░ ┌──────────────────────────┐ ░░             │▓ ✕ จัดการบัญชีผู้ใช้      ▓│ ← หัวม่วง
 *   ░░ │ หัวข้อ                  ✕ │ ░░             │▓ หัวข้อ                 ▓│
 *   ░░ │ เนื้อหา                    │ ░░             │ เนื้อหา (พื้นม่วงอ่อน)     │
 *   ░░ │ ─────────────────────────│ ░░             │                        │
 *   ░░ │          [ยกเลิก] [บันทึก] │ ░░             │ [ยกเลิก]  [บันทึก]      │ ← ติดล่างจอ
 *   ░░ └──────────────────────────┘ ░░             └────────────────────────┘
 *
 * ประกอบจาก 4 ชิ้น:  <Dialog> ครอบทั้งหมด + <DialogHeader> + <DialogBody> + <DialogFooter>
 *   (หน้าต่างยืนยันสั้น ๆ ใช้ <ConfirmDialog> ที่สร้างจาก <Dialog layout="center">)
 *
 * พฤติกรรม (มาตรฐานการเข้าถึงของหน้าต่างซ้อน):
 *   - เปิดแล้วโฟกัสเข้าไปข้างใน ; Tab วนอยู่ในหน้าต่าง ; ปิดแล้วโฟกัสกลับปุ่มที่กดเปิด (useFocusTrap)
 *   - ปิดได้ด้วย Esc / ปุ่ม ✕ / ปุ่มยกเลิก — **แตะพื้นมืดด้านหลังไม่ปิด** กันข้อมูลที่กรอกหายเพราะแตะพลาด
 *   - หน้าด้านหลังเลื่อนไม่ได้ และถูกปิดไม่ให้กด/โฟกัส (inert) ระหว่างเปิด
 *   - วาดไว้ท้าย <body> (portal) จึงอยู่เหนือทุกอย่างในหน้า
 * แสดงเฉพาะตอนเปิด — หน้าที่ใช้เป็นคนตัดสินว่าจะ render หรือไม่ (เหมือน MobileDrawer)
 * (ไม่ใช้ <dialog> ของเบราว์เซอร์ เพราะตัวจำลองเบราว์เซอร์ที่ใช้ทดสอบ (jsdom) ยังไม่รองรับ)
 */
import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CalyxPattern } from '../brand/CalyxPattern'
import { useFocusTrap } from './useFocusTrap'

/** ความกว้างของหน้าต่างบนจอใหญ่ (ตาม board: ฟอร์ม 600px, รีเซ็ต/เสร็จแล้ว 560px, ยืนยัน 500px) */
type DialogSize = 'md' | 'sm' | 'xs'
const SIZE_CLASSES: Record<DialogSize, string> = {
  md: 'lg:w-[600px]',
  sm: 'lg:w-[560px]',
  xs: 'w-[500px]',
}

type DialogProps = {
  /** เรียกเมื่อผู้ใช้ขอปิด (Esc / ปุ่ม ✕) — ระหว่างกำลังบันทึก หน้าที่ใช้ไม่ต้องปิดก็ได้ */
  onClose: () => void
  /** id ของหัวข้อ — โปรแกรมอ่านหน้าจอใช้เป็นชื่อของหน้าต่าง */
  labelledBy: string
  /** id ของคำอธิบาย (ถ้ามี) */
  describedBy?: string
  /** alertdialog = หน้าต่างยืนยันที่ต้องตอบก่อนทำอย่างอื่น */
  role?: 'dialog' | 'alertdialog'
  /** sheet = มือถือเต็มจอ / จอใหญ่กลางจอ (ฟอร์ม) ; center = กลางจอทุกขนาด (หน้าต่างยืนยัน) */
  layout?: 'sheet' | 'center'
  size?: DialogSize
  /** ตัวที่ได้โฟกัสเมื่อเปิด — ไม่ส่ง = สิ่งแรกที่กดได้ (ปุ่ม ✕) */
  initialFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
}

/** กรอบของหน้าต่างซ้อน: พื้นมืด + กล่องหน้าต่าง */
export function Dialog({
  onClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  layout = 'sheet',
  size = 'md',
  initialFocusRef,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const trapTab = useFocusTrap(panelRef, { initialFocusRef })

  // ระหว่างเปิด: หน้าด้านหลังเลื่อนไม่ได้ + กด/โฟกัสไม่ได้ (inert) — ปิดแล้วคืนค่าเดิม
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const appRoot = document.getElementById('root')
    const wasInert = appRoot?.hasAttribute('inert') ?? false
    appRoot?.setAttribute('inert', '')
    return () => {
      document.body.style.overflow = previousOverflow
      if (!wasInert) appRoot?.removeAttribute('inert')
    }
  }, [])

  /** แป้นพิมพ์ในหน้าต่าง: Esc = ขอปิด ; Tab = วนอยู่ในหน้าต่าง */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    trapTab(event)
  }

  const isSheet = layout === 'sheet'

  return createPortal(
    <div
      className={
        'fixed inset-0 z-50 flex ' +
        (isSheet ? 'lg:items-center lg:justify-center lg:p-6' : 'items-center justify-center p-4')
      }
    >
      {/* พื้นมืดด้านหลัง (ตกแต่งอย่างเดียว — แตะแล้วไม่ปิด) ; มือถือแบบ sheet มองไม่เห็นเพราะหน้าต่างเต็มจอ */}
      <div
        aria-hidden="true"
        data-testid="dialog-backdrop"
        className="absolute inset-0 bg-ink/50 motion-safe:animate-fade-in"
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onKeyDown={handleKeyDown}
        className={
          'relative flex flex-col overflow-y-auto motion-safe:animate-dialog-in ' +
          (isSheet
            ? // มือถือ: เต็มจอ พื้นม่วงอ่อน ; จอใหญ่: กล่องขาวมุมโค้ง มีเงา สูงไม่เกินจอ
              'h-full w-full bg-canvas lg:h-auto lg:max-h-full lg:rounded-card lg:bg-surface lg:shadow-dialog '
            : 'max-h-full max-w-full rounded-card bg-surface shadow-dialog ') +
          SIZE_CLASSES[size]
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** ไอคอน ✕ ของปุ่มปิด (ตกแต่งอย่างเดียว) */
function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

type DialogHeaderProps = {
  /** id ของหัวข้อ (ตัวเดียวกับ labelledBy ของ Dialog) */
  titleId: string
  title: string
  /** บรรทัดรองใต้หัวข้อ เช่น ชื่อผู้ใช้ที่กำลังแก้ */
  subtitle?: ReactNode
  /** ข้อความเล็กข้างปุ่ม ✕ บนหัวม่วงของมือถือ เช่น "จัดการบัญชีผู้ใช้" (จอใหญ่ไม่แสดง) */
  eyebrow?: string
  /** ไอคอนหน้าหัวข้อบนจอใหญ่ เช่น วงกลม ✓ ของหน้า "สร้างบัญชีแล้ว" (มือถือไม่แสดง — หัวม่วงบอกแล้ว) */
  icon?: ReactNode
  onClose: () => void
  /** ปุ่ม ✕ กดไม่ได้ (เช่น ระหว่างกำลังบันทึก) */
  closeDisabled?: boolean
}

/**
 * หัวของหน้าต่าง
 *   จอใหญ่: หัวข้อตัว Taviraj 24px + บรรทัดรอง + ปุ่ม ✕ มุมขวา (พื้นขาว)
 *   มือถือ: แถบม่วงมีลายกลีบเลี้ยง — ✕ + ข้อความเล็ก แล้วตามด้วยหัวข้อสีขาว 26px (ตาม board มือถือ)
 */
export function DialogHeader({
  titleId,
  title,
  subtitle,
  eyebrow,
  icon,
  onClose,
  closeDisabled = false,
}: DialogHeaderProps) {
  const { t } = useTranslation()
  return (
    <div className="relative shrink-0 overflow-hidden bg-brand pt-1.5 pr-2 pb-[18px] pl-1 lg:flex lg:items-start lg:justify-between lg:gap-3 lg:overflow-visible lg:bg-transparent lg:pt-[22px] lg:pr-[18px] lg:pb-0 lg:pl-7">
      {/* ลายกลีบเลี้ยงมุมขวาบน (เฉพาะหัวม่วงบนมือถือ) */}
      <CalyxPattern
        size={170}
        strokeWidth={0.35}
        className="pointer-events-none absolute -top-[62px] -right-12 text-accent opacity-[0.24] lg:hidden"
      />
      <div className="relative flex items-center gap-0.5 lg:order-2">
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label={t('dialog.close')}
          className={
            'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 ' +
            'bg-transparent text-white disabled:cursor-not-allowed disabled:opacity-50 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
            'lg:text-ink-muted lg:not-disabled:hover:bg-canvas lg:not-disabled:hover:text-ink'
          }
        >
          <CloseIcon />
        </button>
        {eyebrow && <span className="text-sm text-on-brand-muted lg:hidden">{eyebrow}</span>}
      </div>
      <div className="relative mt-0.5 ml-4 lg:order-1 lg:m-0 lg:flex lg:items-center lg:gap-3.5">
        {icon && <div className="hidden lg:block">{icon}</div>}
        <div>
          <h2
            id={titleId}
            className="m-0 font-display text-[26px] leading-[1.35] font-semibold text-white lg:text-2xl lg:text-ink"
          >
            {title}
          </h2>
          {subtitle && (
            <div className="mt-0.5 text-sm leading-[1.6] text-on-brand-muted lg:text-ink-muted">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** เนื้อหาของหน้าต่าง (มือถือ: ขอบ 16px ; จอใหญ่: ขอบ 28px ตาม board) */
export function DialogBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex grow flex-col gap-3 p-4 lg:gap-[18px] lg:px-7 lg:pt-5 lg:pb-6 ${className}`}>
      {children}
    </div>
  )
}

/**
 * แถบปุ่มท้ายหน้าต่าง
 *   จอใหญ่: ปุ่มชิดขวา มีเส้นคั่นด้านบน
 *   มือถือ: ติดล่างจอ ปุ่มแบ่งความกว้างกัน (ปุ่มหลักกว้างกว่า — mobileColumns ตาม board)
 */
export function DialogFooter({
  children,
  mobileColumns = 'grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]',
}: {
  children: ReactNode
  /** การแบ่งคอลัมน์ปุ่มบนมือถือ (class ของ Tailwind) — ปุ่มเดียวใช้ 'grid-cols-1' */
  mobileColumns?: string
}) {
  return (
    <div
      className={
        `sticky bottom-0 mt-auto grid shrink-0 gap-2.5 border-t border-line bg-surface px-4 pt-3.5 pb-[18px] shadow-sheet-footer ${mobileColumns} ` +
        'lg:static lg:flex lg:justify-end lg:border-line-soft lg:px-7 lg:py-[18px] lg:shadow-none'
      }
    >
      {children}
    </div>
  )
}
