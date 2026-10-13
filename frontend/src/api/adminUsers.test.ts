/**
 * test ของการแปลงตัวกรองหน้ารายชื่อผู้ใช้เป็น query string ของ backend (docs/api.md §7.1)
 */
import { describe, expect, it } from 'vitest'
import { adminUsersQuery } from './adminUsers'

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
