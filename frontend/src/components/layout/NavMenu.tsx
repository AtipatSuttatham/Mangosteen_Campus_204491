/**
 * ชิ้นส่วนที่ sidebar (จอใหญ่) และเมนูลิ้นชัก (มือถือ) ใช้ร่วมกัน — หน้าตาตาม design canvas
 *
 *   <NavLinks>   รายการเมนูหลักตามบทบาท ; เมนูของหน้าปัจจุบันมีแถบเขียวด้านซ้าย + พื้นสว่างขึ้น
 *   <UserPanel>  ส่วนล่าง: รูปวงกลม + ชื่อ + บทบาท, ลิงก์ "ข้อมูลส่วนตัว", ปุ่ม "ออกจากระบบ"
 *
 * variant:
 *   sidebar  ตาม board "หน้าแรกหลังเข้าสู่ระบบ" (ลิงก์ล่าง 14px)
 *   drawer   ตาม board "โครงหน้าจอบนมือถือ (เปิดเมนู)" — พื้นที่กดสูงขึ้นสำหรับนิ้ว (เมนู 48px, ลิงก์ล่าง 44px)
 *
 * onNavigate: เรียกเมื่อกดลิงก์ใดก็ได้ (เมนูลิ้นชักใช้ปิดตัวเองหลังเลือกเมนู)
 */
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Avatar } from '../ui'
import { NAV_ICONS } from './icons'
import { navItemsFor } from './navigation'

type Variant = 'sidebar' | 'drawer'

type NavMenuProps = {
  variant: Variant
  onNavigate?: () => void
}

/** focus ring บนพื้นม่วง: เส้นสีเขียว (เหมือนปุ่มทั้งระบบ) */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** รายการเมนูหลัก */
export function NavLinks({ variant, onNavigate }: NavMenuProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user) return null

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {navItemsFor(user.role).map((item) => {
        const Icon = NAV_ICONS[item.icon]
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              // end: เมนู "/" ถูกเลือกเฉพาะที่หน้าแรกพอดี (ไม่ใช่ทุกหน้าที่ขึ้นต้นด้วย /)
              end
              onClick={onNavigate}
              // NavLink ใส่ aria-current="page" ให้เมนูของหน้าปัจจุบันเอง (โปรแกรมอ่านหน้าจออ่านว่า "หน้าปัจจุบัน")
              className={({ isActive }) =>
                '-ml-[3px] flex items-center gap-3 rounded-r-control border-l-[3px] px-3.5 py-[11px] ' +
                `text-[15px] no-underline ${FOCUS} ` +
                (variant === 'drawer' ? 'min-h-12 ' : '') +
                (isActive
                  ? 'border-accent bg-white/8 font-semibold text-white hover:text-white'
                  : 'border-transparent font-medium text-on-brand-muted hover:text-white')
              }
            >
              <Icon />
              {t(`nav.${item.label}`)}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

/** ส่วนล่างของเมนู: ผู้ใช้ที่เข้าสู่ระบบอยู่ + ข้อมูลส่วนตัว + ออกจากระบบ */
export function UserPanel({ variant, onNavigate }: NavMenuProps) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  if (!user) return null

  // ลิงก์/ปุ่มด้านล่าง: ตัวอักษรชมพูอ่อน ชี้แล้วเป็นสีขาว ; มือถือสูง 44px ให้กดด้วยนิ้วง่าย
  const linkClass =
    'w-fit rounded-sm font-medium no-underline hover:text-white ' +
    `${FOCUS} ` +
    (variant === 'drawer' ? 'flex min-h-11 items-center text-[15px]' : 'text-sm')

  return (
    <div
      className={
        'flex flex-col border-t border-white/16 pt-[18px] ' +
        (variant === 'drawer' ? 'gap-1' : 'gap-3')
      }
    >
      <div className={`flex items-center gap-2.5 ${variant === 'drawer' ? 'mb-2' : ''}`}>
        <Avatar user={user} size={38} />
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-white">
            {user.first_name} {user.last_name}
          </p>
          <p className="m-0 text-[13px] text-on-brand-muted">{t(`roles.${user.role}`)}</p>
        </div>
      </div>
      <NavLink
        to="/profile"
        onClick={onNavigate}
        className={({ isActive }) =>
          `${linkClass} ${isActive ? 'font-semibold text-white' : 'text-on-brand-muted'}`
        }
      >
        {t('nav.profile')}
      </NavLink>
      {/* ออกจากระบบทันที (ไม่ถามยืนยัน) — ทุกแท็บของเว็บนี้ไปหน้าเข้าสู่ระบบด้วย (ขั้น 1.4) */}
      <button
        type="button"
        onClick={() => void logout()}
        className={`${linkClass} cursor-pointer border-0 bg-transparent p-0 text-left text-on-brand-muted`}
      >
        {t('nav.logout')}
      </button>
    </div>
  )
}
