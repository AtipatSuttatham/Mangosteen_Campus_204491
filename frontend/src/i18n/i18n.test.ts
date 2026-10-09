/**
 * test ของระบบแปลภาษา: ไฟล์ข้อความครบตรงกัน, การจำภาษา, การอัปเดต <html lang>
 */
import { describe, expect, it } from 'vitest'
import i18n from './index'
import { LANGUAGE_STORAGE_KEY, readStoredLanguage } from './languages'
import { en } from './locales/en'
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

/** รายการรหัสข้อความทั้งหมดของภาษาหนึ่ง (เรียงตามตัวอักษร) */
function flattenKeys(value: object): string[] {
  return flattenEntries(value)
    .map(([key]) => key)
    .sort()
}

describe('ไฟล์ข้อความ', () => {
  it('ภาษาอังกฤษมีรหัสข้อความครบและตรงกับภาษาไทยทุกตัว', () => {
    expect(flattenKeys(en)).toEqual(flattenKeys(th))
  })

  it.each([
    ['th', th],
    ['en', en],
  ])('ภาษา %s: ทุกข้อความเป็นตัวอักษรที่ไม่ว่าง', (_language, messages) => {
    for (const [key, text] of flattenEntries(messages)) {
      // ระบุรหัสไว้ในข้อความ error เพื่อให้รู้ว่าข้อความตัวไหนว่าง
      expect(typeof text === 'string' && text.trim().length > 0, key).toBe(true)
    }
  })
})

describe('การจำภาษาที่เลือก', () => {
  it('ค่าเริ่มต้นเป็นภาษาไทยเมื่อยังไม่เคยเลือก', () => {
    expect(readStoredLanguage()).toBe('th')
  })

  it('ค่าที่เก็บไว้ไม่ใช่ภาษาที่รองรับ → กลับเป็นภาษาไทย', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'jp')
    expect(readStoredLanguage()).toBe('th')
  })

  it('เปลี่ยนภาษาแล้วบันทึกลง localStorage และอัปเดต <html lang>', async () => {
    await i18n.changeLanguage('en')

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    expect(readStoredLanguage()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(i18n.t('health.ok')).toBe('System is ready')
  })
})
