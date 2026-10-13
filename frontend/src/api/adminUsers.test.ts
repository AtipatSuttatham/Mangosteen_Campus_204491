/**
 * test ของการแปลงตัวกรองหน้ารายชื่อผู้ใช้เป็น query string ของ backend (docs/api.md §7.1)
 * และฟังก์ชันเพิ่ม / แก้ไข / ระงับ / เปิดใช้งาน / รีเซ็ตรหัส (ขั้น 2.6 — ตรวจ method + ที่อยู่ + ข้อมูลที่ส่ง)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  activateAdminUser,
  adminUsersQuery,
  createAdminUser,
  resetAdminUserPassword,
  suspendAdminUser,
  updateAdminUser,
} from './adminUsers'

describe('adminUsersQuery', () => {
  it('ไม่มีตัวกรอง → ไม่มี query string', () => {
    expect(adminUsersQuery({})).toBe('')
  })

  it('หน้า 1 / คำค้นที่มีแต่ช่องว่าง → ไม่ส่ง', () => {
    expect(adminUsersQuery({ page: 1, search: '   ' })).toBe('')
  })

  it('ส่งครบทุกตัวกรอง (ตัดช่องว่างหัวท้ายของคำค้น)', () => {
    const query = adminUsersQuery({ search: ' สมชาย ', role: 'student', status: 'active', page: 3 })
    expect(new URLSearchParams(query)).toEqual(
      new URLSearchParams({ search: 'สมชาย', role: 'student', is_active: 'true', page: '3' }),
    )
  })

  it('สถานะ "ระงับ" → is_active=false', () => {
    expect(adminUsersQuery({ status: 'suspended' })).toBe('?is_active=false')
  })
})

describe('ฟังก์ชันจัดการบัญชี (ขั้น 2.6)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** แทน fetch ด้วยตัวปลอมที่ตอบตาม status ที่กำหนด แล้วคืนตัวปลอมไว้ตรวจคำขอ */
  function mockFetch(status: number, body: unknown = { id: 7 }) {
    // สร้างคำตอบใหม่ทุกครั้ง (คำตอบ 1 ตัวอ่านเนื้อหาได้ครั้งเดียว)
    return vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  }

  /** method / ที่อยู่ / ข้อมูลที่ส่ง ของคำขอแรก */
  function firstRequest(fetchMock: ReturnType<typeof mockFetch>) {
    const [url, init] = fetchMock.mock.calls[0] ?? []
    const body = init?.body
    return {
      url,
      method: init?.method,
      body: typeof body === 'string' ? (JSON.parse(body) as unknown) : body,
    }
  }

  it('เพิ่มบัญชี: POST /admin/users/ พร้อมข้อมูลทุกช่อง', async () => {
    const fetchMock = mockFetch(201)
    const data = {
      email: 's670510118@example.com',
      student_or_staff_id: '670510118',
      first_name: 'ธนพล',
      last_name: 'ใจดี',
      role: 'student' as const,
      password: 'hT7kPq4wNx9e',
    }

    await expect(createAdminUser(data)).resolves.toEqual({ id: 7 })

    expect(firstRequest(fetchMock)).toEqual({ url: '/api/v1/admin/users/', method: 'POST', body: data })
  })

  it('แก้ไข: PATCH /admin/users/{id}/ ส่งเฉพาะช่องที่เปลี่ยน', async () => {
    const fetchMock = mockFetch(200)

    await updateAdminUser(7, { role: 'teacher' })

    expect(firstRequest(fetchMock)).toEqual({
      url: '/api/v1/admin/users/7/',
      method: 'PATCH',
      body: { role: 'teacher' },
    })
  })

  it('ระงับ / เปิดใช้งาน: POST ไม่มีข้อมูล', async () => {
    const fetchMock = mockFetch(200)

    await suspendAdminUser(7)
    await activateAdminUser(7)

    const [suspend, activate] = fetchMock.mock.calls
    expect(suspend?.[0]).toBe('/api/v1/admin/users/7/suspend/')
    expect(activate?.[0]).toBe('/api/v1/admin/users/7/activate/')
    expect(suspend?.[1]?.method).toBe('POST')
    expect(suspend?.[1]?.body).toBeUndefined()
  })

  it('รีเซ็ตรหัส: POST {new_password} — backend ตอบ 204 (ไม่ส่งรหัสกลับ)', async () => {
    const fetchMock = mockFetch(204)

    await expect(resetAdminUserPassword(7, 'Wm4rXc8tLp3a')).resolves.toBeUndefined()

    expect(firstRequest(fetchMock)).toEqual({
      url: '/api/v1/admin/users/7/password/',
      method: 'POST',
      body: { new_password: 'Wm4rXc8tLp3a' },
    })
  })
})
