/**
 * test ของหน้าทดสอบชั่วคราว (App) — จำลองคำตอบของ backend แล้วตรวจว่าหน้าจอแสดงผลถูกต้อง
 * ไม่เรียก backend จริง: แทนที่ fetch ด้วยตัวปลอมในแต่ละข้อ
 */
import { render, screen, waitFor } from '@testing-library/react'
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
  it('ระหว่างรอผล แสดงวงกลมสถานะแบบกำลังโหลด', () => {
    // fetch ที่ไม่ตอบกลับเลย → หน้าจอค้างอยู่ที่สถานะกำลังโหลด
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))

    render(<App />)

    const dot = screen.getByRole('status')
    expect(dot).toHaveAttribute('data-state', 'loading')
    expect(dot).toHaveAttribute('aria-busy', 'true')
  })

  it('backend ปกติ → วงกลมสีเขียว และแสดง JSON ที่ได้รับ', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'ok', database: 'ok' }, 200),
    )

    render(<App />)

    const dot = await screen.findByRole('status', { name: 'ok' })
    expect(dot).toHaveAttribute('data-state', 'ok')
    expect(screen.getByText('{"status":"ok","database":"ok"}')).toBeInTheDocument()
    // ตรวจว่าเรียก endpoint ถูกที่
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/health/')
  })

  it('backend ต่อฐานข้อมูลไม่ได้ (503) → วงกลมสีแดง และแสดง JSON ที่ได้รับ', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'error', database: 'unavailable' }, 503),
    )

    render(<App />)

    const dot = await screen.findByRole('status', { name: 'error' })
    expect(dot).toHaveAttribute('data-state', 'error')
    expect(screen.getByText('{"status":"error","database":"unavailable"}')).toBeInTheDocument()
  })

  it('ติดต่อ backend ไม่ได้เลย → วงกลมสีแดง และไม่แสดง JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveAttribute('data-state', 'error')
    })
    expect(screen.queryByText(/status/)).not.toBeInTheDocument()
  })
})
