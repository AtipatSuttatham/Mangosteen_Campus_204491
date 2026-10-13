/**
 * แปลงปัญหา 1 ช่องในไฟล์ CSV (จากรายงานของ backend) เป็นข้อความไทย — ขั้น 2.7
 * ข้อความตาม board "นำเข้า CSV ② พบปัญหา" เช่น "อีเมลนี้มีผู้ใช้แล้ว", "อีเมลซ้ำกับแถว 4 ในไฟล์นี้"
 * ปัญหาที่ไม่ตรงข้อใด → ข้อความรายช่องกลางของระบบ (fieldErrors ใน th.ts) — ผู้ใช้ไม่เห็นรหัสดิบ
 */
import type { CsvRowError } from '../../../../api/adminUsers'
import { fieldErrorMessage } from '../../../../api/errors'
import i18n from '../../../../i18n'

/** รหัสข้อความเฉพาะ ตาม (คอลัมน์, รหัสปัญหา) */
const SPECIFIC: Record<string, string> = {
  'email:unique': 'csvImport.problem.emailUnique',
  'student_or_staff_id:unique': 'csvImport.problem.idUnique',
  'email:blank': 'csvImport.problem.emailBlank',
  'email:required': 'csvImport.problem.emailBlank',
  'first_name:blank': 'csvImport.problem.firstNameBlank',
  'first_name:required': 'csvImport.problem.firstNameBlank',
  'last_name:blank': 'csvImport.problem.lastNameBlank',
  'last_name:required': 'csvImport.problem.lastNameBlank',
  'role:blank': 'csvImport.problem.roleBlank',
  'role:required': 'csvImport.problem.roleBlank',
  'email:invalid': 'csvImport.problem.emailInvalid',
  'role:invalid_choice': 'csvImport.problem.roleInvalid',
  'role:csv_admin_not_allowed': 'csvImport.problem.adminNotAllowed',
}

/** ข้อความไทยของปัญหา 1 ช่อง */
export function csvProblemText(error: CsvRowError): string {
  if (error.code === 'duplicate_in_file' && error.duplicate_of !== undefined) {
    const key =
      error.column === 'email' ? 'csvImport.problem.emailDuplicate' : 'csvImport.problem.idDuplicate'
    return i18n.t(key, { row: error.duplicate_of })
  }
  const key = SPECIFIC[`${error.column}:${error.code}`]
  // key มาจากตารางด้านบนที่ตรงกับ th.ts (test ตรวจทุกตัว)
  return key ? i18n.t(key as 'csvImport.problem.emailUnique') : (fieldErrorMessage(error.code) ?? '')
}
