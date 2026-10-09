/**
 * หน้าทดสอบชั่วคราว (ขั้น 0.2–0.4) — พิสูจน์ว่า frontend เรียก backend ได้
 * จะถูกแทนที่ด้วยหน้าจอจริงของระบบในก้อน 1
 *
 * แสดง:
 *   - วงกลมสถานะ: เขียว = ระบบปกติ, แดง = มีปัญหา, เทา = กำลังตรวจ
 *   - ข้อความสถานะภาษาไทย (ดึงจาก th.ts ผ่าน t(...) — ไม่ hard-code)
 *   - ข้อมูล JSON ดิบที่ backend ส่งกลับมา (สำหรับนักพัฒนา)
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthResult } from './api/health'

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

/** สีของวงกลมตามสถานะ */
const DOT_COLOR: Record<DisplayStatus, string> = {
  checking: 'bg-gray-300',
  ok: 'bg-green-600',
  databaseUnavailable: 'bg-red-600',
  unreachable: 'bg-red-600',
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
    <main className="grid min-h-screen place-items-center bg-white p-6">
      <div className="flex flex-col items-center gap-4">
        {/* ข้อความสถานะ (role="status" = โปรแกรมอ่านหน้าจอจะอ่านให้เมื่อข้อความเปลี่ยน) */}
        <div
          role="status"
          aria-busy={status === 'checking'}
          data-state={status}
          className="flex items-center gap-3 text-lg text-gray-800"
        >
          {/* วงกลมสถานะ (ตกแต่งอย่างเดียว ข้อความด้านข้างบอกความหมายแล้ว) */}
          <span aria-hidden="true" className={`h-4 w-4 rounded-full ${DOT_COLOR[status]}`} />
          {t(`health.${status}`)}
        </div>
        {/* ข้อมูล JSON ดิบจาก backend (แสดงเมื่อมีข้อมูลเท่านั้น) */}
        {state.kind === 'done' && state.body !== null && (
          <pre className="rounded-lg bg-gray-100 px-4 py-2 font-mono text-sm text-gray-800">
            {JSON.stringify(state.body)}
          </pre>
        )}
      </div>
    </main>
  )
}

export default App
