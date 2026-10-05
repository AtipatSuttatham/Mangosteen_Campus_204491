/**
 * ตั้งค่า ESLint — ตัวตรวจคุณภาพและข้อผิดพลาดของโค้ด TypeScript / React
 * รันด้วย: pnpm lint
 */
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // ไม่ตรวจโฟลเดอร์ผลลัพธ์จากการ build และรายงาน coverage
  { ignores: ['dist', 'coverage'] },

  // กฎสำหรับไฟล์ TypeScript / TSX ทั้งหมด
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // กฎพื้นฐานของ JavaScript ที่แนะนำ
      js.configs.recommended,
      // กฎของ TypeScript ที่แนะนำ
      ...tseslint.configs.recommended,
      // กฎการใช้ React Hooks ให้ถูกต้อง (เช่น เรียก hook ตามลำดับเดิมทุกครั้ง)
      // ใช้ชุดใน configs.flat เพราะเป็นรูปแบบที่ ESLint รุ่นใหม่ (flat config) รองรับ
      reactHooks.configs.flat['recommended-latest'],
      // กฎที่ช่วยให้การโหลดหน้าใหม่ทันทีตอนแก้โค้ด (Fast Refresh) ทำงานถูกต้อง
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // โค้ดรันบนเบราว์เซอร์ → รู้จักตัวแปรของเบราว์เซอร์ เช่น window, document
      globals: globals.browser,
    },
  },
)
