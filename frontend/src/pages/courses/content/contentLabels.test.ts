/**
 * test ของข้อความรายละเอียดเนื้อหา — ขนาดไฟล์ (แก้หลังตรวจขั้น 4.5 แบบ กภ1)
 */
import { describe, expect, it } from 'vitest'
import i18n from '../../../i18n'
import { formatFileSize } from './contentLabels'

const t = i18n.t.bind(i18n)

describe('formatFileSize', () => {
  it('เลือกหน่วยตามขนาด: ไบต์ / KB / MB', () => {
    expect(formatFileSize(512, t)).toBe('512 ไบต์')
    expect(formatFileSize(340 * 1024, t)).toBe('340 KB')
    expect(formatFileSize(2.1 * 1024 * 1024, t)).toBe('2.1 MB')
  })

  it('ไฟล์เกือบ 1 MB ที่ปัดแล้วได้ 1024 KB แสดงเป็น 1.0 MB', () => {
    expect(formatFileSize(1024 * 1024 - 1, t)).toBe('1.0 MB')
    expect(formatFileSize(1024 * 1024 - 513, t)).toBe('1023 KB')
  })
})
