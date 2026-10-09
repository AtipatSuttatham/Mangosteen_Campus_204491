/**
 * ตั้งค่าระบบข้อความของหน้าจอ (i18next + react-i18next) — ระบบใช้ภาษาไทยภาษาเดียว
 * import ไฟล์นี้ครั้งเดียวตอนแอปเริ่มทำงาน (main.tsx)
 *
 * หน้าจอใช้งานผ่าน hook:  const { t } = useTranslation()  แล้ว  t('health.ok')
 *
 * ทำไมใช้ไลบรารีแปลภาษาทั้งที่มีภาษาเดียว:
 *   - ข้อความทุกตัวอยู่ที่ th.ts ที่เดียว แก้ที่เดียวเปลี่ยนทุกหน้า
 *   - TypeScript ตรวจรหัสข้อความผิดให้
 *   - ถ้าวันหนึ่งต้องการภาษาอังกฤษ เพิ่มไฟล์ภาษาได้โดยไม่ต้องแก้หน้าจอ
 *     (เวอร์ชัน 2 ภาษาที่เคยทำไว้อยู่ใน commit 53d6b9b)
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { th } from './locales/th'

void i18n.use(initReactI18next).init({
  // ข้อความภาษาไทย (ใช้ namespace เดียวชื่อ translation)
  resources: {
    th: { translation: th },
  },
  lng: 'th',
  fallbackLng: 'th',
  interpolation: {
    // React ป้องกันโค้ดอันตราย (XSS) ในข้อความให้อยู่แล้ว จึงไม่ต้องให้ i18next escape ซ้ำ
    escapeValue: false,
  },
  // ข้อความโหลดมาพร้อมแอปแล้ว → เริ่มทำงานทันที ไม่ต้องรอโหลด
  initAsync: false,
})

export default i18n
