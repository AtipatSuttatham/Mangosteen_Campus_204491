/**
 * อ่านไฟล์รายชื่อในหน้าเว็บ — หน้าต่างเพิ่มผู้เรียน (ขั้น 3.6)
 *
 *   readRosterFile(file)   ไฟล์ .xlsx / .csv / .txt → รายการรหัสนักศึกษาหรืออีเมล
 *   findIdentifiers(rows)  ตารางข้อความ → หาคอลัมน์ที่ใช้ แล้วดึงรายการออกมา
 *
 * ไฟล์ไม่ถูกส่งขึ้น server — ส่งเฉพาะรายการที่ดึงได้ตอนผู้สอนกดตรวจรายการ
 *
 * กฎหาคอลัมน์ (ผู้ใช้ยืนยันแล้ว — CLAUDE.md "การตัดสินใจก้อน 3"):
 *   1. หาแถวหัวตารางใน 10 แถวแรก (เหนือตารางอาจมีแถวชื่อเอกสาร) ; ชื่อคอลัมน์ไม่สนตัวพิมพ์
 *   2. มีทั้งรหัสและอีเมล → ใช้รหัส ; แถวที่ช่องรหัสว่าง → ใช้อีเมลของแถวนั้น
 *   3. ไม่มีหัวตาราง + มีข้อมูลคอลัมน์เดียว → ใช้คอลัมน์นั้น
 *   4. ระบุไม่ได้ → แจ้งผู้ใช้ ไม่เดาเอง
 *
 * ตัวอ่าน Excel โหลดเฉพาะตอนเลือกไฟล์ .xlsx (คนที่ไม่ได้ใช้ไม่ต้องโหลด)
 */
import { MAX_IDENTIFIERS } from '../api/enrollments'

/** ขนาดไฟล์สูงสุด (เท่ากับการนำเข้า CSV ของก้อน 2) */
export const MAX_ROSTER_FILE_BYTES = 1024 * 1024

/** จำนวนแถวแรกที่หาหัวตาราง */
const HEADER_SEARCH_ROWS = 10

/** ชื่อหัวคอลัมน์ที่รู้จัก (ตัวพิมพ์เล็ก) — รวมหัวตารางของไฟล์นำเข้าบัญชี */
const ID_HEADERS = ['รหัสนักศึกษา', 'รหัสนักศึกษา/พนักงาน', 'รหัส', 'student_or_staff_id']
const EMAIL_HEADERS = ['อีเมล', 'email']

/** สาเหตุที่อ่านไฟล์ไม่ได้ (หน้าจอแปลเป็นข้อความจาก th.ts) */
export type RosterFileProblem =
  'wrong_type' | 'old_excel' | 'too_large' | 'unreadable' | 'empty' | 'no_column' | 'too_many'

/** อ่านไฟล์ไม่ได้ — total = จำนวนรายการที่พบ (เฉพาะ too_many) */
export class RosterFileError extends Error {
  readonly problem: RosterFileProblem
  readonly total: number

  constructor(problem: RosterFileProblem, total = 0) {
    super(problem)
    this.name = 'RosterFileError'
    this.problem = problem
    this.total = total
  }
}

/** ผลการอ่านไฟล์ — sheet มีเฉพาะไฟล์ Excel ; column = null เมื่อไม่มีหัวตาราง */
export type RosterFile = {
  name: string
  identifiers: string[]
  sheet: string | null
  column: string | null
}

const normalize = (value: string) => value.trim().toLowerCase()

/** ตารางข้อความ → รายการที่ใช้ + ชื่อคอลัมน์ที่อ่าน */
export function findIdentifiers(rows: string[][]): { identifiers: string[]; column: string | null } {
  for (const [index, row] of rows.slice(0, HEADER_SEARCH_ROWS).entries()) {
    const headers = row.map(normalize)
    const idColumn = headers.findIndex((header) => ID_HEADERS.includes(header))
    const emailColumn = headers.findIndex((header) => EMAIL_HEADERS.includes(header))
    if (idColumn < 0 && emailColumn < 0) continue

    const identifiers = rows
      .slice(index + 1)
      .map((cells) => (cells[idColumn] ?? '').trim() || (cells[emailColumn] ?? '').trim())
      .filter(Boolean)
    return { identifiers, column: (row[idColumn >= 0 ? idColumn : emailColumn] ?? '').trim() }
  }

  // ไม่มีหัวตาราง: ใช้ได้เฉพาะเมื่อทุกแถวมีข้อมูลอย่างมาก 1 ช่อง
  const filled = rows.map((cells) => cells.map((cell) => cell.trim()).filter(Boolean))
  if (filled.some((cells) => cells.length > 1)) throw new RosterFileError('no_column')
  return { identifiers: filled.flat(), column: null }
}

/** แยกไฟล์ข้อความเป็นตาราง: คั่นด้วย , ; หรือ tab ; ช่องครอบด้วย " ได้ ("" = " 1 ตัว) */
export function parseDelimited(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char !== '"') cell += char
      else if (text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else quoted = false
    } else if (char === '"' && cell === '') {
      quoted = true
    } else if (char === ',' || char === ';' || char === '\t') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      rows.push([...row, cell.replace(/\r$/, '')])
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell || row.length > 0) rows.push([...row, cell.replace(/\r$/, '')])
  return rows
}

/**
 * ถอดรหัสไฟล์ข้อความ: ไฟล์ "Unicode Text" ของ Excel (UTF-16 มี BOM) ดูจาก 2 byte แรก ;
 * นอกนั้นลอง UTF-8 ก่อน ถ้าไม่ใช่ใช้ TIS-620 / cp874 (Excel ไทย) เหมือนการนำเข้า CSV
 */
export function decodeText(bytes: ArrayBuffer): string {
  const [first, second] = new Uint8Array(bytes)
  if (first === 0xff && second === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (first === 0xfe && second === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-874').decode(bytes)
  }
}

/** อ่านชีตแรกของไฟล์ Excel */
async function readExcel(file: File): Promise<{ rows: string[][]; sheet: string }> {
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  const [first] = await readXlsxFile(file)
  if (!first) throw new RosterFileError('empty')
  return {
    sheet: first.sheet,
    // ค่าในช่องเป็นได้หลายชนิด (รหัสที่เก็บเป็นตัวเลข ฯลฯ) → แปลงเป็นข้อความ ; ช่องว่าง = ''
    rows: first.data.map((cells) => cells.map((cell) => (cell === null ? '' : String(cell)))),
  }
}

/** อ่านไฟล์รายชื่อ ; อ่านไม่ได้ทุกกรณีโยน RosterFileError */
export async function readRosterFile(file: File): Promise<RosterFile> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'xls') throw new RosterFileError('old_excel')
  if (!['xlsx', 'csv', 'txt'].includes(extension)) throw new RosterFileError('wrong_type')
  if (file.size > MAX_ROSTER_FILE_BYTES) throw new RosterFileError('too_large')

  let rows: string[][]
  let sheet: string | null = null
  try {
    if (extension === 'xlsx') {
      ;({ rows, sheet } = await readExcel(file))
    } else {
      rows = parseDelimited(decodeText(await file.arrayBuffer()))
    }
  } catch {
    throw new RosterFileError('unreadable')
  }

  const { identifiers, column } = findIdentifiers(rows)
  if (identifiers.length === 0) throw new RosterFileError('empty')
  if (identifiers.length > MAX_IDENTIFIERS) {
    throw new RosterFileError('too_many', identifiers.length)
  }
  return { name: file.name, identifiers, sheet, column }
}
