/**
 * แสดงข้อความยาวแบบ Markdown (ขั้น 3.7 — ผู้ใช้เลือกแบบ ม1 ; ข้อตกลง "ข้อความยาว = Markdown แบบ sanitize")
 * ใช้ครั้งแรกกับคำอธิบายรายวิชา — ก้อน 4 ใช้ตัวเดียวกันกับเนื้อหาบทเรียน / ประกาศ
 *
 * ความปลอดภัย (ข้อความมาจากผู้ใช้):
 * - skipHtml: ทิ้ง HTML ดิบทั้งหมด (เช่น <script>, <img onerror>) — ไม่แสดงและไม่ทำงาน
 * - ลิงก์ที่ไม่ปลอดภัย (javascript: ฯลฯ) react-markdown ล้างให้เอง (urlTransform ค่าเริ่มต้น)
 * - ลิงก์เปิดแท็บใหม่ + rel="noopener noreferrer"
 *
 * หน้าตา: ใช้ token ของระบบ ; หัวข้อใน Markdown ทุกระดับแสดงเป็น h3 / h4 (หรือระดับที่กำหนดด้วย headingLevel)
 * (หน้าจอมี h1 / h2 ของตัวเองอยู่แล้ว — ไม่ให้ข้อความของผู้ใช้แทรกลำดับหัวข้อของหน้า)
 */
import type { ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'

/** ระดับหัวข้อที่ใช้แทน # / ## (ตัวรอง ### ลงไปใช้ระดับถัดไป) */
type HeadingBase = 3 | 4 | 5

/** หัวข้อหลักใน Markdown (# / ##) */
function MainHeading({ level, ...props }: ComponentProps<'h3'> & { level: HeadingBase }) {
  const Tag = `h${level}` as const
  return <Tag className="m-0 mt-2 font-display text-lg leading-[1.4] font-semibold text-ink" {...props} />
}

/** หัวข้อรองใน Markdown (### ลงไป) — ไม่เกิน h6 */
function SubHeading({ level, ...props }: ComponentProps<'h4'> & { level: HeadingBase }) {
  const Tag = `h${Math.min(level + 1, 6) as 4 | 5 | 6}` as const
  return <Tag className="m-0 mt-1 text-base leading-normal font-semibold text-ink" {...props} />
}

/** ตัด node (ข้อมูลภายในของ react-markdown) ออก ไม่ให้หลุดลงเป็น attribute ของ DOM */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const { node, ...rest } = props
  void node
  return rest
}

/** หัวข้อทุกระดับของ Markdown → หัวข้อของหน้าตามระดับที่กำหนด */
function headingComponents(level: HeadingBase): Components {
  return {
    h1: (props) => <MainHeading level={level} {...withoutNode(props)} />,
    h2: (props) => <MainHeading level={level} {...withoutNode(props)} />,
    h3: (props) => <SubHeading level={level} {...withoutNode(props)} />,
    h4: (props) => <SubHeading level={level} {...withoutNode(props)} />,
    h5: (props) => <SubHeading level={level} {...withoutNode(props)} />,
    h6: (props) => <SubHeading level={level} {...withoutNode(props)} />,
  }
}

/** แต่ละส่วนของ Markdown → element พร้อม class ของระบบ (ไม่ส่ง node ต่อลง DOM) */
const COMPONENTS: Components = {
  p: (props) => <p className="m-0" {...withoutNode(props)} />,
  ul: (props) => <ul className="m-0 list-disc pl-6" {...withoutNode(props)} />,
  ol: (props) => <ol className="m-0 list-decimal pl-6" {...withoutNode(props)} />,
  li: (props) => <li className="pl-0.5" {...withoutNode(props)} />,
  strong: (props) => <strong className="font-semibold text-ink" {...withoutNode(props)} />,
  a: (props) => (
    <a
      className="font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
      target="_blank"
      rel="noopener noreferrer"
      {...withoutNode(props)}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="m-0 border-l-[3px] border-line-strong pl-3.5 text-ink-muted"
      {...withoutNode(props)}
    />
  ),
  code: (props) => (
    <code className="rounded-md bg-canvas px-1.5 py-px text-[0.92em]" {...withoutNode(props)} />
  ),
  // บล็อกโค้ด: code ข้างในไม่ใช้พื้น / ระยะของโค้ดในบรรทัด (เดิมบรรทัดแรกถูกดันเข้าไป 1 ช่อง — พบในขั้น 4.7)
  pre: (props) => (
    <pre
      className="m-0 overflow-x-auto rounded-[10px] bg-canvas px-4 py-3 text-sm leading-[1.6] [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[1em]"
      {...withoutNode(props)}
    />
  ),
  hr: () => <hr className="m-0 border-0 border-t border-line" />,
}

type MarkdownProps = {
  /** ข้อความ Markdown ที่ผู้ใช้กรอก */
  text: string
  className?: string
  /**
   * ระดับหัวข้อของ # / ## (ค่าเริ่มต้น 3) — ให้ต่ำกว่าหัวข้อของหน้าที่ครอบข้อความนี้อยู่
   * เช่น หน้าบทเรียน: คำอธิบายหน่วย (ใต้ h3) ใช้ 4, เนื้อหา (ใต้ h4) ใช้ 5 (แก้หลังตรวจขั้น 4.7 ก)
   */
  headingLevel?: HeadingBase
}

/** ชุด element ต่อระดับหัวข้อ (สร้างครั้งเดียว) */
const COMPONENTS_BY_LEVEL: Record<HeadingBase, Components> = {
  3: { ...COMPONENTS, ...headingComponents(3) },
  4: { ...COMPONENTS, ...headingComponents(4) },
  5: { ...COMPONENTS, ...headingComponents(5) },
}

/** ข้อความ Markdown แบบปลอดภัย */
export function Markdown({ text, className = '', headingLevel = 3 }: MarkdownProps) {
  return (
    <div className={`flex flex-col gap-2.5 text-[15px] leading-[1.7] break-words ${className}`}>
      <ReactMarkdown skipHtml components={COMPONENTS_BY_LEVEL[headingLevel]}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
