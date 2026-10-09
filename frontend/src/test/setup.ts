/**
 * ไฟล์เตรียมความพร้อมที่ Vitest รันก่อน test ทุกไฟล์
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
// เปิดระบบแปลภาษาให้ test ทุกไฟล์ (เหมือนตอนแอปจริงเริ่มทำงานใน main.tsx)
import i18n from '../i18n'

// เพิ่มตัวตรวจผลสำหรับหน้าเว็บ (เช่น toBeInTheDocument) ผ่านบรรทัด import ด้านบน
afterEach(async () => {
  // ลบหน้าจอที่ render ไว้ออก เพื่อไม่ให้ test ข้อถัดไปเห็นของเก่า
  cleanup()
  // คืนค่าภาษาเป็นไทยและล้างค่าที่จำไว้ เพื่อให้ทุก test เริ่มจากสภาพเดียวกัน
  await i18n.changeLanguage('th')
  window.localStorage.clear()
})
