/**
 * ตราสัญลักษณ์ของระบบ: กลีบเลี้ยงมังคุด (คัดลอกรูปทรงจาก board "BrandLogo" ใน design canvas)
 *
 * ส่วนประกอบของตรา (มองผลมังคุดจากด้านบน):
 *   - วงกลมสีม่วงเข้ม = ตัวผล มีเส้นขอบชมพูอ่อนให้เห็นชัดบนพื้นสีม่วง + แสงสะท้อนด้านซ้ายบน
 *   - กลีบเลี้ยงชั้นใน 3 กลีบ (เล็ก) อยู่ใต้กลีบเลี้ยงชั้นนอก 3 กลีบ (ใหญ่ มีเส้นกลางกลีบ)
 *   - วงกลมตรงกลาง = ขั้วผล มีรอยตัดของก้าน
 * ใช้ได้ทั้งบนพื้นเข้ม (sidebar สีม่วง) และพื้นสว่าง — รูปทรงและสีเหมือนกันทุกแบบ
 *
 * ขนาดตาม canvas: 34px (แถบเมนู), 48px (ทั่วไป) หรือกำหนดเองผ่าน size
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

/** กลีบเลี้ยงชั้นนอก (กลีบใหญ่) — วาดซ้ำ 3 ครั้งโดยหมุน 0° / 120° / 240° */
const OUTER_SEPAL =
  'M24 22.4 C18.2 22.4 14.2 18.6 15 14.2 C15.8 10 19.2 6 24 5.2 C28.8 6 32.2 10 33 14.2 C33.8 18.6 29.8 22.4 24 22.4 Z'
/** กลีบเลี้ยงชั้นใน (กลีบเล็ก) — วาดซ้ำ 3 ครั้งโดยหมุน 60° / 180° / 300° (แทรกระหว่างกลีบนอก) */
const INNER_SEPAL =
  'M24 22.4 C18.8 22.4 15.3 19 16 15 C16.7 11.2 19.8 7.6 24 6.9 C28.2 7.6 31.3 11.2 32 15 C32.7 19 29.2 22.4 24 22.4 Z'
/** เส้นกลางกลีบของกลีบชั้นนอก (ตัดเป็นร่องบาง ๆ) */
const SEPAL_VEIN = 'M19 11.4 C20.3 9.2 22 8.1 24 7.9 C26 8.1 27.7 9.2 29 11.4'

const OUTER_ANGLES = [0, 120, 240]
const INNER_ANGLES = [60, 180, 300]

/** หมุนรอบจุดกึ่งกลางของตรา (24, 24) */
const rotate = (angle: number) => `rotate(${angle} 24 24)`

type LogoProps = {
  /** ความกว้าง/สูงของตรา (px) — ค่าเริ่มต้น 48 */
  size?: number
  /** แสดงชื่อระบบ "Mangosteen Campus" ข้างตราด้วยหรือไม่ */
  withWordmark?: boolean
  /** สีของชื่อระบบ: onLight = ตัวอักษรเข้ม (พื้นสว่าง), onDark = ตัวอักษรขาว (พื้นสีม่วง) */
  tone?: 'onLight' | 'onDark'
  /** ขนาดชื่อระบบ: sm = 17px (sidebar), md = 20px (หน้าเข้าสู่ระบบ) — ตาม canvas */
  wordmarkSize?: 'sm' | 'md'
  className?: string
}

/** ตรากลีบเลี้ยงมังคุด (+ ชื่อระบบ ถ้าต้องการ) */
export function Logo({
  size = 48,
  withWordmark = false,
  tone = 'onLight',
  wordmarkSize = 'md',
  className = '',
}: LogoProps) {
  const { t } = useTranslation()
  // รหัสเฉพาะของ mask แต่ละชุด — กันชนกันเมื่อมีโลโก้หลายตัวในหน้าเดียว
  const id = useId().replace(/:/g, '')
  const maskOuter = `logo-outer-${id}`
  const maskInner = `logo-inner-${id}`
  const maskStem = `logo-stem-${id}`
  const name = t('app.name')

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="#9DBB8F"
      // มีชื่อระบบแสดงอยู่แล้ว → ตราเป็นแค่การตกแต่ง ; ไม่มีชื่อ → ตราต้องมีชื่อเรียกให้โปรแกรมอ่านหน้าจอ
      {...(withWordmark ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
      className="shrink-0"
    >
      <defs>
        {/* mask ของกลีบชั้นนอก: ตัดเส้นกลางกลีบ และเว้นวงกลมตรงกลางให้ขั้วผล */}
        <mask id={maskOuter} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          {OUTER_ANGLES.map((angle) => (
            <path
              key={angle}
              d={SEPAL_VEIN}
              transform={rotate(angle)}
              fill="none"
              stroke="#000"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          ))}
          <circle cx="24" cy="24" r="7.7" fill="#000" />
        </mask>
        {/* mask ของกลีบชั้นใน: ซ่อนส่วนที่อยู่ใต้กลีบชั้นนอก (เว้นช่องไฟเล็กน้อยให้เห็นการซ้อน) */}
        <mask id={maskInner} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          {OUTER_ANGLES.map((angle) => (
            <path
              key={angle}
              d={OUTER_SEPAL}
              transform={rotate(angle)}
              fill="#000"
              stroke="#000"
              strokeWidth="2"
            />
          ))}
          <circle cx="24" cy="24" r="7.7" fill="#000" />
        </mask>
        {/* mask ของขั้วผล: รอยตัดวงกลมของก้าน */}
        <mask id={maskStem} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <circle cx="24" cy="24" r="3.6" fill="none" stroke="#000" strokeWidth="0.9" />
        </mask>
      </defs>

      {/* ตัวผล: วงกลมม่วงเข้ม + เส้นขอบชมพูอ่อน + แสงสะท้อน */}
      <circle cx="24" cy="24" r="23.5" fill="#3F1636" />
      <circle cx="24" cy="24" r="22.9" fill="none" stroke="#DCC4D3" strokeWidth="1.2" />
      <path
        d="M4.99 16.86 A20.5 20.5 0 0 1 15.39 5.35"
        fill="none"
        stroke="#7A3A6B"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* กลีบเลี้ยงและขั้วผล (ขยายเล็กน้อยและเอียง -8° ตาม canvas) */}
      <g transform="translate(24 24) scale(1.04) translate(-24 -24)">
        <g fill="#9DBB8F" transform={rotate(-8)}>
          <g mask={`url(#${maskInner})`}>
            {INNER_ANGLES.map((angle) => (
              <path key={angle} d={INNER_SEPAL} transform={rotate(angle)} />
            ))}
          </g>
          <g mask={`url(#${maskOuter})`}>
            {OUTER_ANGLES.map((angle) => (
              <path key={angle} d={OUTER_SEPAL} transform={rotate(angle)} />
            ))}
          </g>
          <circle cx="24" cy="24" r="6.2" mask={`url(#${maskStem})`} />
        </g>
      </g>
    </svg>
  )

  if (!withWordmark) {
    return <span className={`inline-flex ${className}`}>{mark}</span>
  }

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {mark}
      {/* ชื่อระบบ: ฟอนต์หัวข้อ (Taviraj) ตัวหนาปานกลาง ตาม canvas */}
      <span
        className={
          'font-display font-semibold whitespace-nowrap ' +
          `${wordmarkSize === 'sm' ? 'text-[17px]' : 'text-xl'} ` +
          `${tone === 'onDark' ? 'text-white' : 'text-ink'}`
        }
      >
        {name}
      </span>
    </span>
  )
}
