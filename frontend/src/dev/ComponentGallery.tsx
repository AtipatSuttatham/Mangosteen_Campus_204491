/**
 * หน้ารวมตัวอย่างคอมโพเนนต์: http://localhost:5180/dev/components
 *
 * ใช้เปิดเทียบหน้าตากับ wireframe ใน design canvas — **มีเฉพาะตอนพัฒนา (pnpm dev)**
 * ไม่ถูกรวมในไฟล์ที่ build ไป deploy (ดูเงื่อนไขใน main.tsx)
 *
 * ตัวอย่างใช้ข้อความและข้อมูลจริงจาก wireframe (หน้าเข้าสู่ระบบ, หน้ารายวิชาของฉัน)
 */
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  Button,
  buttonClassName,
  Card,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Logo,
  Pagination,
  PasswordField,
  SearchInput,
  Select,
  StatusBadge,
  TextField,
} from '../components/ui'

/** สีทั้งหมดของระบบ (ชื่อตรงกับ --color-* ใน index.css) */
const COLOR_TOKENS = [
  'brand',
  'brand-hover',
  'accent',
  'canvas',
  'surface',
  'line',
  'line-strong',
  'line-soft',
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
  'bad-hover',
  'mute',
  'mute-soft',
] as const

/** ผู้ใช้สมมติสำหรับตัวอย่างรูปประจำตัว (ชื่อเดียวกับใน wireframe ; ชื่อที่ขึ้นต้นด้วยสระหน้า) */
const SAMPLE_STUDENT = {
  first_name: 'สมใจ',
  last_name: 'รักเรียน',
  email: 'student@example.com',
  avatar_url: null,
}
const SAMPLE_USERS = [
  SAMPLE_STUDENT,
  { first_name: 'เอกชัย', last_name: 'ใจดี', email: 'teacher@example.com', avatar_url: null },
]

/** แถบเปลี่ยนหน้าตัวอย่างที่กดเปลี่ยนหน้าได้ (จำหน้าปัจจุบันไว้ในหน้านี้เท่านั้น) */
function PaginationSample({ summary }: { summary: string }) {
  const [page, setPage] = useState(1)
  return <Pagination page={page} pageCount={13} onPageChange={setPage} summary={summary} />
}

