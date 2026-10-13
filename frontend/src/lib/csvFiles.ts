/**
 * สร้างไฟล์ CSV ในหน้าเว็บ — หน้านำเข้าผู้ใช้ (ขั้น 2.7)
 *
 *   sampleCsv()        ไฟล์ตัวอย่าง: หัวตาราง 5 คอลัมน์ + ข้อมูลสมมติ 3 แถว
 *   passwordCsv()      ไฟล์รหัสผ่านหลังนำเข้า: 5 คอลัมน์เดิม + password (server ไม่เก็บรหัส — สร้างที่หน้าเว็บ)
 *   downloadCsv()      ส่งไฟล์ให้เบราว์เซอร์ดาวน์โหลด
 *
 * รูปแบบไฟล์ (การตัดสินใจก้อน 2 "การเข้ารหัสไฟล์ CSV"):
 *   - UTF-8 มี BOM → Excel เปิดแล้วอ่านภาษาไทยได้ทันที
 *   - ขึ้นบรรทัดแบบ CRLF (มาตรฐาน CSV / Excel บน Windows) ; ช่องที่มี , " หรือขึ้นบรรทัด ครอบด้วย "
 *   - **กันสูตร Excel** (ไฟล์รหัสผ่าน): ช่องที่ขึ้นต้นด้วย = + - @ (หรือ tab / ขึ้นบรรทัด) ใส่ ' นำหน้า
 *     → Excel แสดงเป็นข้อความ ไม่รันเป็นสูตร (เช่น ชื่อในไฟล์ว่า =HYPERLINK(...) — งานค้างจากขั้น 2.4)
 */
import { CSV_COLUMNS, type ImportedUser } from '../api/adminUsers'

/** เครื่องหมาย BOM ของ UTF-8 (บอก Excel ว่าไฟล์เป็น UTF-8) */
const BOM = '﻿'

/** ตัวอักษรขึ้นต้นที่ Excel อาจมองเป็นสูตร */
const FORMULA_START = /^[=+\-@\t\r]/

/** กันสูตร Excel: ใส่ ' นำหน้าค่าที่ขึ้นต้นด้วยเครื่องหมายสูตร */
export function guardFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value
}

/** ค่า 1 ช่อง: ครอบด้วย " เมื่อมี , " หรือขึ้นบรรทัด (" ข้างในเขียนซ้ำเป็น "") */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** รวมหลายแถวเป็นเนื้อไฟล์ CSV (มี BOM + CRLF) */
export function toCsv(rows: string[][]): string {
  return BOM + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/**
 * ไฟล์ตัวอย่าง — ข้อมูลสมมติ (@example.com) ให้ผู้ดูแลระบบเห็นรูปแบบ แล้วพิมพ์ทับได้เลย
 * (เป็นเนื้อหาของไฟล์ ไม่ใช่ข้อความบนหน้าจอ จึงไม่อยู่ใน th.ts)
 */
export function sampleCsv(): string {
  return toCsv([
    [...CSV_COLUMNS],
    ['s690000001@example.com', '690000001', 'สมชาย', 'ใจดี', 'student'],
    ['s690000002@example.com', '690000002', 'สมหญิง', 'รักเรียน', 'student'],
    ['teacher01@example.com', 'T0001', 'อาจารย์ตัวอย่าง', 'สอนดี', 'teacher'],
  ])
}

/** ไฟล์รหัสผ่านหลังนำเข้า: 5 คอลัมน์เดิม + password เรียงตามแถวในไฟล์เดิม (กันสูตร Excel ทุกช่อง) */
export function passwordCsv(users: ImportedUser[]): string {
  const rows = [...users]
    .sort((a, b) => a.row - b.row)
    .map((user) =>
      [
        user.email,
        user.student_or_staff_id ?? '',
        user.first_name,
        user.last_name,
        user.role,
        user.password,
      ].map(guardFormula),
    )
  return toCsv([[...CSV_COLUMNS, 'password'], ...rows])
}

/** ชื่อไฟล์รหัสผ่าน: ชื่อไฟล์เดิม + "-รหัสผ่าน.csv" เช่น นักศึกษา_204111.csv → นักศึกษา_204111-รหัสผ่าน.csv */
export function passwordFileName(originalName: string, suffix: string): string {
  const base = originalName.replace(/\.csv$/i, '') || 'users'
  return `${base}-${suffix}.csv`
}

/** ให้เบราว์เซอร์ดาวน์โหลดเนื้อไฟล์เป็นไฟล์ CSV (สร้างในหน่วยความจำ ไม่ส่งไปที่ไหน) */
export function downloadCsv(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
