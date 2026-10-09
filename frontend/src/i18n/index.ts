/**
 * ตั้งค่าระบบแปลภาษา (i18next + react-i18next) — import ไฟล์นี้ครั้งเดียวตอนแอปเริ่มทำงาน (main.tsx)
 *
 * หลังตั้งค่าแล้ว หน้าจอใช้งานผ่าน hook: const { t, i18n } = useTranslation()
 *   - t('health.ok')                  → ข้อความตามภาษาปัจจุบัน
 *   - i18n.changeLanguage('en')       → เปลี่ยนภาษา (ระบบจะจำค่าและอัปเดต <html lang> ให้เอง)
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  readStoredLanguage,
  SUPPORTED_LANGUAGES,
  storeLanguage,
} from './languages'
import { en } from './locales/en'
import { th } from './locales/th'

/** ข้อความของทุกภาษา (ใช้ namespace เดียวชื่อ translation) */
export const resources = {
  th: { translation: th },
  en: { translation: en },
} as const

/** อัปเดตแท็ก <html lang="..."> ให้ตรงกับภาษาปัจจุบัน (ช่วยโปรแกรมอ่านหน้าจอและการตัดคำ) */
function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = language
}

// ทุกครั้งที่เปลี่ยนภาษา: บันทึกลง localStorage และอัปเดต <html lang>
i18n.on('languageChanged', (language) => {
  if (isLanguage(language)) {
    storeLanguage(language)
  }
  syncDocumentLanguage(language)
})

void i18n.use(initReactI18next).init({
  resources,
  // เริ่มด้วยภาษาที่ผู้ใช้เคยเลือก (ไม่มี = ภาษาไทย)
  lng: readStoredLanguage(),
  // ถ้าภาษาที่เลือกไม่มีข้อความบางตัว ให้ใช้ภาษาไทยแทน
  fallbackLng: DEFAULT_LANGUAGE,
  // ภาษาที่ยอมรับ (นอกเหนือจากนี้ถือว่าไม่รองรับ)
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: {
    // React ป้องกันโค้ดอันตราย (XSS) ในข้อความให้อยู่แล้ว จึงไม่ต้องให้ i18next escape ซ้ำ
    escapeValue: false,
  },
  // ข้อความทั้งหมดโหลดมาพร้อมแอปแล้ว → เริ่มทำงานแบบทันที ไม่ต้องรอโหลด
  initAsync: false,
})

// ตั้ง <html lang> ให้ตรงตั้งแต่เปิดหน้า (event languageChanged อาจยังไม่ยิงในรอบแรก)
syncDocumentLanguage(i18n.language)

export default i18n
