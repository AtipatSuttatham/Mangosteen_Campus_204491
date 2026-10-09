/**
 * test ของหน้าทดสอบชั่วคราว (App) — จำลองคำตอบของ backend แล้วตรวจว่าหน้าจอแสดงผลถูกต้อง
 * ไม่เรียก backend จริง: แทนที่ fetch ด้วยตัวปลอมในแต่ละข้อ
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

/** สร้างคำตอบ HTTP ปลอมที่มี JSON และรหัสสถานะตามที่กำหนด */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('App (หน้าทดสอบสุขภาพระบบ)', () => {
  it('ระหว่างรอผล แสดงข้อความ "กำลังตรวจสอบระบบ…"', () => {
    // fetch ที่ไม่ตอบกลับเลย → หน้าจอค้างอยู่ที่สถานะกำลังตรวจ
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))

    render(<App />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('กำลังตรวจสอบระบบ…')
    expect(status).toHaveAttribute('data-state', 'checking')
    expect(status).toHaveAttribute('aria-busy', 'true')
  })

  it('backend ปกติ → "ระบบพร้อมใช้งาน" และแสดง JSON ที่ได้รับ', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'ok', database: 'ok' }, 200),
    )

    render(<App />)

    expect(await screen.findByText('ระบบพร้อมใช้งาน')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'ok')
    expect(screen.getByText('{"status":"ok","database":"ok"}')).toBeInTheDocument()
    // ตรวจว่าเรียก endpoint ถูกที่
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/health/')
  })

  it('backend ต่อฐานข้อมูลไม่ได้ (503) → แจ้งว่าฐานข้อมูลยังไม่พร้อม', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'error', database: 'unavailable' }, 503),
    )

    render(<App />)

    expect(await screen.findByText('ระบบทำงาน แต่ฐานข้อมูลยังไม่พร้อม')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'databaseUnavailable')
    expect(screen.getByText('{"status":"error","database":"unavailable"}')).toBeInTheDocument()
  })

  it('ติดต่อ backend ไม่ได้เลย → "ติดต่อเซิร์ฟเวอร์ไม่ได้" และไม่แสดง JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'))

    render(<App />)

    expect(await screen.findByText('ติดต่อเซิร์ฟเวอร์ไม่ได้')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'unreachable')
    expect(screen.queryByText(/"status"/)).not.toBeInTheDocument()
  })

  it('ได้คำตอบที่ไม่ใช่ JSON (เช่น proxy ต่อ backend ไม่ได้) → "ติดต่อเซิร์ฟเวอร์ไม่ได้"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad Gateway', { status: 502 }))

    render(<App />)

    expect(await screen.findByText('ติดต่อเซิร์ฟเวอร์ไม่ได้')).toBeInTheDocument()
  })
})
