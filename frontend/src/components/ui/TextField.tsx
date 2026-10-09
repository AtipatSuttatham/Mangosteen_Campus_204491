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
 * ใช้เหมือน <input> ปกติทุกอย่าง (value, onChange, type, autoComplete ...)
 */
import { useId, type InputHTMLAttributes } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** ป้ายชื่อของช่อง (ข้อความจาก th.ts) */
  label: string
  /** ข้อความ error ใต้ช่อง (ข้อความจาก th.ts เช่น ผลของ fieldErrorMessage) — ไม่มี = ช่องปกติ */
  error?: string
}

/** ช่องกรอกข้อความพร้อมป้ายชื่อ และข้อความ error (ถ้ามี) */
export function TextField({ label, error, id, className = '', ...props }: TextFieldProps) {
  // รหัสของช่อง (ใช้ผูกป้ายชื่อและข้อความ error) — ใช้ id ที่ส่งมา หรือสร้างใหม่ให้ไม่ซ้ำ
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const hasError = Boolean(error)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-[15px] font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={
          'h-[46px] w-full rounded-control border bg-surface px-3.5 text-[15px] text-ink ' +
          // กดที่ช่อง → กรอบม่วง 2px ห่างจากขอบ 1px (ตาม canvas)
          'focus:outline-2 focus:outline-offset-1 focus:outline-brand ' +
          (hasError ? 'border-danger' : 'border-line-strong')
        }
        {...props}
      />
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
