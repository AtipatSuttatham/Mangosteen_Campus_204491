/**
 * หน้ารวมตัวอย่างคอมโพเนนต์: http://localhost:5180/dev/components
 *
 * ใช้เปิดเทียบหน้าตากับ wireframe ใน design canvas — **มีเฉพาะตอนพัฒนา (pnpm dev)**
 * ไม่ถูกรวมในไฟล์ที่ build ไป deploy (ดูเงื่อนไขใน main.tsx)
 *
 * ตัวอย่างใช้ข้อความและข้อมูลจริงจาก wireframe (หน้าเข้าสู่ระบบ, หน้ารายวิชาของฉัน)
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Logo, StatusBadge, TextField } from '../components/ui'

/** สีทั้งหมดของระบบ (ชื่อตรงกับ --color-* ใน index.css) */
const COLOR_TOKENS = [
  'brand',
  'brand-hover',
  'accent',
  'canvas',
  'surface',
  'line',
  'line-strong',
  'track',
  'ink',
  'ink-muted',
  'on-brand-muted',
  'danger',
  'warn',
  'warn-soft',
  'ok',
  'ok-soft',
  'bad',
  'bad-soft',
  'mute',
  'mute-soft',
] as const

/** หัวข้อของแต่ละกลุ่มตัวอย่าง (ขนาด/น้ำหนักเดียวกับหัวข้อรองใน canvas) */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

/** ไอคอน "ซ่อน" ของป้ายยังไม่เผยแพร่ (คัดลอกจาก canvas หน้ารายวิชาของฉัน) */
function EyeOffIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1" />
    </svg>
  )
}

/** หน้ารวมตัวอย่างคอมโพเนนต์ */
export default function ComponentGallery() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-9 px-4 py-10 sm:px-[52px]">
      <header>
        <h1 className="m-0 font-display text-[32px] font-semibold">{t('devGallery.title')}</h1>
        <p className="mt-1 mb-0 text-[15px] text-ink-muted">{t('devGallery.description')}</p>
      </header>

      {/* สีของระบบ: กล่องสี + ชื่อที่ใช้ใน class ของ Tailwind (เช่น bg-brand) */}
      <Section title={t('devGallery.colors')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {COLOR_TOKENS.map((token) => (
            <div key={token} className="flex items-center gap-3">
              <span
                className="h-10 w-10 shrink-0 rounded-control border border-line"
                style={{ backgroundColor: `var(--color-${token})` }}
              />
              <code className="text-sm text-ink-muted">{token}</code>
            </div>
          ))}
        </div>
      </Section>

      {/* ปุ่ม 4 แบบ + แบบกดไม่ได้ */}
      <Section title={t('devGallery.buttons')}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t('devGallery.sampleLogin')}</Button>
          <Button variant="secondary">{t('devGallery.sampleCancel')}</Button>
          <Button variant="text">{t('devGallery.sampleEdit')}</Button>
          <Button variant="danger-text">{t('devGallery.sampleSuspend')}</Button>
          <Button disabled>{t('devGallery.disabled')}</Button>
          <Button variant="secondary" disabled>
            {t('devGallery.disabled')}
          </Button>
        </div>
      </Section>

      {/* ช่องกรอก: ปกติ และมี error (ข้อความเดียวกับหน้า "เข้าสู่ระบบ กรอกผิด") */}
      <Section title={t('devGallery.fields')}>
        <Card className="flex max-w-[440px] flex-col gap-5 p-9">
          <TextField label={t('devGallery.sampleIdLabel')} defaultValue="660510730" />
          <TextField
            label={t('devGallery.samplePasswordLabel')}
            type="password"
            defaultValue="password12"
            error={t('devGallery.sampleLoginError')}
          />
          <Button className="w-full">{t('devGallery.sampleLogin')}</Button>
        </Card>
      </Section>

      {/* การ์ด: แถวรายวิชาเหมือนหน้า "รายวิชาของฉัน" */}
      <Section title={t('devGallery.cards')}>
        <Card as="article" className="flex items-center gap-5 px-6 py-5">
          <div className="grow">
            <div className="text-sm font-semibold tracking-[0.5px] text-brand">
              {t('devGallery.sampleCardCode')}
            </div>
            <div className="font-display text-[21px] leading-[1.35] font-semibold text-ink">
              {t('devGallery.sampleCardTitle')}
            </div>
            {/* ข้อมูลประกอบวางเรียงกันโดยเว้นระยะ (ตาม .stats ใน canvas — ไม่คั่นด้วยจุด) */}
            <div className="mt-0.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
              <span>{t('devGallery.sampleCardStudents', { count: 42 })}</span>
              <span>{t('devGallery.sampleCardModules', { count: 7 })}</span>
              <span>{t('devGallery.sampleCardJoinCode', { code: 'K7Q2XM9A' })}</span>
            </div>
          </div>
          <Button variant="secondary">{t('devGallery.sampleManageCourse')}</Button>
        </Card>
      </Section>

      {/* ป้ายสถานะ 4 สี */}
      <Section title={t('devGallery.badges')}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone="warn">{t('devGallery.sampleDueSoon')}</StatusBadge>
          <StatusBadge tone="ok">{t('devGallery.sampleSubmitted')}</StatusBadge>
          <StatusBadge tone="bad">{t('devGallery.sampleNotSubmitted')}</StatusBadge>
          <StatusBadge tone="mute" icon={<EyeOffIcon />}>
            {t('devGallery.sampleUnpublished')}
          </StatusBadge>
        </div>
      </Section>

      {/* ตราสัญลักษณ์: บนพื้นม่วง (แบบ sidebar) และบนพื้นสว่าง */}
      <Section title={t('devGallery.logo')}>
        <div className="flex flex-wrap items-stretch gap-4">
          <figure className="m-0 flex flex-col gap-2">
            <div className="rounded-card bg-brand px-5 py-7">
              <Logo size={34} withWordmark tone="onDark" wordmarkSize="sm" />
            </div>
            <figcaption className="text-sm text-ink-muted">{t('devGallery.logoOnDark')}</figcaption>
          </figure>
          <figure className="m-0 flex flex-col gap-2">
            <Card className="px-5 py-6">
              <Logo size={48} withWordmark />
            </Card>
            <figcaption className="text-sm text-ink-muted">{t('devGallery.logoOnLight')}</figcaption>
          </figure>
        </div>
      </Section>
    </main>
  )
}
