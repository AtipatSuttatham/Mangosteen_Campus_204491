/**
 * ลายกลีบเลี้ยงมังคุดแบบเส้นบาง — ใช้เป็นลายตกแต่งพื้นหลัง (aria-hidden)
 * รูปทรงคัดลอกจาก design canvas: แผงสีม่วงของหน้าเข้าสู่ระบบ (ภาพ 5.1) และลายจางมุมล่างขวา
 * ของหน้าหลัง login (ภาพ 5.2 ฯลฯ) — รูปทรงเดียวกับตรา Logo แต่วาดเป็นเส้น
 *
 * สีของเส้นมาจาก currentColor → กำหนดด้วย class สีของธีม เช่น
 *   แผงม่วง:      <CalyxPattern className="text-accent opacity-[0.22]" strokeWidth={0.35} />
 *   ลายจางพื้นหลัง: <CalyxPattern className="text-brand opacity-[0.07]" strokeWidth={0.8} />
 */
import { useId } from 'react'

/** กลีบเลี้ยงชั้นนอก (กลีบใหญ่) — หมุน 0° / 120° / 240° (เหมือน Logo.tsx) */
const OUTER_SEPAL =
  'M24 22.4 C18.2 22.4 14.2 18.6 15 14.2 C15.8 10 19.2 6 24 5.2 C28.8 6 32.2 10 33 14.2 C33.8 18.6 29.8 22.4 24 22.4 Z'
/** กลีบเลี้ยงชั้นใน (กลีบเล็ก) — หมุน 60° / 180° / 300° */
const INNER_SEPAL =
  'M24 22.4 C18.8 22.4 15.3 19 16 15 C16.7 11.2 19.8 7.6 24 6.9 C28.2 7.6 31.3 11.2 32 15 C32.7 19 29.2 22.4 24 22.4 Z'
/** เส้นกลางกลีบของกลีบชั้นนอก */
const SEPAL_VEIN = 'M19 11.4 C20.3 9.2 22 8.1 24 7.9 C26 8.1 27.7 9.2 29 11.4'

const OUTER_ANGLES = [0, 120, 240]
const INNER_ANGLES = [60, 180, 300]
const rotate = (angle: number) => `rotate(${angle} 24 24)`

type CalyxPatternProps = {
  /** ความกว้าง/สูง (px) */
  size: number
  /** ความหนาเส้น (หน่วยในกรอบ 48×48) — แผงม่วง 0.35, ลายจางพื้นหลัง 0.8 (ตาม canvas) */
  strokeWidth: number
  className?: string
}

/** ลายกลีบเลี้ยงเส้นบาง */
export function CalyxPattern({ size, strokeWidth, className = '' }: CalyxPatternProps) {
  // id ของ mask ต้องไม่ซ้ำกันในหน้า
  const uid = useId()
  const maskInner = `${uid}-inner`
  const maskOuter = `${uid}-outer`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      className={className}
    >
      <defs>
        {/* กลีบชั้นใน: ซ่อนส่วนที่อยู่ใต้กลีบชั้นนอกและขั้วผล */}
        <mask id={maskInner} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          {OUTER_ANGLES.map((angle) => (
            <path key={angle} d={OUTER_SEPAL} transform={rotate(angle)} fill="#000" />
          ))}
          <circle cx="24" cy="24" r="6.2" fill="#000" />
        </mask>
        {/* กลีบชั้นนอก: ซ่อนส่วนที่อยู่ใต้ขั้วผล */}
        <mask id={maskOuter} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <circle cx="24" cy="24" r="6.2" fill="#000" />
        </mask>
      </defs>
      {/* ขอบผล */}
      <circle cx="24" cy="24" r="23.5" />
      <g transform="translate(24 24) scale(1.04) translate(-24 -24)">
        <g transform={rotate(-8)}>
          <g mask={`url(#${maskInner})`}>
            {INNER_ANGLES.map((angle) => (
              <path key={angle} d={INNER_SEPAL} transform={rotate(angle)} />
            ))}
          </g>
          <g mask={`url(#${maskOuter})`}>
            {OUTER_ANGLES.map((angle) => (
              <path key={angle} d={OUTER_SEPAL} transform={rotate(angle)} />
            ))}
            {OUTER_ANGLES.map((angle) => (
              <path key={`vein-${angle}`} d={SEPAL_VEIN} transform={rotate(angle)} />
            ))}
          </g>
          {/* ขั้วผล + รอยตัดก้าน */}
          <circle cx="24" cy="24" r="6.2" />
          <circle cx="24" cy="24" r="3.6" />
        </g>
      </g>
    </svg>
  )
}
