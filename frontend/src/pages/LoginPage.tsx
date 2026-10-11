/**
 * หน้าเข้าสู่ระบบ /login (UC-01) — หน้าตาตาม design canvas:
 *   - จอใหญ่ (≥ 1024px): board "ภาพที่ 5.1 เข้าสู่ระบบ" + "เข้าสู่ระบบ (กรอกผิด)"
 *       ซ้าย = แผงสีม่วงกว้าง 540px (ตรา, ข้อความ, ลายกลีบเลี้ยง) ; ขวา = การ์ดฟอร์ม 440px + ภาพผ่ามังคุดจาง ๆ
 *   - มือถือ / จอเล็ก: board "ก้อน 1: เข้าสู่ระบบ (มือถือ)" (ผู้ใช้อนุมัติ 2026-10-11)
 *       แถบสีม่วงด้านบน (ลายกลีบเลี้ยงมุมขวาบน) ยาวลงมาถึงกลางการ์ดฟอร์ม ; ลายจางมุมขวาล่าง
 *
 *   ┌──────────────┬──────────────────────┐        ┌────────────────┐
 *   │ ตรา           │                      │        │▓ ตรา        ◌ ▓│
 *   │              │   ┌──────────────┐   │        │▓ ห้องเรียน...    ▓│
 *   │ ห้องเรียน...   │   │ เข้าสู่ระบบ     │ ◐ │        │▓┌────────────┐▓│
 *   │              │   │ [รหัส/อีเมล]  │   │        │ │ เข้าสู่ระบบ   │ │
 *   │ มช. 2569     │   │ [รหัสผ่าน][แสดง]│   │        │ │ ...        │ │
 *   └──────────────┴───┴──────────────┴───┘        └─┴────────────┴─┘
 *
 * การทำงาน (React Hook Form):
 *   - ไม่กรอกช่องใด → ข้อความใต้ช่องนั้น "กรุณากรอกข้อมูลช่องนี้" (ไม่ส่งไป backend)
 *   - backend ปฏิเสธ (รหัสผิด / ถูกระงับ / ติดต่อไม่ได้) → ขอบแดง 2 ช่อง + ข้อความเดียวใต้ช่องรหัสผ่าน
 *     (ตาม board กรอกผิด: ไม่บอกว่าผิดช่องไหน) ; พิมพ์แก้ช่องใดก็ได้ → ข้อความหายไป
 *   - ระหว่างส่ง → ปุ่มกดไม่ได้ + "กำลังเข้าสู่ระบบ…" (กันกดซ้ำ)
 *   - สำเร็จ → RedirectIfAuthed (auth/guards.tsx) พาไปหน้าที่ตั้งใจจะไปเอง
 *   - ถูกให้ออกจากระบบกลางคัน → แถบ "หมดเวลาการใช้งาน" บนการ์ด (การตัดสินใจขั้น 1.4)
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { errorMessage, fieldErrorMessage } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { CalyxPattern } from '../components/brand/CalyxPattern'
import { MangosteenIllustration } from '../components/brand/MangosteenIllustration'
import { Button, Card, Logo, PasswordField, TextField } from '../components/ui'

/** ข้อมูลในฟอร์ม */
type LoginForm = {
  identifier: string
  password: string
}

