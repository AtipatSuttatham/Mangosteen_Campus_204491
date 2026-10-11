/**
 * หน้าแรกหลังเข้าสู่ระบบ / — แบบชั่วคราว (ขั้น 1.4) ไว้ทดสอบระบบเข้าสู่ระบบ
 * หน้าตาจริงตาม wireframe "หน้าแรกหลังเข้าสู่ระบบ (ชั่วคราว)" + แถบเมนูทำในขั้น 1.6
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui'

export default function HomePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-canvas p-10">
      <h1 className="m-0 font-display text-[32px] font-semibold">
        {t('home.greeting', { name: user.first_name })}
      </h1>
      <p className="m-0 text-ink-muted">{t(`roles.${user.role}`)}</p>
      <div className="flex gap-3">
        <Link to="/profile" className="font-semibold text-brand">
          {t('nav.profile')}
        </Link>
        <Button variant="text" onClick={() => void logout()}>
          {t('nav.logout')}
        </Button>
      </div>
    </main>
  )
}
