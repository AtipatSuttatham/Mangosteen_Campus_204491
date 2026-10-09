/**
 * test ของระบบข้อความ: ใช้ภาษาไทย และไม่มีข้อความว่าง
 */
import { describe, expect, it } from 'vitest'
import i18n from './index'
import { th } from './locales/th'

/**
 * แปลงข้อความซ้อนชั้นเป็นรายการ [รหัสแบบมีจุด, ข้อความ]
 * เช่น { health: { ok: 'ระบบพร้อม' } } → [['health.ok', 'ระบบพร้อม']]
 */
function flattenEntries(value: object, prefix = ''): [string, unknown][] {
  return Object.entries(value).flatMap(([key, child]): [string, unknown][] =>
    typeof child === 'object' && child !== null
      ? flattenEntries(child, `${prefix}${key}.`)
      : [[`${prefix}${key}`, child]],
  )
}

describe('ระบบข้อความ', () => {
  it('ใช้ภาษาไทย และดึงข้อความตามรหัสได้', () => {
    expect(i18n.language).toBe('th')
    expect(i18n.t('health.ok')).toBe('ระบบพร้อมใช้งาน')
  })

  it('ทุกข้อความใน th.ts เป็นตัวอักษรที่ไม่ว่าง', () => {
    for (const [key, text] of flattenEntries(th)) {
      // ระบุรหัสไว้ในข้อความ error เพื่อให้รู้ว่าข้อความตัวไหนว่าง
      expect(typeof text === 'string' && text.trim().length > 0, key).toBe(true)
    }
  })
})
