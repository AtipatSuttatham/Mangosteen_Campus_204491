/**
 * ฟังก์ชันแสดงวันที่และเวลาตามภาษาที่ผู้ใช้เลือก
 *
 * - ภาษาไทย   → ปี พ.ศ.  เช่น "25 ก.ค. 2569 23:59"
 * - ภาษาอังกฤษ → ปี ค.ศ.  เช่น "25 Jul 2026 23:59"
 * - แสดงเป็น "เวลาประเทศไทย" เสมอ ไม่ว่าเครื่องผู้ใช้ตั้งเขตเวลาไหน
 *   (backend เก็บเวลาเป็น UTC — ตาม docs/database.md §1)
 */
import type { Language } from '../i18n/languages'

/** เขตเวลาที่ใช้แสดงผลทั้งระบบ */
export const DISPLAY_TIME_ZONE = 'Asia/Bangkok'

/** ตั้งค่าการจัดรูปแบบของแต่ละภาษา (ไทยใช้ปฏิทินพุทธศักราช) */
const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  th: 'th-TH-u-ca-buddhist',
  en: 'en-GB',
}

/**
 * แปลงวันที่เป็นข้อความรูปแบบ "วัน เดือนย่อ ปี ชั่วโมง:นาที" (นาฬิกา 24 ชั่วโมง)
 * @param value วันที่ (Date หรือข้อความรูปแบบ ISO ที่ได้จาก API เช่น "2026-07-25T16:59:00Z")
 * @param language ภาษาที่ใช้แสดง
 */
export function formatDateTime(value: Date | string, language: Language): string {
  const date = typeof value === 'string' ? new Date(value) : value

  const formatter = new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: DISPLAY_TIME_ZONE,
  })

  // แยกเป็นชิ้น (วัน/เดือน/ปี/ชั่วโมง/นาที) แล้วประกอบเองให้ได้รูปแบบเดียวกันทั้ง 2 ภาษา
  // (รูปแบบสำเร็จรูปของภาษาอังกฤษมีจุลภาคคั่นวันกับเวลา เช่น "25 Jul 2026, 23:59")
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>

  return `${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}`
}
