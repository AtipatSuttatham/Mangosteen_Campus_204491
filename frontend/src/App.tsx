/**
 * หน้าทดสอบชั่วคราว (ขั้น 0.2) — พิสูจน์ว่า frontend เรียก backend ได้
 * จะถูกแทนที่ด้วยหน้าจอจริงของระบบในก้อน 1
 *
 * ตั้งใจ "ไม่มีข้อความ UI" เลย เพราะระบบแปลภาษายังไม่มา (ขั้น 0.4)
 * และกฎของโปรเจกต์ห้าม hard-code ข้อความลง component — จึงแสดงแค่:
 *   - วงกลมสถานะ: เขียว = ระบบปกติ, แดง = มีปัญหา, เทา = กำลังตรวจ
 *   - ข้อมูล JSON ดิบที่ backend ส่งกลับมา
 */
import { useEffect, useState } from 'react'
import { fetchHealth, type HealthResult } from './api/health'

/** สถานะของหน้าจอ: ยังรอผล หรือได้ผลแล้ว */
type ViewState = { kind: 'loading' } | ({ kind: 'done' } & HealthResult)

/** ดึงค่า status จาก JSON ของ backend (เช่น "ok" / "error") ใช้เป็นคำอธิบายของวงกลมสถานะ */
function statusOf(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'status' in body) {
    const value = (body as { status: unknown }).status
    return typeof value === 'string' ? value : null
  }
  return null
}

function App() {
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

  // สีของวงกลมสถานะ: เทา = รอผล, เขียว = ปกติ, แดง = มีปัญหา
  const dotColor =
    state.kind === 'loading' ? 'bg-gray-300' : state.ok ? 'bg-green-600' : 'bg-red-600'
  // ค่าสถานะสำหรับ test และโปรแกรมอ่านหน้าจอ: ใช้ค่า status จาก backend ตรง ๆ (ไม่ใช่ข้อความที่เขียนเอง)
  const dataState = state.kind === 'loading' ? 'loading' : state.ok ? 'ok' : 'error'
  const statusLabel = state.kind === 'done' ? (statusOf(state.body) ?? dataState) : undefined

  return (
    <main className="grid min-h-screen place-items-center bg-white p-6">
      <div className="flex flex-col items-center gap-4">
        {/* วงกลมสถานะ */}
        <div
          role="status"
          aria-busy={state.kind === 'loading'}
          aria-label={statusLabel}
          data-state={dataState}
          className={`h-6 w-6 rounded-full ${dotColor}`}
        />
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
