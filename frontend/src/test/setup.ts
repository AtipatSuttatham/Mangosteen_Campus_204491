/**
 * ไฟล์เตรียมความพร้อมที่ Vitest รันก่อน test ทุกไฟล์
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// เพิ่มตัวตรวจผลสำหรับหน้าเว็บ (เช่น toBeInTheDocument) ผ่านบรรทัด import ด้านบน
// และหลัง test แต่ละข้อ ให้ลบหน้าจอที่ render ไว้ออก เพื่อไม่ให้ test ข้อถัดไปเห็นของเก่า
afterEach(() => {
  cleanup()
})
