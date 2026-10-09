/**
 * จุดเริ่มต้นของแอป React — หาตำแหน่ง <div id="root"> ใน index.html แล้ววาดหน้าจอลงไป
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// เปิดระบบข้อความ (th.ts) ก่อนวาดหน้าจอ — ต้องมาก่อนหน้าจอเพื่อให้ได้ข้อความตั้งแต่แรก
import './i18n'
import Root from './Root.tsx'

// หา element ที่จะวาดหน้าจอลงไป ถ้าไม่เจอแสดงว่า index.html ผิดพลาด → แจ้ง error ทันที
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  // StrictMode ช่วยตรวจจับปัญหาที่อาจเกิดในโค้ด React ระหว่างพัฒนา (ไม่มีผลตอนใช้งานจริง)
  <StrictMode>
    <Root />
  </StrictMode>,
)
