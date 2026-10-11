/**
 * รูปประจำตัวแบบวงกลม — ตาม sidebar / แถบบนมือถือ / เมนูลิ้นชัก ใน design canvas
 *
 *   มีรูป (avatar_url)  → แสดงรูป ตัดเป็นวงกลม
 *   ยังไม่มีรูป          → ตัวอักษรย่อของชื่อ เช่น "สร" (การตัดสินใจก้อน 1)
 *
 * เป็นการตกแต่งเท่านั้น (aria-hidden) — ชื่อผู้ใช้แสดงเป็นตัวอักษรข้าง ๆ หรืออยู่ในชื่อของลิงก์ที่ครอบแล้ว
 *
 * แบบ (variant):
 *   plain  วงพื้นม่วงโปร่งแสง — sidebar / แถบมือถือ / เมนูลิ้นชัก
 *   ring   วงใหญ่บนแถบบัตรประจำตัว (หน้าข้อมูลส่วนตัว ขั้น 1.8): พื้นม่วงเข้ม + ขอบเขียว 4px + วงขาวรอบนอก 4px
 */
import type { User } from '../../api/auth'
import { initials } from '../../lib/names'

type AvatarProps = {
  user: Pick<User, 'first_name' | 'last_name' | 'email' | 'avatar_url'>
  /** ความกว้าง/สูง (px) — sidebar/ลิ้นชัก 38, แถบบนมือถือ 36, บัตรประจำตัว 128 / 88 (ตาม canvas) */
  size: number
  /** แบบของวง (ค่าเริ่มต้น plain) */
  variant?: 'plain' | 'ring'
  className?: string
}

/** หน้าตาของแต่ละแบบ (ใช้ทั้งตอนมีรูปและไม่มีรูป) */
const VARIANT_CLASSES = {
  plain: 'bg-white/14',
  ring: 'border-4 border-accent bg-brand-hover shadow-[0_0_0_4px_var(--color-surface)]',
} as const

/** ขนาดตัวอักษรย่อเทียบกับขนาดวง (ตาม canvas: วง 38 → 14px ; วงบัตร 128 → 41px) */
const TEXT_RATIO = { plain: 0.37, ring: 0.32 } as const

/** รูปประจำตัววงกลม */
export function Avatar({ user, size, variant = 'plain', className = '' }: AvatarProps) {
  const box = { width: size, height: size }
  const look = VARIANT_CLASSES[variant]

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        aria-hidden="true"
        style={box}
        className={`box-border shrink-0 rounded-full object-cover ${look} ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: Math.round(size * TEXT_RATIO[variant]) }}
      className={
        'box-border flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white ' +
        `${look} ${className}`
      }
    >
      {initials(user)}
    </span>
  )
}
