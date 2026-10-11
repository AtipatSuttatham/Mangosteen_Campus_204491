/**
 * test ของที่เก็บบัตรและตัวแลกบัตร (auth/session.ts) + การแนบบัตร/แลกบัตรอัตโนมัติใน apiFetch
 * ไม่เรียก backend จริง: แทนที่ fetch ด้วยตัวปลอมที่ตอบตามที่อยู่
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch } from '../api/client'
import {
  REFRESH_LOCK_NAME,
  getAccessToken,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from './session'

/** ผู้ใช้ตัวอย่าง (ข้อมูลสมมติ) */
const USER = {
  id: 3,
  email: 'student@example.com',
  student_or_staff_id: '690000001',
  role: 'student',
  first_name: 'สมใจ',
  last_name: 'รักเรียน',
  avatar_url: null,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const EXPIRED = () => json({ code: 'authentication_failed', detail: 'x' }, 401)

/** ที่อยู่ของคำขอ (fetch ถูกเรียกด้วย string เสมอใน apiFetch/session) */
function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input.toString()
}

/** header Authorization ที่แนบมากับคำขอ */
function authHeaderOf(init?: RequestInit): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

afterEach(() => {
  setAccessToken(null)
  vi.unstubAllGlobals()
})

describe('refreshSession', () => {
  it('แลกสำเร็จ → เก็บ access token ใหม่ และคืนข้อมูลผู้ใช้', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ access: 'new-token', user: USER }))

    const result = await refreshSession()

    expect(result?.user.email).toBe('student@example.com')
    expect(getAccessToken()).toBe('new-token')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/refresh/',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('เรียกพร้อมกันหลายครั้ง → ส่งคำขอแลกบัตรครั้งเดียว (บัตรใช้ได้ครั้งเดียว)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ access: 'new-token', user: USER }))

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r?.access === 'new-token')).toBe(true)
  })

  it('แลกไม่ได้ (401) → คืน null และล้าง access token เดิม', async () => {
    setAccessToken('old-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(EXPIRED())

    expect(await refreshSession()).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('ติดต่อ backend ไม่ได้ → โยน network_error และไม่ล้างการเข้าสู่ระบบ', async () => {
    setAccessToken('old-token')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(refreshSession()).rejects.toMatchObject({ code: 'network_error' })
    expect(getAccessToken()).toBe('old-token')
  })

  it('เบราว์เซอร์มีกุญแจล็อกข้ามแท็บ → แลกบัตรภายใต้กุญแจชื่อเดียวกันทุกแท็บ', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<unknown>) => fn())
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ access: 'new-token', user: USER }))

    await refreshSession()

    expect(request).toHaveBeenCalledWith(REFRESH_LOCK_NAME, expect.any(Function))
  })
})

describe('apiFetch + บัตรผ่าน', () => {
  it('เข้าสู่ระบบอยู่ → แนบ access token ใน header Authorization', async () => {
    setAccessToken('my-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(USER))

    await apiFetch('/auth/me/')

    expect(authHeaderOf(fetchMock.mock.calls[0]?.[1])).toBe('Bearer my-token')
  })

  it('auth: false → ไม่แนบ access token', async () => {
    setAccessToken('my-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({}))

    await apiFetch('/auth/login/', { method: 'POST', body: {}, auth: false })

    expect(authHeaderOf(fetchMock.mock.calls[0]?.[1])).toBeUndefined()
  })

  it('ได้ 401 → แลกบัตรใหม่ แล้วลองคำขอเดิมซ้ำด้วยบัตรใหม่', async () => {
    setAccessToken('expired-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (urlOf(input).endsWith('/auth/refresh/')) return json({ access: 'fresh', user: USER })
      return authHeaderOf(init) === 'Bearer fresh' ? json({ ok: true }) : EXPIRED()
    })

    const data = await apiFetch<{ ok: boolean }>('/courses/')

    expect(data).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3) // คำขอเดิม → แลกบัตร → คำขอเดิมอีกครั้ง
  })

  it('ได้ 401 และแลกบัตรไม่ได้ → แจ้ง "ถูกให้ออกจากระบบ" แล้วโยน error เดิม', async () => {
    setAccessToken('expired-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => EXPIRED())
    const listener = vi.fn()
    const unsubscribe = onSessionExpired(listener)

    await expect(apiFetch('/courses/')).rejects.toBeInstanceOf(ApiError)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
    unsubscribe()
  })

  it('auth: false ได้ 401 → ไม่พยายามแลกบัตร', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(EXPIRED())

    await expect(apiFetch('/x/', { auth: false })).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('หลายคำขอได้ 401 พร้อมกัน → แลกบัตรครั้งเดียว แล้วทุกคำขอสำเร็จ', async () => {
    setAccessToken('expired-token')
    let refreshCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (urlOf(input).endsWith('/auth/refresh/')) {
        refreshCalls += 1
        return json({ access: 'fresh', user: USER })
      }
      return authHeaderOf(init) === 'Bearer fresh' ? json({ ok: true }) : EXPIRED()
    })

    await Promise.all([apiFetch('/a/'), apiFetch('/b/'), apiFetch('/c/')])

    expect(refreshCalls).toBe(1)
  })
})
