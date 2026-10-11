/**
 * เมนูลิ้นชักบนมือถือ (< 1024px) — ตาม board "โครงหน้าจอบนมือถือ (เปิดเมนู)" ใน design canvas
 *
 *   ┌────────────────┬─────┐
 *   │▓ ตรา       ✕  ▓│░░░░░│  ← แผงม่วงกว้าง 300px เลื่อนออกจากซ้าย
 *   │▓▌ภาพรวม      ▓│░░░░░│  ← พื้นด้านหลังมืดลง (แตะเพื่อปิด)
 *   │▓ ──────────  ▓│░░░░░│
 *   │▓ (สร) ชื่อ     ▓│░░░░░│
 *   │▓ ข้อมูลส่วนตัว  ▓│░░░░░│
 *   │▓ ออกจากระบบ  ▓│░░░░░│
 *   └────────────────┴─────┘
 *
 * แสดงเฉพาะตอนเปิด (AppShell เป็นคนเปิด/ปิด) และทำงานแบบหน้าต่างซ้อน (dialog) ตามมาตรฐานการเข้าถึง:
 *   - เปิดแล้วโฟกัสไปที่ปุ่ม ✕ ; ปุ่ม Tab วนอยู่ในเมนู ; หน้าด้านหลังเลื่อนไม่ได้
 *   - ปิดได้ 4 ทาง: ปุ่ม ✕, แตะพื้นที่มืด, กด Esc, เลือกเมนู/ลิงก์
 *   - ขยายหน้าจอจนถึงขนาดจอใหญ่ระหว่างเปิด → ปิดเอง (จอใหญ่ใช้ sidebar แทน)
 * (ไม่ใช้ <dialog> ของเบราว์เซอร์ เพราะตัวจำลองเบราว์เซอร์ที่ใช้ทดสอบ (jsdom) ยังไม่รองรับ)
 */
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '../ui'
import { CloseIcon } from './icons'
import { NavLinks, UserPanel } from './NavMenu'

/** id ของแผงเมนู — ปุ่ม ☰ อ้างถึงด้วย aria-controls */
export const MOBILE_MENU_ID = 'mobile-menu'

/** ขนาดจอที่เปลี่ยนเป็น sidebar (ตรงกับ lg: ของ Tailwind และหน้าเข้าสู่ระบบ) */
const DESKTOP_QUERY = '(min-width: 1024px)'

/** สิ่งที่กด/โฟกัสได้ในเมนู (ใช้วน Tab) */
const FOCUSABLE = 'a[href], button:not([disabled])'

export function MobileDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // เปิดแล้วโฟกัสที่ปุ่ม ✕ — ผู้ใช้แป้นพิมพ์/โปรแกรมอ่านหน้าจอรู้ทันทีว่าอยู่ในเมนู
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // ล็อกการเลื่อนหน้าด้านหลังระหว่างเปิดเมนู แล้วคืนค่าเดิมเมื่อปิด
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // หน้าจอกว้างจนเป็นจอใหญ่ (เช่น หมุนแท็บเล็ต) → ปิดเมนู
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DESKTOP_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) onClose()
    }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [onClose])

  /** แป้นพิมพ์ในเมนู: Esc = ปิด ; Tab ที่ตัวสุดท้าย / Shift+Tab ที่ตัวแรก = วนกลับ */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/* พื้นมืดด้านหลัง: แตะเพื่อปิด (ผู้ใช้แป้นพิมพ์ใช้ Esc หรือปุ่ม ✕ แทน) */}
      <div
        aria-hidden="true"
        data-testid="drawer-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-ink/55 motion-safe:animate-fade-in"
      />

      <div
        id={MOBILE_MENU_ID}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.mainMenu')}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col overflow-y-auto bg-brand px-5 pt-3.5 pb-6 motion-safe:animate-drawer-in"
      >
        {/* ตรา + ปุ่มปิด */}
        <div className="mb-7 flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <Logo size={34} withWordmark tone="onDark" wordmarkSize="sm" />
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={t('nav.closeMenu')}
            onClick={onClose}
            className="-mr-2.5 flex size-11 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1">
          <NavLinks variant="drawer" onNavigate={onClose} />
        </nav>
        <UserPanel variant="drawer" onNavigate={onClose} />
      </div>
    </div>
  )
}
