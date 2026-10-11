/**
 * รูปประจำตัวแบบวงกลม — ตาม sidebar / แถบบนมือถือ / เมนูลิ้นชัก ใน design canvas
 *
 *   มีรูป (avatar_url)  → แสดงรูป ตัดเป็นวงกลม
 *   ยังไม่มีรูป          → ตัวอักษรย่อของชื่อ เช่น "สร" (การตัดสินใจก้อน 1)
 *
 * เป็นการตกแต่งเท่านั้น (aria-hidden) — ชื่อผู้ใช้แสดงเป็นตัวอักษรข้าง ๆ หรืออยู่ในชื่อของลิงก์ที่ครอบแล้ว
 * ตอนนี้มีแบบพื้นม่วง (onDark) แบบเดียว — หน้าข้อมูลส่วนตัว (ขั้น 1.8) จะเพิ่มแบบอื่นตาม wireframe
 */
import type { User } from '../../api/auth'
import { initials } from '../../lib/names'

type AvatarProps = {
  user: Pick<User, 'first_name' | 'last_name' | 'email' | 'avatar_url'>
  /** ความกว้าง/สูง (px) — sidebar/ลิ้นชัก 38, แถบบนมือถือ 36 (ตาม canvas) */
  size: number
  className?: string
}

/** รูปประจำตัววงกลม */
export function Avatar({ user, size, className = '' }: AvatarProps) {
  const box = { width: size, height: size }

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        aria-hidden="true"
        style={box}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      // ขนาดตัวอักษรตามสัดส่วนใน canvas: วง 38px → 14px, วง 36px → 13px
      style={{ ...box, fontSize: Math.round(size * 0.37) }}
      className={
        'flex shrink-0 items-center justify-center rounded-full bg-white/14 font-display font-semibold text-white ' +
        className
      }
    >
      {initials(user)}
    </span>
  )
}
