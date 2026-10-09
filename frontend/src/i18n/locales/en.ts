/**
 * ข้อความภาษาอังกฤษ — ต้องมี key ครบและตรงกับ th.ts ทุกตัว
 * (ชนิด Translation บังคับไว้: ขาดหรือเกิน key → TypeScript แจ้ง error)
 */
import type { Translation } from './th'

export const en: Translation = {
  app: {
    name: 'Mangosteen Campus',
  },

  language: {
    switcherLabel: 'Choose language',
    th: 'Thai',
    en: 'English',
  },

  health: {
    checking: 'Checking system…',
    ok: 'System is ready',
    databaseUnavailable: 'System is running, but the database is not ready',
    unreachable: 'Cannot reach the server',
  },
}
