/**
 * test ของฟังก์ชันแสดงวันที่ formatDateTime
 */
import { describe, expect, it } from 'vitest'
import { formatDateTime } from './datetime'

// 25 ก.ค. 2026 เวลา 16:59 UTC = 23:59 เวลาไทย (UTC+7)
const SAMPLE_UTC = '2026-07-25T16:59:00Z'

describe('formatDateTime', () => {
  it('ภาษาไทย: แสดงปี พ.ศ. เดือนย่อภาษาไทย และเวลาไทย', () => {
    expect(formatDateTime(SAMPLE_UTC, 'th')).toBe('25 ก.ค. 2569 23:59')
  })

  it('ภาษาอังกฤษ: แสดงปี ค.ศ. เดือนย่อภาษาอังกฤษ และเวลาไทย (ไม่มีจุลภาค)', () => {
    expect(formatDateTime(SAMPLE_UTC, 'en')).toBe('25 Jul 2026 23:59')
  })

  it('รับค่าเป็น Date ได้เหมือนข้อความ ISO', () => {
    expect(formatDateTime(new Date(SAMPLE_UTC), 'th')).toBe('25 ก.ค. 2569 23:59')
  })

  it('เวลาข้ามวันตามเวลาไทย: 18:30 UTC = 01:30 ของวันถัดไปในไทย', () => {
    expect(formatDateTime('2026-07-25T18:30:00Z', 'th')).toBe('26 ก.ค. 2569 01:30')
  })

  it('ชั่วโมง/นาทีหลักเดียวเติม 0 ข้างหน้าเสมอ', () => {
    // 01:05 UTC = 08:05 เวลาไทย
    expect(formatDateTime('2026-01-02T01:05:00Z', 'en')).toBe('2 Jan 2026 08:05')
  })
})
