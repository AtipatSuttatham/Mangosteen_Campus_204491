/**
 * test ของตัวเรียก API กลาง (apiFetch) — จำลองคำตอบของ backend ทุกแบบ
 * ไม่เรียก backend จริง: แทนที่ fetch ด้วยตัวปลอมในแต่ละข้อ
 */
import { describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch } from './client'

/** สร้างคำตอบ HTTP ปลอมที่มี JSON และรหัสสถานะตามที่กำหนด */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** เรียก apiFetch แล้วคืน ApiError ที่ถูกโยนออกมา (ถ้าไม่โยน test จะล้ม) */
async function catchApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected apiFetch to throw ApiError')
}

describe('apiFetch — กรณีสำเร็จ', () => {
  it('ต่อที่อยู่เป็น /api/v1/... และคืนข้อมูล JSON', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse([{ id: 1 }], 200))

    const data = await apiFetch<{ id: number }[]>('/courses/')

    expect(data).toEqual([{ id: 1 }])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/courses/',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('ส่ง body เป็น JSON พร้อม header Content-Type', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ id: 5 }, 201))

    await apiFetch('/courses/', { method: 'POST', body: { name: 'Python พื้นฐาน' } })

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"name":"Python พื้นฐาน"}')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('คำตอบที่ไม่มีเนื้อหา (204) → คืน undefined', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiFetch('/courses/5/', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('apiFetch — กรณี error', () => {
  it('backend ส่ง validation_error → ApiError มีรหัสและรหัสรายช่อง', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { code: 'validation_error', detail: 'Invalid input.', fields: { name: ['required'] } },
        400,
      ),
    )

    const error = await catchApiError(apiFetch('/courses/', { method: 'POST', body: {} }))

    expect(error.status).toBe(400)
    expect(error.code).toBe('validation_error')
    expect(error.fields).toEqual({ name: ['required'] })
    expect(error.detail).toBe('Invalid input.')
  })

  it('backend ส่งรหัสเฉพาะเรื่อง → ApiError ใช้รหัสนั้น (ไม่มี fields)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ code: 'course_code_duplicate', detail: 'dup' }, 409),
    )

    const error = await catchApiError(apiFetch('/courses/'))

    expect(error.status).toBe(409)
    expect(error.code).toBe('course_code_duplicate')
    expect(error.fields).toEqual({})
  })

  it('ติดต่อ backend ไม่ได้เลย → network_error (status 0)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await catchApiError(apiFetch('/courses/'))

    expect(error.status).toBe(0)
    expect(error.code).toBe('network_error')
  })

  it('ได้หน้า HTML แทน JSON (เช่น proxy ตอบ 502) → เดาเป็น server_error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<h1>Bad Gateway</h1>', { status: 502 }),
    )

    const error = await catchApiError(apiFetch('/courses/'))

    expect(error.status).toBe(502)
    expect(error.code).toBe('server_error')
  })

  it('404 ที่ไม่ใช่รูปแบบกลาง → เดาเป็น not_found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }))

    const error = await catchApiError(apiFetch('/missing/'))

    expect(error.code).toBe('not_found')
  })

  it('JSON ที่ไม่มีช่อง code (รูปแบบแปลก) → unknown', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'hmm' }, 418))

    const error = await catchApiError(apiFetch('/teapot/'))

    expect(error.code).toBe('unknown')
  })
})
