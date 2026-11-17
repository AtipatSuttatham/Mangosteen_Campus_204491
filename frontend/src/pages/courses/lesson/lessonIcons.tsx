/**
 * ไอคอนของหน้าบทเรียน (รูปทรงจาก board "บทเรียนของผู้เรียน" แถวก้อน 4 — ขั้น 4.7)
 * ตกแต่งอย่างเดียว (aria-hidden ผ่าน LineIcon) — ความหมายอยู่ในข้อความบนปุ่มเสมอ
 */
import { LineIcon } from '../icons'

/** ลูกศรออก 4 มุม: ปุ่ม "ขยาย" */
export function ExpandIcon() {
  return (
    <LineIcon size={16} strokeWidth={2}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </LineIcon>
  )
}

/** ลูกศรเข้า 4 มุม: ปุ่ม "ย่อ" */
export function ShrinkIcon() {
  return (
    <LineIcon size={16} strokeWidth={2}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </LineIcon>
  )
}

/** ลูกศรลงถาด: ปุ่ม "ดาวน์โหลด" */
export function DownloadIcon() {
  return (
    <LineIcon size={18}>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 19h14" />
    </LineIcon>
  )
}

/** ตา: ปุ่ม "เปิด" (เปิดดูไฟล์ในแท็บใหม่) */
export function OpenIcon() {
  return (
    <LineIcon size={18}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </LineIcon>
  )
}

/** กล่องลูกศรออก: ต่อท้าย "เปิดลิงก์" (ไปเว็บอื่นในแท็บใหม่) */
export function ExternalIcon() {
  return (
    <LineIcon size={16}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </LineIcon>
  )
}

/** ลูกศรลงขีดฆ่า: ข้อความ "ผู้สอนปิดการดาวน์โหลดไฟล์นี้" */
export function NoDownloadIcon() {
  return (
    <LineIcon size={16} strokeWidth={1.9}>
      <path d="M12 4v8M8.5 9.5L12 13l2-2" />
      <path d="M5 19h14M4 4l16 16" />
    </LineIcon>
  )
}
