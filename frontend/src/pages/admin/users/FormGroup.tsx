/**
 * กล่องจัดกลุ่มช่องกรอกของหน้าต่างเพิ่ม/แก้ไข/รีเซ็ต — ตาม board "เพิ่มผู้ใช้ (มือถือ)" (ขั้น 2.6)
 *
 *   มือถือ:  ┌─────────────────────────┐        จอใหญ่: ไม่มีกล่อง — ช่องกรอกเรียงต่อกันในหน้าต่าง
 *           │ (🪪) ข้อมูลผู้ใช้          │                (lg:contents = กล่องหายไป เหลือแต่ของข้างใน)
 *           │ [ชื่อ]   [นามสกุล]        │
 *           └─────────────────────────┘
 *
 * as="fieldset": ใช้กับกลุ่มตัวเลือก (บทบาท) — legend เป็นชื่อกลุ่มให้โปรแกรมอ่านหน้าจอ
 */
import type { ReactNode } from 'react'

type FormGroupProps = {
  /** หัวกล่องบนมือถือ */
  title: string
  /** ไอคอนในวงกลมหน้าหัวกล่อง */
  icon: ReactNode
  /** fieldset = กลุ่มตัวเลือก (หัวกล่องเป็นการตกแต่ง ชื่อกลุ่มอยู่ใน legend ของข้างใน) */
  as?: 'div' | 'fieldset'
  children: ReactNode
}

/** กล่องจัดกลุ่ม (มือถือเท่านั้น) */
export function FormGroup({ title, icon, as: Tag = 'div', children }: FormGroupProps) {
  return (
    <Tag
      className={
        'm-0 flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface px-4 pt-[18px] pb-5 ' +
        // จอใหญ่: กล่องหายไป ; fieldset ใช้ contents ไม่ได้ (legend จะเว้นระยะผิด) จึงแค่ลบกรอบ/พื้น/ขอบใน
        (Tag === 'fieldset'
          ? 'lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0'
          : 'lg:contents')
      }
    >
      {/* หัวกล่อง: fieldset ซ่อนจากโปรแกรมอ่านหน้าจอ (legend บอกชื่อกลุ่มแล้ว) */}
      <h3
        aria-hidden={Tag === 'fieldset' || undefined}
        className="m-0 flex items-center gap-2.5 font-display text-lg font-semibold lg:hidden"
      >
        <span className="flex size-[30px] items-center justify-center rounded-full bg-canvas text-brand">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </Tag>
  )
}
