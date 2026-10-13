/**
 * หน้าตาของปุ่มแต่ละแบบ (class ของ Tailwind) — ใช้ร่วมกันระหว่าง <Button> และลิงก์ที่หน้าตาเหมือนปุ่ม
 * แยกจาก Button.tsx เพราะไฟล์ component ควร export แต่ component (กฎ react-refresh ของ ESLint)
 */

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger-text' | 'danger'

/** ส่วนที่ทุกแบบใช้ร่วมกัน: จัดกลาง, ตัวอักษรหนา, ไม่ตัดบรรทัด, กดไม่ได้เมื่อ disabled */
const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

/** focus ring ของปุ่ม: เส้นสีเขียว 2px ห่างจากปุ่ม 2px (ตาม canvas) — เห็นเมื่อใช้แป้นพิมพ์ */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** หน้าตาเฉพาะของแต่ละแบบ (hover ใช้ not-disabled: แทน enabled: เพื่อให้ใช้กับลิงก์ได้ด้วย — ลิงก์ไม่มีสถานะ enabled) */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'h-[46px] px-5 rounded-control bg-brand text-white text-[15px] ' +
    'not-disabled:hover:bg-brand-hover',
  secondary:
    'h-11 px-[18px] rounded-control border border-line-strong bg-surface text-brand text-[14.5px] ' +
    'not-disabled:hover:border-brand',
  text: 'h-10 px-2 bg-transparent text-brand text-[14.5px]',
  'danger-text': 'h-10 px-2 bg-transparent text-bad text-[14.5px]',
  // ปุ่มแดงทึบ (ขั้น 2.6): ปุ่มยืนยันการกระทำที่ย้อนยากในหน้าต่างยืนยัน เช่น "ระงับบัญชี"
  danger:
    'h-[46px] px-5 rounded-control bg-bad text-white text-[15px] ' +
    'not-disabled:hover:bg-bad-hover',
}

/**
 * class ของปุ่มแต่ละแบบ — ใช้กับสิ่งที่ไม่ใช่ <button> แต่ต้องหน้าตาเหมือนปุ่ม
 * เช่น ลิงก์ไปหน้าอื่น: <Link className={buttonClassName('secondary')} to="/profile">
 * (ลิงก์ที่พาไปหน้าอื่นต้องเป็น <a> เพื่อให้เปิดแท็บใหม่ได้และโปรแกรมอ่านหน้าจอบอกว่าเป็นลิงก์)
 */
export function buttonClassName(variant: ButtonVariant = 'primary'): string {
  return `${BASE} ${FOCUS} no-underline ${VARIANT_CLASSES[variant]}`
}
