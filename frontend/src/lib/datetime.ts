/**
 * ฟังก์ชันแสดงวันที่และเวลา — รูปแบบเดียวทั้งระบบ: "25 ก.ค. 2569 23:59"
 *
 * - ปี พ.ศ. + ชื่อเดือนย่อภาษาไทย + นาฬิกา 24 ชั่วโมง
 * - แสดงเป็น "เวลาประเทศไทย" เสมอ ไม่ว่าเครื่องผู้ใช้ตั้งเขตเวลาไหน
 *   (backend เก็บเวลาเป็น UTC — ตาม docs/database.md §1)
 * - ทุกหน้าจอต้องแสดงวันที่ผ่านฟังก์ชันนี้ ห้ามจัดรูปแบบเอง
 */

/** เขตเวลาที่ใช้แสดงผลทั้งระบบ */
export const DISPLAY_TIME_ZONE = 'Asia/Bangkok'

/** ตัวจัดรูปแบบวันที่ภาษาไทย ปฏิทินพุทธศักราช (สร้างครั้งเดียวแล้วใช้ซ้ำ) */
const formatter = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: DISPLAY_TIME_ZONE,
})

/**
 * แปลงวันที่เป็นข้อความรูปแบบ "วัน เดือนย่อ ปีพ.ศ. ชั่วโมง:นาที"
 * @param value วันที่ (Date หรือข้อความรูปแบบ ISO ที่ได้จาก API เช่น "2026-07-25T16:59:00Z")
 */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value

  // แยกเป็นชิ้น (วัน/เดือน/ปี/ชั่วโมง/นาที) แล้วประกอบเอง เพื่อคุมรูปแบบให้คงที่
  // ไม่ขึ้นกับรุ่นของเบราว์เซอร์ (บางรุ่นอาจแทรกคำหรือเครื่องหมายเพิ่ม)
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>

  return `${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}`
}
