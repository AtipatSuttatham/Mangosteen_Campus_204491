/**
 * ส่วน "บทเรียน" ในหน้ารายวิชาของผู้เรียน (ขั้น 4.7 ก — board "บทเรียนของผู้เรียน" จอใหญ่ + มือถือ)
 *
 *   บทเรียน
 *   4 หน่วย
 *   ┌ › ① ก้าวแรกกับ Python            ┐  ← หัวหน่วยเป็นปุ่มจริง (aria-expanded) อยู่ใน h3
 *   │     3 รายการ                     │
 *   ├ ˅ ③ โครงสร้างควบคุมทิศทาง          ┤  ← เปิดอยู่
 *   │     คำอธิบายหน่วย                  │
 *   │     [เนื้อหาเรียงต่อกันแบบหน้าบทเรียน] │  ← ContentView (ส่วนแสดงผลกลาง) ; หัวข้อเนื้อหาเป็น h4
 *   └──────────────────────────────────┘
 *
 * - ทุกหน่วยพับตอนเข้าหน้า เปิดได้หลายหน่วยพร้อมกัน ไม่จำค่า (ผู้ใช้เลือกแบบ ขข2)
 * - หน่วยที่ยังไม่มีเนื้อหาเผยแพร่ยังแสดง (กฝ1) — หัวบอก "ยังไม่มีเนื้อหา"
 * - พับแล้วไม่วาดเนื้อหา (วิดีโอที่กำลังเล่นหยุดไปด้วย)
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudentModule } from '../../../api/content'
import { Markdown } from '../../../components/ui'
import { ToggleIcon } from '../content/contentIcons'
import { ContentView } from './ContentView'

/** รายการหน่วยทั้งหมด (มีอย่างน้อย 1 หน่วย — ไม่มีเลยหน้าใช้กล่อง "ยังไม่มีเนื้อหา" เดิม) */
export function LessonModules({ modules }: { modules: StudentModule[] }) {
  const { t } = useTranslation()
  const [openIds, setOpenIds] = useState<ReadonlySet<number>>(() => new Set())

  const toggle = (moduleId: number) =>
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })

  return (
    <section className="flex flex-col">
      <h2 className="m-0 font-display text-xl font-semibold lg:text-[22px]">{t('lesson.heading')}</h2>
      <p className="m-0 mt-0.5 text-sm text-ink-muted">
        {t('lesson.moduleCount', { count: modules.length })}
      </p>
      <ol className="m-0 mt-3.5 flex list-none flex-col gap-2.5 p-0">
        {modules.map((module, index) => (
          <LessonModule
            key={module.id}
            module={module}
            number={index + 1}
            open={openIds.has(module.id)}
            onToggle={() => toggle(module.id)}
          />
        ))}
      </ol>
    </section>
  )
}

type LessonModuleProps = { module: StudentModule; number: number; open: boolean; onToggle: () => void }

/** หน่วย 1 หน่วย: หัว (พับ / เปิด) + คำอธิบาย + เนื้อหาเรียงต่อกัน */
function LessonModule({ module, number, open, onToggle }: LessonModuleProps) {
  const { t } = useTranslation()
  const bodyId = useId()
  const count = module.contents.length

  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface">
      <h3 className="m-0 px-2 py-2 text-base font-normal lg:py-2.5 lg:pr-4 lg:pl-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className={
            'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent ' +
            'px-1.5 text-left text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 ' +
            'focus-visible:outline-accent'
          }
        >
          <span className="flex shrink-0 text-brand">
            <ToggleIcon open={open} />
          </span>
          <span
            aria-hidden="true"
            className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-canvas font-display text-base font-semibold text-brand"
          >
            {number}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[17px] leading-[1.35] font-semibold break-words lg:text-lg">
              {module.title}
            </span>
            <span className="block text-[13.5px] font-normal text-ink-muted">
              {count > 0 ? t('lesson.itemCount', { count }) : t('lesson.noItems')}
            </span>
          </span>
        </button>
      </h3>

      {open && (
        <div
          id={bodyId}
          className="border-t border-line-soft px-3.5 pt-1.5 pb-5 lg:pr-7 lg:pb-6 lg:pl-[66px]"
        >
          {module.description && (
            // หัวข้อในคำอธิบายเริ่มที่ h4 (อยู่ใต้ชื่อหน่วย h3)
            <Markdown
              text={module.description}
              headingLevel={4}
              className="mt-2 mb-1.5 text-sm! text-ink-muted"
            />
          )}
          {count > 0 ? (
            <div className="flex flex-col gap-[22px] pt-1.5 pb-1">
              {module.contents.map((content) => (
                <ContentView key={content.id} content={content} />
              ))}
            </div>
          ) : (
            <p className="m-0 py-3 text-sm text-ink-muted">{t('lesson.moduleEmpty')}</p>
          )}
        </div>
      )}
    </li>
  )
}
