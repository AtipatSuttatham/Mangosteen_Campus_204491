/**
 * แถบขั้นตอน 1-2-3 ของหน้านำเข้า CSV — หน้าตาตาม .step / .stepline ใน board "นำเข้า CSV" (ขั้น 2.7)
 *
 *   (✓) เลือกไฟล์ ──── (2) ตรวจข้อมูล ──── (3) รับรหัสผ่าน
 *    ผ่านแล้ว: วงกลมเขียวอ่อน ✓    ขั้นปัจจุบัน: วงกลมม่วงทึบ + ตัวหนา    ยังไม่ถึง: วงกลมขอบเทา
 *
 * มือถือ: ชื่อขั้นที่ยังไม่ถึง/ผ่านแล้วซ่อนไว้ (เหลือแต่วงกลม) — ชื่อขั้นปัจจุบันยังเห็น ;
 * โปรแกรมอ่านหน้าจอได้ชื่อครบทุกขั้น + "ขั้นปัจจุบัน" (aria-current) + "(เสร็จแล้ว)"
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon } from '../icons'

/** ขั้นปัจจุบัน: 1 เลือกไฟล์ / 2 ตรวจข้อมูล / 3 รับรหัสผ่าน */
export type ImportStep = 1 | 2 | 3

const STEPS = ['csvImport.stepChoose', 'csvImport.stepReview', 'csvImport.stepPasswords'] as const

export function ImportStepper({ current }: { current: ImportStep }) {
  const { t } = useTranslation()
  return (
    <ol
      aria-label={t('csvImport.stepsLabel')}
      className="m-0 flex max-w-[640px] list-none items-center gap-2.5 p-0 lg:gap-3.5"
    >
      {STEPS.map((key, index) => {
        const number = index + 1
        const state = number < current ? 'done' : number === current ? 'on' : 'todo'
        return (
          <Fragment key={key}>
            {index > 0 && <li aria-hidden="true" className="h-px min-w-6 flex-1 bg-line-strong" />}
            <li
              aria-current={state === 'on' ? 'step' : undefined}
              className={
                'flex items-center gap-2.5 text-[15px] whitespace-nowrap ' +
                (state === 'on' ? 'font-semibold text-ink' : 'text-ink-muted')
              }
            >
              <span
                className={
                  'flex size-[30px] shrink-0 items-center justify-center rounded-full border font-display text-[15px] font-semibold ' +
                  (state === 'on'
                    ? 'border-brand bg-brand text-white'
                    : state === 'done'
                      ? 'border-ok-soft bg-ok-soft text-ok'
                      : 'border-line-strong bg-surface text-ink-muted')
                }
              >
                {state === 'done' ? <CheckIcon size={16} /> : number}
              </span>
              <span className={state === 'on' ? undefined : 'max-sm:sr-only'}>
                {t(key)}
                {state === 'done' && <span className="sr-only"> {t('csvImport.stepDone')}</span>}
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
