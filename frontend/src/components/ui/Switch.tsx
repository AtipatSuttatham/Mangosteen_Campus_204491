/**
 * สวิตช์เปิด / ปิด (ตาม .sw ใน board — ใช้ครั้งแรกในแท็บตั้งค่า "เปิดใช้รหัสเข้าร่วม" ขั้น 3.6)
 * ย้ายมาเป็นคอมโพเนนต์กลางในขั้น 4.6 เพื่อใช้ซ้ำกับ "ให้ผู้เรียนดาวน์โหลดได้" ในหน้าต่างแก้ไขเนื้อหา
 *
 * - เป็นปุ่มจริง role="switch" + aria-checked — กด Space / Enter ได้ โปรแกรมอ่านหน้าจอบอก "เปิด / ปิด"
 * - ชื่อของสวิตช์มาจากข้อความข้าง ๆ (labelledBy = id ของข้อความนั้น) ; คำอธิบายเพิ่ม (describedBy) ไม่บังคับ
 */
export function Switch({
  checked,
  labelledBy,
  describedBy,
  disabled = false,
  onChange,
}: {
  checked: boolean
  labelledBy: string
  describedBy?: string
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onChange}
      className={
        'relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-0 p-0 disabled:cursor-not-allowed ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
        (checked ? 'bg-brand' : 'bg-line-strong')
      }
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] size-[22px] rounded-full bg-surface ${checked ? 'left-[23px]' : 'left-[3px]'}`}
      />
    </button>
  )
}
