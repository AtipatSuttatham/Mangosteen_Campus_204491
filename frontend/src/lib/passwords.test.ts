/**
 * test ของตัวสุ่มรหัสผ่านชั่วคราว (ขั้น 2.6)
 */
import { describe, expect, it } from 'vitest'
import { generateTempPassword, PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH } from './passwords'

describe('generateTempPassword', () => {
  it('ยาว 12 ตัว และใช้เฉพาะตัวอักษรในชุด (ไม่มีตัวที่สับสนง่ายและไม่มีสัญลักษณ์)', () => {
    for (let round = 0; round < 50; round++) {
      const password = generateTempPassword()
      expect(password).toHaveLength(TEMP_PASSWORD_LENGTH)
      expect(password).toMatch(/^[a-kmnp-zA-HJ-NP-Z2-9]+$/)
    }
  })

  it('ชุดตัวอักษรมี 56 ตัว ไม่มี l I 1 o O 0', () => {
    expect(PASSWORD_ALPHABET).toHaveLength(56)
    for (const confusing of ['l', 'I', '1', 'o', 'O', '0']) {
      expect(PASSWORD_ALPHABET).not.toContain(confusing)
    }
  })

  it('สุ่มแต่ละครั้งได้รหัสไม่ซ้ำกัน', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTempPassword()))
    expect(passwords.size).toBe(20)
  })

  it('ทิ้งค่าสุ่มตั้งแต่ 224 ขึ้นไป (กันบางตัวอักษรออกบ่อยกว่าตัวอื่น)', () => {
    // ตัวสุ่มปลอม: ครั้งแรกได้แต่ 255 (ทิ้งทั้งหมด) ครั้งต่อไปได้ 0, 1, 2, … (ตัวอักษรเรียงตามชุด)
    let call = 0
    const fakeRandom = (buffer: Uint8Array<ArrayBuffer>) => {
      call += 1
      buffer.forEach((_, index) => {
        buffer[index] = call === 1 ? 255 : index
      })
      return buffer
    }

    expect(generateTempPassword(fakeRandom)).toBe(PASSWORD_ALPHABET.slice(0, 12))
    expect(call).toBe(2)
  })

  it('ค่า 56 วนกลับมาเป็นตัวแรกของชุด (หารเอาเศษ)', () => {
    const fakeRandom = (buffer: Uint8Array<ArrayBuffer>) => buffer.fill(56)
    expect(generateTempPassword(fakeRandom)).toBe('a'.repeat(12))
  })
})
