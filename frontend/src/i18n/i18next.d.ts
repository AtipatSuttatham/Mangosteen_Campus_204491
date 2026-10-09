/**
 * บอก TypeScript ว่าข้อความในระบบมีโครงสร้างตาม th.ts
 * ผลคือ: เรียก t('รหัสที่ไม่มีอยู่จริง') ในหน้าจอ → TypeScript แจ้ง error ทันที (กันพิมพ์รหัสผิด)
 */
import 'i18next'
import type { Translation } from './locales/th'

declare module 'i18next' {
  interface CustomTypeOptions {
    // namespace เริ่มต้นที่ใช้ใน t(...)
    defaultNS: 'translation'
    // โครงสร้างข้อความของ namespace นี้
    resources: {
      translation: Translation
    }
  }
}
