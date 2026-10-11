/**
 * test ของตัวอักษรย่อจากชื่อ (initials)
 */
import { describe, expect, it } from 'vitest'
import { initials } from './names'

const user = (first_name: string, last_name: string, email = 'someone@example.com') => ({
  first_name,
  last_name,
  email,
})

describe('initials', () => {
  it('ใช้ตัวแรกของชื่อและนามสกุล', () => {
    expect(initials(user('สมใจ', 'รักเรียน'))).toBe('สร')
  })

  it('ข้ามสระหน้า (เ แ โ ใ ไ) แล้วใช้พยัญชนะตัวแรก', () => {
    expect(initials(user('เอกชัย', 'ใจดี'))).toBe('อจ')
    expect(initials(user('แก้ว', 'ไพรวัลย์'))).toBe('กพ')
  })

  it('ชื่อภาษาอังกฤษเป็นตัวพิมพ์ใหญ่ และตัดช่องว่างหัวท้าย', () => {
    expect(initials(user(' somjai', 'rakrian '))).toBe('SR')
  })

  it('มีแค่ชื่อ → ใช้ตัวเดียว', () => {
    expect(initials(user('สมใจ', ''))).toBe('ส')
  })

  it('ไม่มีทั้งชื่อและนามสกุล → ใช้ตัวแรกของอีเมล', () => {
    expect(initials(user('', '', 'admin@example.com'))).toBe('A')
  })
})
