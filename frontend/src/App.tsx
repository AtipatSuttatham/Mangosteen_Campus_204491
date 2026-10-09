/**
 * หน้าทดสอบชั่วคราว (ขั้น 0.2–0.6) — พิสูจน์ว่า frontend เรียก backend ได้
 * จะถูกแทนที่ด้วยหน้าจอจริงของระบบในก้อน 1
 *
 * แสดง (ใช้คอมโพเนนต์และสีของธีมจริง):
 *   - ตราสัญลักษณ์ + ชื่อระบบ
 *   - ป้ายสถานะ: เขียว = ระบบปกติ, แดง = มีปัญหา, เทา = กำลังตรวจ (ข้อความจาก th.ts)
 *   - ข้อมูล JSON ดิบที่ backend ส่งกลับมา (สำหรับนักพัฒนา)
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthResult } from './api/health'
import { Card, Logo, StatusBadge, type StatusTone } from './components/ui'

/** สถานะของหน้าจอ: ยังรอผล หรือได้ผลแล้ว */
type ViewState = { kind: 'loading' } | ({ kind: 'done' } & HealthResult)

/** สถานะที่หน้าจอแสดง (ใช้เลือกสีและข้อความ) */
type DisplayStatus = 'checking' | 'ok' | 'databaseUnavailable' | 'unreachable'

/** แปลงผลจาก backend เป็นสถานะที่หน้าจอแสดง */
function toDisplayStatus(state: ViewState): DisplayStatus {
  if (state.kind === 'loading') return 'checking'
  if (state.ok) return 'ok'
  // backend ตอบกลับมาว่าฐานข้อมูลใช้งานไม่ได้ (HTTP 503 + database: "unavailable")
  if (
    typeof state.body === 'object' &&
    state.body !== null &&
    'database' in state.body &&
    (state.body as { database: unknown }).database === 'unavailable'
  ) {
    return 'databaseUnavailable'
  }
  // กรณีอื่น: ติดต่อ backend ไม่ได้ หรือได้คำตอบที่ไม่ใช่ของ backend
  return 'unreachable'
}

/** สีของป้ายสถานะตามสถานะ */
const STATUS_TONE: Record<DisplayStatus, StatusTone> = {
  checking: 'mute',
  ok: 'ok',
  databaseUnavailable: 'bad',
  unreachable: 'bad',
}

function App() {
  const { t } = useTranslation()
  const [state, setState] = useState<ViewState>({ kind: 'loading' })

  // เรียก backend ครั้งเดียวตอนเปิดหน้า แล้วเก็บผลไว้แสดง
  useEffect(() => {
    // กันการอัปเดตหน้าจอหลังหน้าถูกปิดไปแล้ว
    let active = true
    fetchHealth().then((result) => {
      if (active) setState({ kind: 'done', ...result })
    })
    return () => {
      active = false
    }
  }, [])

  const status = toDisplayStatus(state)

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="flex w-full max-w-[440px] flex-col items-center gap-5 px-9 py-8">
        <Logo withWordmark />
        {/* ข้อความสถานะ (role="status" = โปรแกรมอ่านหน้าจอจะอ่านให้เมื่อข้อความเปลี่ยน) */}
        <div role="status" aria-busy={status === 'checking'} data-state={status}>
          <StatusBadge tone={STATUS_TONE[status]}>{t(`health.${status}`)}</StatusBadge>
        </div>
        {/* ข้อมูล JSON ดิบจาก backend (แสดงเมื่อมีข้อมูลเท่านั้น) */}
        {state.kind === 'done' && state.body !== null && (
          <pre className="m-0 max-w-full overflow-x-auto rounded-control bg-track px-4 py-2 text-sm text-ink-muted">
            {JSON.stringify(state.body)}
          </pre>
        )}
      </Card>
    </main>
  )
}

export default App
