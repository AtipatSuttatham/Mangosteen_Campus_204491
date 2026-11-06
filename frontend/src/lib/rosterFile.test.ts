/**
 * test ของตัวอ่านไฟล์รายชื่อ (ขั้น 3.6) — ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 * ไฟล์ Excel ใช้ตัวอ่านปลอม (ตรวจกับไฟล์ .xlsx จริงในเบราว์เซอร์แล้ว) ; ไฟล์ข้อความอ่านจริง
 */
import readXlsxFile from 'read-excel-file/browser'
import { describe, expect, it, vi } from 'vitest'
import {
  decodeText,
  findIdentifiers,
  MAX_ROSTER_FILE_BYTES,
  parseDelimited,
  readRosterFile,
  RosterFileError,
} from './rosterFile'

vi.mock('read-excel-file/browser', () => ({ default: vi.fn() }))
const readExcel = vi.mocked(readXlsxFile)

/** ไฟล์ข้อความสมมติ */
const textFile = (name: string, content: string | Uint8Array<ArrayBuffer>) => new File([content], name)

/** ปัญหาที่ readRosterFile แจ้ง */
async function problemOf(file: File): Promise<RosterFileError> {
  const caught = await readRosterFile(file).catch((error: unknown) => error)
  expect(caught).toBeInstanceOf(RosterFileError)
  return caught as RosterFileError
}

describe('findIdentifiers', () => {
  it('มีทั้งรหัสและอีเมล → ใช้รหัส ; ไม่สนตัวพิมพ์ของหัวคอลัมน์', () => {
    const rows = [
      ['ชื่อ', 'EMAIL', 'รหัสนักศึกษา'],
      ['ธนพล', 'a@example.com', '670510118'],
    ]
    expect(findIdentifiers(rows)).toEqual({ identifiers: ['670510118'], column: 'รหัสนักศึกษา' })
  })

  it('ช่องรหัสว่าง → ใช้อีเมลของแถวนั้น ; แถวว่างข้าม', () => {
    const rows = [
      ['รหัส', 'อีเมล'],
      ['', 'a@example.com'],
      ['', ''],
      ['670510118', 'b@example.com'],
    ]
    expect(findIdentifiers(rows).identifiers).toEqual(['a@example.com', '670510118'])
  })

  it('มีแค่คอลัมน์อีเมล → ใช้อีเมล', () => {
    expect(findIdentifiers([['Email'], ['a@example.com']])).toEqual({
      identifiers: ['a@example.com'],
      column: 'Email',
    })
  })

  it('มีแถวชื่อเอกสารเหนือหัวตาราง → หาหัวตารางเจอใน 10 แถวแรก', () => {
    const rows = [['รายชื่อ 204111'], ['ตอน 001'], [], ['ลำดับ', 'รหัสนักศึกษา'], ['1', '670510118']]
    expect(findIdentifiers(rows).identifiers).toEqual(['670510118'])
  })

  it('หัวตารางอยู่หลังแถวที่ 10 → ไม่นับเป็นหัวตาราง', () => {
    const rows = [...Array.from({ length: 10 }, () => ['x', 'y']), ['รหัส', 'ชื่อ'], ['1', 'ก']]
    expect(() => findIdentifiers(rows)).toThrow(RosterFileError)
  })

  it('ไม่มีหัวตาราง + คอลัมน์เดียว → ใช้คอลัมน์นั้น', () => {
    expect(findIdentifiers([['670510118'], [' 670510119 '], ['']])).toEqual({
      identifiers: ['670510118', '670510119'],
      column: null,
    })
  })

  it('ไม่มีหัวตาราง + หลายคอลัมน์ → ไม่เดาเอง', () => {
    expect(() => findIdentifiers([['670510118', 'ธนพล']])).toThrow('no_column')
  })
})

describe('parseDelimited', () => {
  it('คั่นด้วย , หรือ tab ; รองรับ " และขึ้นบรรทัดแบบ CRLF', () => {
    expect(parseDelimited('a,"b,c"\r\n"d""e"\tf\n')).toEqual([
      ['a', 'b,c'],
      ['d"e', 'f'],
    ])
  })
})

describe('decodeText', () => {
  it('อ่านไฟล์ UTF-8 และไฟล์ TIS-620 จาก Excel ไทย', () => {
    const utf8 = new TextEncoder().encode('รหัส').buffer
    const tis620 = new Uint8Array([0xc3, 0xcb, 0xd1, 0xca]).buffer
    expect(decodeText(utf8 as ArrayBuffer)).toBe('รหัส')
    expect(decodeText(tis620)).toBe('รหัส')
  })
})

describe('readRosterFile', () => {
  it('อ่านไฟล์ .csv ที่มี BOM', async () => {
    const result = await readRosterFile(textFile('ห้อง.csv', '﻿รหัสนักศึกษา,ชื่อ\n670510118,ธนพล\n'))
    expect(result).toEqual({
      name: 'ห้อง.csv',
      identifiers: ['670510118'],
      sheet: null,
      column: 'รหัสนักศึกษา',
    })
  })

  it('อ่านไฟล์ .txt บรรทัดละคน', async () => {
    const result = await readRosterFile(textFile('รายชื่อ.TXT', '670510118\na@example.com\n'))
    expect(result.identifiers).toEqual(['670510118', 'a@example.com'])
  })

  it('อ่านชีตแรกของไฟล์ .xlsx และแปลงรหัสที่เก็บเป็นตัวเลข', async () => {
    readExcel.mockResolvedValue([
      {
        sheet: 'รายชื่อ',
        data: [
          ['รหัสนักศึกษา', 'ชื่อ'],
          [670510118, 'ธนพล'],
          [null, null],
        ],
      },
      { sheet: 'อื่น ๆ', data: [['รหัสนักศึกษา'], [1]] },
    ])
    const result = await readRosterFile(textFile('ห้อง.xlsx', 'x'))
    expect(result).toMatchObject({
      identifiers: ['670510118'],
      sheet: 'รายชื่อ',
      column: 'รหัสนักศึกษา',
    })
  })

  it('ไฟล์ Excel เสียหรือติดรหัสผ่าน → unreadable', async () => {
    readExcel.mockRejectedValue(new Error('bad file'))
    expect((await problemOf(textFile('ห้อง.xlsx', 'x'))).problem).toBe('unreadable')
  })

  it('ไฟล์ผิดชนิด / .xls แบบเก่า / ใหญ่เกิน 1 MB / ว่าง', async () => {
    expect((await problemOf(textFile('a.pdf', 'x'))).problem).toBe('wrong_type')
    expect((await problemOf(textFile('a.xls', 'x'))).problem).toBe('old_excel')
    const big = textFile('a.csv', 'x'.repeat(MAX_ROSTER_FILE_BYTES + 1))
    expect((await problemOf(big)).problem).toBe('too_large')
    expect((await problemOf(textFile('a.csv', 'รหัส\n'))).problem).toBe('empty')
  })

  it('เกิน 500 รายการ → too_many พร้อมจำนวนที่พบ ; 500 พอดีผ่าน', async () => {
    const lines = (total: number) => Array.from({ length: total }, (_, index) => `s${index}`).join('\n')
    const failure = await problemOf(textFile('a.txt', lines(501)))
    expect(failure.problem).toBe('too_many')
    expect(failure.total).toBe(501)
    await expect(readRosterFile(textFile('a.txt', lines(500)))).resolves.toBeTruthy()
  })
})
