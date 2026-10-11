/**
 * โครงหน้าจอหลัก — ครอบทุกหน้าหลังเข้าสู่ระบบ (เนื้อหาของแต่ละหน้าแสดงตรง <Outlet />)
 * หน้าตาตาม design canvas (ผู้ใช้อนุมัติ 2026-10-11):
 *   - จอใหญ่ (≥ 1024px): board "หน้าแรกหลังเข้าสู่ระบบ" — sidebar ม่วงกว้าง 264px ติดซ้ายเต็มความสูง
 *   - มือถือ / จอเล็ก:    board "โครงหน้าจอบนมือถือ (เมนูปิด)" — แถบม่วงด้านบนสูง 60px
 *                         กด ☰ → เมนูลิ้นชัก (MobileDrawer.tsx)
 *
 *   ┌──────────┬──────────────────┐        ┌──────────────────────┐
 *   │▓ ตรา      │                  │        │▓ ☰ ตรา ชื่อระบบ   (สร)▓│ ← ติดด้านบนตอนเลื่อน
 *   │▓▌ภาพรวม  │   <เนื้อหาหน้า>     │        ├──────────────────────┤
 *   │▓         │                  │        │   <เนื้อหาหน้า>         │
 *   │▓ ──────  │                  │        │                      │
 *   │▓ (สร) ชื่อ │               ◌  │        │                   ◌  │ ← ลายกลีบเลี้ยงจาง
 *   │▓ ข้อมูล..  │                  │        └──────────────────────┘
 *   │▓ ออกจาก.. │                  │
 *   └──────────┴──────────────────┘
 *
 * ลายกลีบเลี้ยงจางมุมขวาล่างอยู่ในโครง → ทุกหน้ามีเหมือนกัน (wireframe หน้าแรก + ข้อมูลส่วนตัว)
 * ใช้ภายใต้ <RequireAuth> เท่านั้น (router.tsx) — จึงมีผู้ใช้ที่เข้าสู่ระบบอยู่เสมอ
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { CalyxPattern } from '../brand/CalyxPattern'
import { Avatar, Logo } from '../ui'
import { MenuIcon } from './icons'
import { MOBILE_MENU_ID, MobileDrawer } from './MobileDrawer'
import { NavLinks, UserPanel } from './NavMenu'

/** id ของพื้นที่เนื้อหา — ลิงก์ "ข้ามไปเนื้อหาหลัก" พามาที่นี่ */
const MAIN_ID = 'main-content'

/** focus ring บนพื้นม่วง (เหมือนปุ่มทั้งระบบ) */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export default function AppShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  // เมนูลิ้นชักบนมือถือเปิดอยู่ไหม
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  // สถานะรอบก่อน — ใช้รู้ว่า "เพิ่งปิด" เพื่อคืนโฟกัสให้ปุ่ม ☰
  const wasMenuOpen = useRef(false)

  // ปิดเมนูแล้ว → โฟกัสกลับที่ปุ่ม ☰ (ผู้ใช้แป้นพิมพ์ไม่หลงตำแหน่ง)
  useEffect(() => {
    if (wasMenuOpen.current && !menuOpen) menuButtonRef.current?.focus()
    wasMenuOpen.current = menuOpen
  }, [menuOpen])

  // ฟังก์ชันปิดเมนูตัวเดิมทุกครั้ง (MobileDrawer ใช้ใน effect)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  if (!user) return null

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      {/* ลิงก์ข้ามเมนู: มองไม่เห็นจนกว่าจะกด Tab ครั้งแรก
          inert = ระหว่างเปิดเมนูลิ้นชัก ส่วนนี้กด/โฟกัสไม่ได้ (บังคับให้อยู่ในเมนู) */}
      <a
        href={`#${MAIN_ID}`}
        inert={menuOpen}
        className={
          'sr-only rounded-control bg-surface px-4 py-2.5 font-semibold text-brand no-underline ' +
          `focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 ${FOCUS}`
        }
      >
        {t('nav.skipToContent')}
      </a>

      {/* จอใหญ่: sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col overflow-y-auto bg-brand px-5 py-7 lg:flex">
        <div className="mb-9 px-0.5">
          <Logo size={34} withWordmark tone="onDark" wordmarkSize="sm" />
        </div>
        <nav aria-label={t('nav.mainMenu')} className="flex-1">
          <NavLinks variant="sidebar" />
        </nav>
        <UserPanel variant="sidebar" />
      </aside>

      {/* มือถือ: แถบบน — ปุ่มเปิดเมนู, ตรา, รูปวงกลม (กดไปหน้าข้อมูลส่วนตัว) */}
      <header
        inert={menuOpen}
        className="sticky top-0 z-30 flex h-[60px] items-center gap-1.5 bg-brand pr-2 pl-1 lg:hidden"
      >
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={t('nav.openMenu')}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? MOBILE_MENU_ID : undefined}
          onClick={() => setMenuOpen(true)}
          className={`flex size-12 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-white ${FOCUS}`}
        >
          <MenuIcon />
        </button>
        <div className="min-w-0 flex-1">
          <Logo size={28} withWordmark tone="onDark" wordmarkSize="xs" />
        </div>
        <Link to="/profile" aria-label={t('nav.profile')} className={`rounded-full ${FOCUS}`}>
          <Avatar user={user} size={36} />
        </Link>
      </header>

      {/* เนื้อหาของหน้า (tabIndex -1: ให้ลิงก์ข้ามเมนูย้ายโฟกัสมาที่นี่ได้) */}
      <main
        id={MAIN_ID}
        tabIndex={-1}
        inert={menuOpen}
        className="relative min-h-[calc(100dvh-60px)] min-w-0 flex-1 overflow-hidden px-5 py-7 outline-none lg:min-h-screen lg:px-14 lg:py-12"
      >
        {/* ลายกลีบเลี้ยงจางมุมขวาล่าง: มือถือ 400px / จอใหญ่ 520px (ตาม canvas) */}
        <CalyxPattern
          size={400}
          strokeWidth={0.8}
          className="pointer-events-none absolute -right-[120px] -bottom-[110px] text-brand opacity-[0.07] lg:hidden"
        />
        <CalyxPattern
          size={520}
          strokeWidth={0.8}
          className="pointer-events-none absolute -right-[130px] -bottom-[150px] hidden text-brand opacity-[0.07] lg:block"
        />
        <div className="relative">
          <Outlet />
        </div>
      </main>

      {menuOpen && <MobileDrawer onClose={closeMenu} />}
    </div>
  )
}
