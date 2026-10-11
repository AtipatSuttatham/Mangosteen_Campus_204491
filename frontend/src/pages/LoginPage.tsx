/**
 * หน้าเข้าสู่ระบบ /login — แบบชั่วคราว (ขั้น 1.4) ไว้ทดสอบระบบเข้าสู่ระบบ
 * หน้าตาจริงตาม wireframe (ภาพ 5.1 + มือถือ) ทำในขั้น 1.5
 *
 * - กรอกอีเมลหรือรหัส + รหัสผ่าน → login() ; สำเร็จแล้ว RedirectIfAuthed พาไปหน้าที่ตั้งใจจะไปเอง
 * - ไม่สำเร็จ → แสดงข้อความจากรหัส error (ห้ามแสดง detail ของ backend)
 * - ถูกให้ออกจากระบบกลางคัน → แสดง "หมดเวลาการใช้งาน" ด้านบน
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { errorMessage } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, StatusBadge, TextField } from '../components/ui'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, sessionExpired } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  /** กดปุ่มเข้าสู่ระบบ */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)
    try {
      await login(identifier, password)
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card className="flex w-full max-w-[440px] flex-col gap-5 px-9 py-8">
        <h1 className="m-0 font-display text-[32px] font-semibold">{t('login.title')}</h1>
        {sessionExpired && <StatusBadge tone="warn">{t('auth.sessionExpired')}</StatusBadge>}
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <TextField
            label={t('login.identifier')}
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <TextField
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
      </Card>
    </main>
  )
}
