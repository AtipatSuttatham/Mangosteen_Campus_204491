/**
 * test ของตัวตรวจไฟล์ชื่อซ้ำ (duplicateNames.ts — ชซ1)
 */
import { describe, expect, it } from 'vitest'
import { findDuplicate, renameProblem, splitName, suggestStem } from './duplicateNames'
import { makeContent } from './testData'

const fileContent = (id: number, file_name: string) => makeContent(id, { content_type: 'file', file_name })

describe('findDuplicate', () => {
  const contents = [
    makeContent(1, { content_type: 'text', title: 'บทที่3-ลูป.pdf' }), // ข้อความ ไม่มีไฟล์ → ไม่นับ
    fileContent(2, 'บทที่3-ลูป.pdf'),
    fileContent(3, 'บทที่3-ลูป.pdf'),
  ]

  it('ชื่อตรงกัน → รายการแรกตามลำดับในหน่วย (รายการที่ "แทนที่" จะเปลี่ยนไฟล์)', () => {
    expect(findDuplicate('บทที่3-ลูป.pdf', contents)?.id).toBe(2)
  })

  it('ไม่สนตัวพิมพ์เล็ก / ใหญ่ และช่องว่างหัวท้าย', () => {
    expect(findDuplicate(' บทที่3-ลูป.PDF', contents)?.id).toBe(2)
  })

  it('ภาษาไทยแบบแยกอักขระ (NFD จาก macOS) ถือว่าชื่อเดียวกัน', () => {
    const nfc = [fileContent(9, 'ผังงาน.png')]
    expect(findDuplicate('ผังงาน.png'.normalize('NFD'), nfc)?.id).toBe(9)
  })

  it('ไม่ซ้ำ / เนื้อหาที่ไม่มีไฟล์ → null', () => {
    expect(findDuplicate('สรุป.pdf', contents)).toBeNull()
    expect(findDuplicate('บทที่3-ลูป.pdf', contents.slice(0, 1))).toBeNull()
  })
})

describe('splitName / suggestStem', () => {
  it('แยกนามสกุลจากจุดสุดท้าย ; ไม่มีนามสกุล / ขึ้นต้นด้วยจุด → ไม่มีนามสกุล', () => {
    expect(splitName('a.b.pdf')).toEqual({ stem: 'a.b', ext: '.pdf' })
    expect(splitName('README')).toEqual({ stem: 'README', ext: '' })
    expect(splitName('.env')).toEqual({ stem: '.env', ext: '' })
  })

  it('เติม (2), (3) … จนไม่ซ้ำ', () => {
    const contents = [fileContent(1, 'ลูป.pdf'), fileContent(2, 'ลูป (2).pdf')]
    expect(suggestStem('ลูป.pdf', contents)).toBe('ลูป (3)')
  })
})

describe('renameProblem', () => {
  const contents = [fileContent(1, 'ลูป.pdf')]

  it('ว่าง / มี / หรือ \\ / ยาวเกิน 255 รวมนามสกุล / ยังซ้ำ → บอกปัญหา', () => {
    expect(renameProblem('  ', '.pdf', contents)).toBe('empty')
    expect(renameProblem('a/b', '.pdf', contents)).toBe('slash')
    expect(renameProblem('a\\b', '.pdf', contents)).toBe('slash')
    expect(renameProblem('ก'.repeat(252), '.pdf', contents)).toBe('too_long')
    expect(renameProblem('ลูป', '.PDF', contents)).toBe('duplicate')
  })

  it('ชื่อใช้ได้ (ยาวพอดี 255) → null', () => {
    expect(renameProblem('ก'.repeat(251), '.pdf', contents)).toBeNull()
    expect(renameProblem('ลูป ฉบับแก้', '.pdf', contents)).toBeNull()
  })
})