/** id ของช่องรหัสผ่าน — ข้อความ error จาก backend อยู่ใต้ช่องนี้ (ช่องรหัสอ้างถึงด้วย) */
const PASSWORD_ID = 'login-password'
const SERVER_ERROR_ID = `${PASSWORD_ID}-error`

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, sessionExpired } = useAuth()
  // ข้อความ error จาก backend (รหัสผิด / ถูกระงับ / ติดต่อไม่ได้) — ไม่มี = ยังไม่มีปัญหา
  const [serverError, setServerError] = useState<string>()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { identifier: '', password: '' } })

  /** ส่งฟอร์ม (เรียกเมื่อกรอกครบทั้ง 2 ช่องแล้วเท่านั้น) */
  async function onSubmit({ identifier, password }: LoginForm) {
    setServerError(undefined)
    try {
      await login(identifier.trim(), password)
    } catch (caught) {
      // แสดงข้อความจากรหัส error เท่านั้น — ห้ามแสดง detail ของ backend
      setServerError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
    }
  }

  // พิมพ์แก้ช่องใดก็ได้ → ซ่อนข้อความ error จาก backend
  const clearServerError = () => setServerError(undefined)

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas lg:flex">
      {/* มือถือ: ลายกลีบเลี้ยงจางมุมขวาล่างของพื้นหลัง (แบบเดียวกับหน้าอื่นหลัง login) */}
      <CalyxPattern
        size={400}
        strokeWidth={0.8}
        className="pointer-events-none absolute -right-[120px] -bottom-[110px] text-brand opacity-[0.07] lg:hidden"
      />

      {/* แผงสีม่วง: มือถือ = แถบบน (ยาวลงมาให้การ์ดทับครึ่งหนึ่ง) ; จอใหญ่ = แผงซ้าย 540px */}
      <aside className="relative overflow-hidden bg-brand px-6 pt-7 pb-[200px] lg:flex lg:w-[540px] lg:shrink-0 lg:flex-col lg:px-12 lg:py-10">
        {/* ลายกลีบเลี้ยงสีเขียวเส้นบาง: มือถือมุมขวาบน / จอใหญ่มุมขวาล่าง */}
        <CalyxPattern
          size={380}
          strokeWidth={0.35}
          className="pointer-events-none absolute -top-[150px] -right-[150px] text-accent opacity-[0.22] lg:hidden"
        />
        <CalyxPattern
          size={720}
          strokeWidth={0.35}
          className="pointer-events-none absolute -right-[230px] -bottom-[250px] hidden text-accent opacity-[0.22] lg:block"
        />

        {/* ตรา + ชื่อระบบ (มือถือ 34px / จอใหญ่ 36px ตาม canvas) */}
        <Logo size={34} withWordmark tone="onDark" wordmarkSize="sm" className="relative lg:hidden" />
        <Logo
          size={36}
          withWordmark
          tone="onDark"
          wordmarkSize="md"
          className="relative hidden lg:inline-flex"
        />

        {/* ข้อความแนะนำระบบ */}
        <div className="relative mt-10 max-w-[300px] lg:mt-[170px] lg:max-w-[390px]">
          <p className="m-0 font-display text-[27px] leading-[1.4] font-semibold text-white lg:text-[38px]">
            {t('login.headline')}
          </p>
          <p className="m-0 mt-2 text-[15px] leading-[1.7] text-on-brand-muted lg:mt-4 lg:text-[16.5px] lg:leading-[1.75]">
            {t('login.tagline')}
          </p>
        </div>

        {/* จอใหญ่เท่านั้น: ข้อความท้ายแผง (มือถือตัดออกตามที่ผู้ใช้เลือก) */}
        <p className="relative m-0 mt-auto hidden text-sm text-on-brand-muted lg:block">
          {t('login.footer')}
        </p>
      </aside>

      {/* พื้นที่ฟอร์ม */}
      <main className="relative pb-10 lg:flex lg:flex-1 lg:items-center lg:py-10 lg:pr-14 lg:pl-[88px]">
        {/* จอใหญ่: ภาพผ่ามังคุดจาง ๆ ด้านหลังการ์ด */}
        <MangosteenIllustration
          size={600}
          className="pointer-events-none absolute top-[130px] left-[320px] hidden opacity-50 lg:block"
        />

        <Card className="relative mx-4 -mt-[170px] px-5 py-6 lg:m-0 lg:w-[440px] lg:px-9 lg:pt-9 lg:pb-8">
          <form
            noValidate
            aria-labelledby="login-title"
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-[18px] lg:gap-5"
          >
            <div>
              <h1
                id="login-title"
                className="m-0 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]"
              >
                {t('login.title')}
              </h1>
              {/* คำอธิบายใต้หัวข้อ: จอใหญ่เท่านั้น (board มือถือตัดออก เพราะป้ายของช่องบอกอยู่แล้ว) */}
              <p className="m-0 mt-0.5 hidden text-[15px] text-ink-muted lg:block">
                {t('login.subtitle')}
              </p>
            </div>

            {/* ถูกให้ออกจากระบบกลางคัน */}
            {sessionExpired && (
              <p
                role="status"
                className="m-0 rounded-control bg-warn-soft px-3.5 py-2.5 text-[14.5px] leading-[1.55] text-warn"
              >
                {t('auth.sessionExpired')}
              </p>
            )}

            <TextField
              label={t('login.identifier')}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              error={fieldErrorMessage(errors.identifier ? 'required' : undefined)}
              invalid={Boolean(serverError)}
              errorDescribedBy={serverError ? SERVER_ERROR_ID : undefined}
              {...register('identifier', { required: true, onChange: clearServerError })}
            />
            <PasswordField
              id={PASSWORD_ID}
              label={t('login.password')}
              autoComplete="current-password"
              error={serverError ?? fieldErrorMessage(errors.password ? 'required' : undefined)}
              {...register('password', { required: true, onChange: clearServerError })}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  )
}
