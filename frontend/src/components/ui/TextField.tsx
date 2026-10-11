/**
 * ช่องกรอกข้อความพร้อมป้ายชื่อ — หน้าตาตาม class .inp และหน้า "เข้าสู่ระบบ (กรอกผิด)" ใน design canvas
 *
 *   ป้ายชื่อ (ตัวหนา 15px)
 *   ┌──────────────────────────┐   ← สูง 46px ขอบเทา มุมโค้ง 8px ; กดแล้วมีกรอบม่วง
 *   └──────────────────────────┘
 *   ⓘ ข้อความ error (สีแดง)        ← แสดงเมื่อส่ง error มา + ขอบช่องเป็นสีแดง
 *
 * การเข้าถึง: ป้ายชื่อผูกกับช่องกรอก (กดป้ายแล้วไปที่ช่อง) ; ตอนมี error ช่องถูกทำเครื่องหมาย
 * aria-invalid และโปรแกรมอ่านหน้าจอจะอ่านข้อความ error ให้
 *
 * ใช้เหมือน <input> ปกติทุกอย่าง (value, onChange, type, autoComplete, ref ...)
 * — ส่ง ref ได้ จึงใช้กับ React Hook Form ได้ตรง ๆ: <TextField {...register('email')} />
 *
 * ตัวเลือกเพิ่ม (ขั้น 1.5 — ตาม board "เข้าสู่ระบบ (กรอกผิด)"):
 *   - invalid: ขอบแดงโดยไม่มีข้อความของตัวเอง — ใช้เมื่อข้อความ error เดียวครอบหลายช่อง
 *     (ช่องรหัสและช่องรหัสผ่านแดงทั้งคู่ แต่ข้อความอยู่ใต้ช่องรหัสผ่านช่องเดียว)
 *   - errorDescribedBy: id ของข้อความ error ที่อยู่นอกช่องนี้ (ให้โปรแกรมอ่านหน้าจออ่านด้วย)
 *   - trailing: ปุ่มที่วางไว้ด้านขวาในช่อง เช่น ปุ่ม "แสดง" ของช่องรหัสผ่าน
 * ตัวเลือกเพิ่ม (ขั้น 1.8 — ตามหน้าข้อมูลส่วนตัว):
 *   - hint: คำแนะนำสีรองใต้ช่อง เช่น กฎรหัสผ่าน — ซ่อนเมื่อมี error (error แทนที่ตำแหน่งเดียวกัน)
 */
import { useId, type ComponentProps, type ReactNode } from 'react'

type TextFieldProps = ComponentProps<'input'> & {
  /** ป้ายชื่อของช่อง (ข้อความจาก th.ts) */
  label: string
  /** ข้อความ error ใต้ช่อง (ข้อความจาก th.ts เช่น ผลของ fieldErrorMessage) — ไม่มี = ช่องปกติ */
  error?: string
  /** ขอบแดงโดยไม่มีข้อความของตัวเอง (ข้อความอยู่ที่ช่องอื่น) */
  invalid?: boolean
  /** id ของข้อความ error ที่อยู่นอกช่องนี้ */
  errorDescribedBy?: string
  /** ปุ่มที่วางไว้ด้านขวาในช่อง (เช่น ปุ่ม "แสดง" รหัสผ่าน) */
  trailing?: ReactNode
  /** คำแนะนำใต้ช่อง (ข้อความจาก th.ts) */
  hint?: string
}

/** ช่องกรอกข้อความพร้อมป้ายชื่อ และข้อความ error (ถ้ามี) */
export function TextField({
  label,
  error,
  invalid = false,
  errorDescribedBy,
  trailing,
  hint,
  id,
  className = '',
  ...props
}: TextFieldProps) {
  // รหัสของช่อง (ใช้ผูกป้ายชื่อและข้อความ error) — ใช้ id ที่ส่งมา หรือสร้างใหม่ให้ไม่ซ้ำ
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const hasError = Boolean(error)
  // คำแนะนำแสดงเฉพาะตอนไม่มี error
  const showHint = Boolean(hint) && !hasError
  // ขอบแดงเมื่อมีข้อความ error ของตัวเอง หรือถูกบอกว่า invalid
  const showInvalid = hasError || invalid
  // ข้อความที่โปรแกรมอ่านหน้าจอต้องอ่านคู่กับช่องนี้
  const describedBy = [
    hasError ? errorId : undefined,
    showHint ? hintId : undefined,
    errorDescribedBy,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-[15px] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={showInvalid || undefined}
          aria-describedby={describedBy || undefined}
          className={
            'h-[46px] w-full rounded-control border bg-surface px-3.5 text-[15px] text-ink ' +
            // กดที่ช่อง → กรอบม่วง 2px ห่างจากขอบ 1px (ตาม canvas)
            'focus:outline-2 focus:outline-offset-1 focus:outline-brand ' +
            (showInvalid ? 'border-danger' : 'border-line-strong') +
            // เว้นที่ด้านขวาให้ปุ่มในช่อง (ตาม canvas: padding-right 72px)
            (trailing ? ' pr-[72px]' : '')
          }
          {...props}
        />
        {trailing && <div className="absolute top-[3px] right-1">{trailing}</div>}
      </div>
      {showHint && (
        <p id={hintId} className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
          {hint}
        </p>
      )}
      {hasError && (
        // role="alert" = โปรแกรมอ่านหน้าจออ่านข้อความนี้ทันทีที่ปรากฏ
        <div
          id={errorId}
          role="alert"
          className="mt-0.5 flex items-start gap-2 text-[14.5px] leading-[1.55] text-danger"
        >
          {/* ไอคอน ⓘ (ตกแต่งอย่างเดียว) */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-px shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5v.5" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
