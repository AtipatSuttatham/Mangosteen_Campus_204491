/**
 * test ของการแปลงรหัส error เป็นข้อความภาษาไทย (errorMessage / fieldErrorMessage)
 */
import { describe, expect, it } from 'vitest'
import { errorMessage, fieldErrorMessage } from './errors'

describe('errorMessage', () => {
  it('รหัสที่รู้จัก → ข้อความภาษาไทยจาก th.ts', () => {
    expect(errorMessage('permission_denied')).toBe('คุณไม่มีสิทธิ์ทำรายการนี้')
    expect(errorMessage('network_error')).toBe('ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ')
  })

  it('รหัสของการเข้าสู่ระบบ (ก้อน 1) → ข้อความตาม wireframe / รายงาน', () => {
    expect(errorMessage('invalid_credentials')).toBe(
      'รหัสหรืออีเมล หรือรหัสผ่านไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง',
    )
    expect(errorMessage('account_disabled')).toBe(
      'บัญชีนี้ถูกระงับการใช้งาน ไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ',
    )
  })

  it('รหัสของการจัดการบัญชีผู้ใช้ (ก้อน 2) → ข้อความไทย', () => {
    expect(errorMessage('cannot_modify_self')).toBe(
      'ระงับ เปลี่ยนบทบาท หรือรีเซ็ตรหัสผ่านของบัญชีตัวเองไม่ได้ เปลี่ยนรหัสผ่านของคุณได้ที่หน้าข้อมูลส่วนตัว',
    )
    expect(errorMessage('last_active_admin')).toBe(
      'ทำรายการนี้ไม่ได้ เพราะระบบต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน',
    )
  })

  it('รหัสที่ยังไม่มีข้อความ → ข้อความสำรอง (ไม่แสดงรหัสดิบให้ผู้ใช้)', () => {
    expect(errorMessage('some_new_code')).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
  })

  it('รหัสที่บังเอิญตรงกับชื่อในระบบ JavaScript (เช่น toString) → ข้อความสำรอง', () => {
    expect(errorMessage('toString')).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
  })
})

describe('fieldErrorMessage', () => {
  it('รหัสรายช่องที่รู้จัก → ข้อความภาษาไทย', () => {
    expect(fieldErrorMessage('required')).toBe('กรุณากรอกข้อมูลช่องนี้')
    expect(fieldErrorMessage('unique')).toBe('ข้อมูลนี้มีอยู่แล้วในระบบ')
  })

  it('รหัสรายช่องที่ยังไม่มีข้อความ → ข้อความสำรอง', () => {
    expect(fieldErrorMessage('date_range')).toBe('ข้อมูลช่องนี้ไม่ถูกต้อง')
  })

  it('ช่องนั้นไม่มี error (undefined) → ไม่มีข้อความ', () => {
    expect(fieldErrorMessage(undefined)).toBeUndefined()
  })
})
