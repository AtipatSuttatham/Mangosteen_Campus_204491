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
