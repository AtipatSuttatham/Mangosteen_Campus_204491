/**
 * ตั้งค่า Vite (ตัวรันเซิร์ฟเวอร์พัฒนาและตัว build) + Vitest (ตัวรัน test)
 */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// ที่อยู่ backend ที่จะส่งต่อคำขอ /api ไปหา ตอนพัฒนาในเครื่อง
// ค่าเริ่มต้น = backend พอร์ต 8008 (ตามข้อตกลงใน CLAUDE.md) ; เปลี่ยนได้ด้วยตัวแปร BACKEND_URL
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8008'

export default defineConfig({
  plugins: [
    // รองรับ React (JSX + โหลดหน้าใหม่ทันทีเมื่อแก้โค้ด)
    react(),
    // รองรับ Tailwind CSS v4
    tailwindcss(),
  ],

  // --- เซิร์ฟเวอร์พัฒนา (pnpm dev) ---
  server: {
    // พอร์ต 5180 (5173 ซึ่งเป็นค่ามาตรฐานถูกโปรเจกต์อื่นในเครื่องใช้อยู่)
    port: 5180,
    // ถ้าพอร์ตถูกใช้อยู่ ให้แจ้ง error แทนการย้ายไปพอร์ตอื่นเอง (กันสับสนว่าเปิดที่พอร์ตไหน)
    strictPort: true,
    // ส่งต่อคำขอที่ขึ้นต้นด้วย /api ไปให้ backend
    // ทำให้ตอนพัฒนา frontend กับ backend ดูเหมือนอยู่ที่เดียวกัน ไม่ต้องตั้ง CORS
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },

  // --- Vitest (pnpm test) ---
  test: {
    // จำลองหน้าเว็บด้วย jsdom ให้ test หน้าจอ React ได้โดยไม่ต้องเปิดเบราว์เซอร์จริง
    environment: 'jsdom',
    // ไฟล์ที่รันก่อน test ทุกไฟล์ (เพิ่มตัวตรวจผลแบบหน้าเว็บ เช่น toBeInTheDocument)
    setupFiles: ['./src/test/setup.ts'],
    // ล้างค่าจำลองต่าง ๆ (mock) ให้สะอาดระหว่าง test แต่ละข้อ
    restoreMocks: true,
  },
})
