/**
 * จัดรหัสวิชาให้พอดีป้าย CourseBadge (ขั้น 3.6 รอบ 3 — ผู้ใช้เลือกแบบ ต1 ; board "ป้ายรหัสวิชาเมื่อรหัสยาว")
 *
 *   ไม่เกิน 6 ตัว  → บรรทัดเดียว ขนาดตัวอักษรเดิม
 *   7–9 ตัว       → บรรทัดเดียว ตัวอักษรเล็กลงจนพอดีป้าย
 *   10–20 ตัว     → 2 บรรทัด ตัดที่ขีด (-) ที่ใกล้กลางที่สุด ถ้าไม่มีขีดตัดครึ่ง
 *
 * ป้ายมีขนาดคงที่ทุกที่ (แถวรายวิชาเรียงตรงกัน) จึงปรับที่ตัวอักษรแทน — ไม่ตัดตัวอักษรทิ้ง
 */

export type BadgeTextSize = 'lg' | 'md' | 'sm'

/** ความกว้างป้าย / ระยะขอบซ้ายขวา / ตัวอักษรตั้งต้น / ตัวอักษรเล็กสุด (px) ของแต่ละขนาด */
const METRICS: Record<BadgeTextSize, { width: number; pad: number; base: number; min: number }> = {
  lg: { width: 112, pad: 9, base: 22, min: 12 },
  md: { width: 84, pad: 7, base: 16.5, min: 9.5 },
  sm: { width: 66, pad: 5, base: 13.5, min: 8.5 },
}

/** ความกว้างเฉลี่ยของตัวอักษร Taviraj (ตัวพิมพ์ใหญ่ / ตัวเลข) เทียบกับขนาดตัวอักษร — เผื่อไว้เล็กน้อย */
const CHAR_WIDTH = 0.66

/** รหัสที่ยาวตั้งแต่เท่านี้แบ่งเป็น 2 บรรทัด */
const TWO_LINES_FROM = 10

/** แบ่งรหัสเป็นบรรทัด (1 หรือ 2 บรรทัด) */
export function badgeLines(code: string): string[] {
  if (code.length < TWO_LINES_FROM) return [code]
  const middle = code.length / 2
  // ขีดที่ใกล้กลางที่สุด — ใช้เมื่อห่างจากกลางไม่เกิน 4 ตัว (ไม่งั้นบรรทัดหนึ่งยาวเกินไป)
  let best = -1
  for (let index = 0; index < code.length; index += 1) {
    if (code[index] === '-' && (best < 0 || Math.abs(index - middle) < Math.abs(best - middle))) best = index
  }
  if (best >= 0 && Math.abs(best - middle) <= 4) {
    return [code.slice(0, best + 1), code.slice(best + 1)]
  }
  const cut = Math.ceil(middle)
  return [code.slice(0, cut), code.slice(cut)]
}

/** ขนาดตัวอักษร (px) ที่ทำให้บรรทัดที่ยาวที่สุดพอดีป้าย — ไม่ใหญ่กว่าขนาดตั้งต้น ไม่เล็กกว่าขนาดเล็กสุด */
export function badgeFontSize(lines: string[], size: BadgeTextSize): number {
  const { width, pad, base, min } = METRICS[size]
  const longest = Math.max(...lines.map((line) => line.length))
  const fit = (width - 2 * pad) / (longest * CHAR_WIDTH)
  return Math.round(Math.max(min, Math.min(base, fit)) * 10) / 10
}
