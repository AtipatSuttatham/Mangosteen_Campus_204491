/**
 * แสดงข้อความยาวแบบ Markdown (ขั้น 3.7 — ผู้ใช้เลือกแบบ ม1 ; ข้อตกลง "ข้อความยาว = Markdown แบบ sanitize")
 * ใช้ครั้งแรกกับคำอธิบายรายวิชา — ก้อน 4 ใช้ตัวเดียวกันกับเนื้อหาบทเรียน / ประกาศ
 *
 * ความปลอดภัย (ข้อความมาจากผู้ใช้):
 * - skipHtml: ทิ้ง HTML ดิบทั้งหมด (เช่น <script>, <img onerror>) — ไม่แสดงและไม่ทำงาน
 * - ลิงก์ที่ไม่ปลอดภัย (javascript: ฯลฯ) react-markdown ล้างให้เอง (urlTransform ค่าเริ่มต้น)
 * - ลิงก์เปิดแท็บใหม่ + rel="noopener noreferrer"
 *
 * หน้าตา: ใช้ token ของระบบ ; หัวข้อใน Markdown ทุกระดับแสดงเป็น h3 / h4
 * (หน้าจอมี h1 / h2 ของตัวเองอยู่แล้ว — ไม่ให้ข้อความของผู้ใช้แทรกลำดับหัวข้อของหน้า)
 */
import type { ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'

/** หัวข้อ: # และ ## เป็น h3 ; ### ลงไปเป็น h4 */
const H3 = (props: ComponentProps<'h3'>) => (
  <h3 className="m-0 mt-2 font-display text-lg leading-[1.4] font-semibold text-ink" {...props} />
)
const H4 = (props: ComponentProps<'h4'>) => (
  <h4 className="m-0 mt-1 text-base leading-normal font-semibold text-ink" {...props} />
)

/** ตัด node (ข้อมูลภายในของ react-markdown) ออก ไม่ให้หลุดลงเป็น attribute ของ DOM */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const { node, ...rest } = props
  void node
  return rest
}

/** แต่ละส่วนของ Markdown → element พร้อม class ของระบบ (ไม่ส่ง node ต่อลง DOM) */
const COMPONENTS: Components = {
  h1: (props) => <H3 {...withoutNode(props)} />,
  h2: (props) => <H3 {...withoutNode(props)} />,
  h3: (props) => <H4 {...withoutNode(props)} />,
  h4: (props) => <H4 {...withoutNode(props)} />,
  h5: (props) => <H4 {...withoutNode(props)} />,
  h6: (props) => <H4 {...withoutNode(props)} />,
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
  pre: (props) => (
    <pre className="m-0 overflow-x-auto rounded-[10px] bg-canvas px-4 py-3 text-sm" {...withoutNode(props)} />
  ),
  hr: () => <hr className="m-0 border-0 border-t border-line" />,
}

type MarkdownProps = {
  /** ข้อความ Markdown ที่ผู้ใช้กรอก */
  text: string
  className?: string
}

/** ข้อความ Markdown แบบปลอดภัย */
export function Markdown({ text, className = '' }: MarkdownProps) {
  return (
    <div className={`flex flex-col gap-2.5 text-[15px] leading-[1.7] break-words ${className}`}>
      <ReactMarkdown skipHtml components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
