/**
 * test ของการสร้างไฟล์ CSV ในหน้าเว็บ (ขั้น 2.7) — ไฟล์ตัวอย่าง, ไฟล์รหัสผ่าน, กันสูตร Excel
 */
import { describe, expect, it } from 'vitest'
import type { ImportedUser } from '../api/adminUsers'
import { guardFormula, passwordCsv, passwordFileName, sampleCsv, toCsv } from './csvFiles'

/** บัญชีที่นำเข้าแล้ว (ข้อมูลสมมติ) */
function imported(row: number, overrides: Partial<ImportedUser> = {}): ImportedUser {
  return {
    row,
    id: row + 100,
    email: `s${row}@example.com`,
    student_or_staff_id: `69000000${row}`,
    first_name: 'สมชาย',
    last_name: 'ใจดี',
    role: 'student',
    password: 'hT7kPq4wNx9e',
    ...overrides,
  }
}

/** แยกเนื้อไฟล์เป็นบรรทัด (ตัด BOM และบรรทัดว่างท้ายไฟล์) */
const lines = (content: string) => content.slice(1).split('\r\n').slice(0, -1)

describe('toCsv', () => {
  it('ขึ้นต้นด้วย BOM ของ UTF-8 และขึ้นบรรทัดแบบ CRLF', () => {
    const content = toCsv([['a', 'b'], ['c', 'd']])
    expect(content.startsWith('﻿')).toBe(true)
    expect(content).toBe('﻿a,b\r\nc,d\r\n')
  })

  it('ช่องที่มีจุลภาค / เครื่องหมายคำพูด / ขึ้นบรรทัด ถูกครอบด้วย " (และ " ข้างในเขียนซ้ำ)', () => {
    expect(lines(toCsv([['ใจดี, จำกัด', 'ชื่อ "เล่น"', 'สอง\nบรรทัด']]))).toEqual([
      '"ใจดี, จำกัด","ชื่อ ""เล่น""","สอง\nบรรทัด"',
    ])
  })
})

describe('guardFormula (กันสูตร Excel)', () => {
  it.each(['=1+1', '+66812345678', '-5', '@SUM(A1)', '\t=cmd'])('ใส่ \' นำหน้า %j', (value) => {
    expect(guardFormula(value)).toBe(`'${value}`)
  })

  it('ค่าปกติไม่เปลี่ยน (รวมเครื่องหมายที่อยู่กลางข้อความ)', () => {
    expect(guardFormula('สมชาย')).toBe('สมชาย')
    expect(guardFormula('a=b@example.com')).toBe('a=b@example.com')
    expect(guardFormula('')).toBe('')
  })
})

describe('sampleCsv', () => {
  it('หัวตาราง 5 คอลัมน์ตามลำดับ + ข้อมูลสมมติ @example.com เท่านั้น', () => {
    const [header, ...rows] = lines(sampleCsv())
    expect(header).toBe('email,student_or_staff_id,first_name,last_name,role')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row).toMatch(/^[^,]+@example\.com,/)
  })
})

describe('passwordCsv', () => {
  it('5 คอลัมน์เดิม + password เรียงตามแถวในไฟล์เดิม ; ไม่มีรหัส = ช่องว่าง', () => {
    const content = passwordCsv([
      imported(3, { role: 'teacher', student_or_staff_id: null, password: 'Wm4rXc8tLp3a' }),
      imported(2),
    ])
    expect(lines(content)).toEqual([
      'email,student_or_staff_id,first_name,last_name,role,password',
      's2@example.com,690000002,สมชาย,ใจดี,student,hT7kPq4wNx9e',
      's3@example.com,,สมชาย,ใจดี,teacher,Wm4rXc8tLp3a',
    ])
  })

  it('กันสูตร Excel ในทุกช่องที่มาจากไฟล์ เช่น ชื่อ =HYPERLINK(...)', () => {
    const content = passwordCsv([imported(2, { first_name: '=HYPERLINK("http://x")', last_name: '+ok' })])
    expect(lines(content)[1]).toBe(
      's2@example.com,690000002,"\'=HYPERLINK(""http://x"")",\'+ok,student,hT7kPq4wNx9e',
    )
  })
})

describe('passwordFileName', () => {
  it('ชื่อไฟล์เดิม (ตัด .csv) + "-รหัสผ่าน.csv"', () => {
    expect(passwordFileName('นักศึกษา_204111.CSV', 'รหัสผ่าน')).toBe('นักศึกษา_204111-รหัสผ่าน.csv')
    expect(passwordFileName('.csv', 'รหัสผ่าน')).toBe('users-รหัสผ่าน.csv')
  })
})
