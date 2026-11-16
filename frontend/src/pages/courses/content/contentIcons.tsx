/**
 * ไอคอนของแท็บเนื้อหา (รูปทรงจาก board แถวก้อน 4 ใน design canvas — ขั้น 4.5)
 * ตกแต่งอย่างเดียว (aria-hidden ผ่าน LineIcon) — ความหมายอยู่ในข้อความข้าง ๆ เสมอ
 * (ไอคอนชนิดเนื้อหาแสดงคู่กับคำ "ข้อความ" / "PDF" ฯลฯ — แยกชนิดได้โดยไม่พึ่งรูปหรือสีอย่างเดียว)
 */
import type { ReactNode } from 'react'
import type { ContentKind } from '../../../api/content'
import { LineIcon } from '../icons'

/** ไอคอนชนิดเนื้อหา 6 แบบ (ตาม board: เส้นบรรทัด / แผ่นเอกสาร / รูป / กล้อง / โน้ตเพลง / โซ่) */
export function ContentKindIcon({ kind, size = 20 }: { kind: ContentKind; size?: number }) {
  return <LineIcon size={size}>{KIND_PATHS[kind]}</LineIcon>
}

const KIND_PATHS: Record<ContentKind, ReactNode> = {
  text: <path d="M5 6h14M5 10h14M5 14h10M5 18h7" />,
  file: (
    <>
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 16l-5-5-8 8.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5.5" width="13" height="13" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </>
  ),
  audio: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </>
  ),
}

/** ↑ เลื่อนขึ้น */
export function ArrowUpIcon() {
  return (
    <LineIcon size={20}>
      <path d="M6 15l6-6 6 6" />
    </LineIcon>
  )
}

/** ↓ เลื่อนลง */
export function ArrowDownIcon() {
  return (
    <LineIcon size={20}>
      <path d="M6 9l6 6 6-6" />
    </LineIcon>
  )
}

/** ลูกศรพับ / เปิดหน่วย: เปิด = ชี้ลง, พับ = ชี้ขวา (ไม่หมุนแบบเคลื่อนไหว — เปลี่ยนรูปทันที) */
export function ToggleIcon({ open }: { open: boolean }) {
  return (
    <LineIcon size={20} strokeWidth={2}>
      <path d={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />
    </LineIcon>
  )
}