/** ตัวอย่างหน้าต่างซ้อน: ปุ่มเปิดหน้าต่างแบบฟอร์ม (มือถือเต็มจอ) และหน้าต่างยืนยัน — กดเปิด/ปิดได้จริง */
function DialogSamples() {
  const { t } = useTranslation()
  const titleId = useId()
  const [open, setOpen] = useState<'dialog' | 'confirm' | null>(null)
  const close = () => setOpen(null)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={() => setOpen('dialog')}>
        {t('devGallery.openDialog')}
      </Button>
      <Button variant="secondary" onClick={() => setOpen('confirm')}>
        {t('devGallery.openConfirm')}
      </Button>
      {open === 'dialog' && (
        <Dialog labelledBy={titleId} onClose={close} size="sm">
          <DialogHeader
            titleId={titleId}
            title={t('devGallery.sampleDialogTitle')}
            subtitle={t('devGallery.sampleDialogSubtitle')}
            eyebrow={t('devGallery.sampleDialogEyebrow')}
            onClose={close}
          />
          <DialogBody>
            <PasswordField
              label={t('devGallery.sampleNewPasswordLabel')}
              hint={t('devGallery.sampleNewPasswordHint')}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={close}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={close}>{t('devGallery.sampleDialogSave')}</Button>
          </DialogFooter>
        </Dialog>
      )}
      {open === 'confirm' && (
        <ConfirmDialog
          title={t('devGallery.sampleConfirmTitle')}
          description={[t('devGallery.sampleConfirmLine1'), t('devGallery.sampleConfirmLine2')]}
          confirmLabel={t('devGallery.sampleConfirmAction')}
          onConfirm={close}
          onCancel={close}
        />
      )}
    </div>
  )
}

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
          {/* ปุ่มแดงทึบ (ขั้น 2.6) — ปุ่มยืนยันในหน้าต่างยืนยัน */}
          <Button variant="danger">{t('devGallery.sampleDanger')}</Button>
          <Button disabled>{t('devGallery.disabled')}</Button>
          <Button variant="secondary" disabled>
            {t('devGallery.disabled')}
          </Button>
        </div>
      </Section>

      {/* ช่องกรอก: แบบเดียวกับหน้า "เข้าสู่ระบบ (กรอกผิด)" — ช่องแรกขอบแดงอย่างเดียว (invalid),
          ช่องรหัสผ่าน (PasswordField มีปุ่มแสดง/ซ่อน) มีข้อความ error ; ด้านล่างเป็นช่องปกติ */}
      <Section title={t('devGallery.fields')}>
        <Card className="flex max-w-[440px] flex-col gap-5 p-9">
          <TextField label={t('devGallery.sampleIdLabel')} defaultValue="690000001" invalid />
          <PasswordField
            label={t('devGallery.samplePasswordLabel')}
            defaultValue="password12"
            error={t('devGallery.sampleLoginError')}
          />
          <PasswordField label={t('devGallery.samplePasswordLabel')} />
          {/* ช่องที่มีคำแนะนำใต้ช่อง (hint — หน้าข้อมูลส่วนตัว) */}
          <PasswordField
            label={t('devGallery.sampleNewPasswordLabel')}
            hint={t('devGallery.sampleNewPasswordHint')}
          />
          <Button className="w-full">{t('devGallery.sampleLogin')}</Button>
        </Card>
      </Section>

      {/* ช่องค้นหา + ช่องเลือก: แถบตัวกรองของหน้า "รายชื่อผู้ใช้" (ขั้น 2.5) — ป้ายชื่อผูกด้วย <label> */}
      <Section title={t('devGallery.filters')}>
        <Card className="flex flex-wrap items-center gap-3 px-6 py-4">
          <label htmlFor="gallery-search" className="sr-only">
            {t('devGallery.sampleSearchLabel')}
          </label>
          <SearchInput
            id="gallery-search"
            placeholder={t('devGallery.sampleSearchPlaceholder')}
            className="w-[300px] lg:h-[42px]"
          />
          <label htmlFor="gallery-role" className="text-sm text-ink-muted">
            {t('devGallery.sampleRoleLabel')}
          </label>
          <Select id="gallery-role" className="lg:h-[42px]">
            <option>{t('devGallery.sampleRoleAll')}</option>
            <option>{t('roles.admin')}</option>
            <option>{t('roles.teacher')}</option>
            <option>{t('roles.student')}</option>
          </Select>
        </Card>
      </Section>

      {/* แถบเปลี่ยนหน้า: กดได้จริง (ตัวอย่าง 13 หน้า) — มือถือไม่มีข้อความสรุปด้านซ้าย */}
      <Section title={t('devGallery.pagination')}>
        <Card className="px-4 py-3 lg:pl-6">
          <PaginationSample summary={t('devGallery.samplePaginationSummary')} />
        </Card>
      </Section>

      {/* หน้าต่างซ้อน (ขั้น 2.6): กดเปิดดูได้ — ย่อหน้าต่างเบราว์เซอร์ให้แคบกว่า 1024px เพื่อดูแบบเต็มจอของมือถือ */}
      <Section title={t('devGallery.dialogs')}>
        <DialogSamples />
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
          {/* ขนาดเล็ก (size="sm") — ป้าย "คุณ" ต่อท้ายชื่อในหน้ารายชื่อผู้ใช้ */}
          <StatusBadge tone="mute" size="sm">
            {t('adminUsers.self')}
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

      {/* ลิงก์ที่หน้าตาเหมือนปุ่ม (buttonClassName) — เช่น "ดูข้อมูลส่วนตัว" บนหน้าแรก */}
      <Section title={t('devGallery.buttonLinks')}>
        <div>
          <a href="#button-link" className={buttonClassName('secondary')}>
            {t('devGallery.sampleViewProfile')}
          </a>
        </div>
      </Section>

      {/* รูปประจำตัว: ยังไม่มีรูป → ตัวอักษรย่อ (ขนาด sidebar 38px และแถบบนมือถือ 36px) */}
      <Section title={t('devGallery.avatars')}>
        <div className="flex w-fit items-center gap-4 rounded-card bg-brand px-5 py-4">
          {SAMPLE_USERS.map((user) => (
            <Avatar key={user.email} user={user} size={38} />
          ))}
          <Avatar user={SAMPLE_STUDENT} size={36} />
        </div>
        {/* แบบวงแหวนบนแถบบัตรประจำตัว (หน้าข้อมูลส่วนตัว): จอใหญ่ 128px / มือถือ 88px */}
        <div className="flex w-fit items-end gap-6 rounded-card bg-brand px-6 py-5">
          <Avatar user={SAMPLE_STUDENT} size={128} variant="ring" />
          <Avatar user={SAMPLE_STUDENT} size={88} variant="ring" />
        </div>
      </Section>
    </main>
  )
}
