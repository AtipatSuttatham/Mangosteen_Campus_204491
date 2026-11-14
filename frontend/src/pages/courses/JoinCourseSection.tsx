/**
 * ส่วน "เข้าร่วมรายวิชาด้วยรหัส" ในหน้ารายวิชาของฉันของผู้เรียน (UC-15 — ขั้น 3.7)
 * หน้าตาตาม board "รายวิชาของฉัน (ผู้เรียน)" + "มือถือ — กรอกรหัสผิด" แถวก้อน 3
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ (+) เข้าร่วมรายวิชาด้วยรหัส                              ⌄ │  ← ปุ่มพับ/เปิด (ใน h2)
 *   │   กรอกรหัสเข้าร่วม 8 ตัวที่ได้รับจากผู้สอน (ไม่ใช่รหัสวิชา)    │
 *   │   [ K 7 Q 2 X M 9 A        ]  [เข้าร่วมรายวิชา]               │  ← มือถือเรียงลง
 *   │   ใช้รหัสนี้เข้าร่วมไม่ได้ ตรวจรหัสกับผู้สอนอีกครั้ง              │  ← ข้อความผิด (ช่องขอบแดง)
 *   └───────────────────────────────────────────────────────────┘
 *
 * - การพับ/เปิดควบคุมจากหน้า (open / onToggle) — หน้าจำค่าในเบราว์เซอร์และบังคับเปิดเมื่อกรอกผิด
 * - ช่องรหัส: แปลงเป็นตัวพิมพ์ใหญ่ ตัดช่องว่าง / ขีด ไม่เกิน 8 ตัว ; ปุ่มกดได้เมื่อครบ 8 ตัว
 *   (backend รับตัวพิมพ์เล็กได้และตรวจซ้ำเสมอ — ส่วนนี้แค่ช่วยให้กรอกง่าย)
 * - ไม่ผ่านทุกกรณีได้ข้อความเดียว (join_code_invalid) — กันการเดารหัสแล้วรู้ข้อมูลวิชา
 */
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { joinCourse, type JoinResult } from '../../api/courses'
import { errorMessage } from '../../api/errors'
import { Button } from '../../components/ui'
import { PlusIcon } from './icons'

/** ความยาวรหัสเข้าร่วม (ตรงกับ backend) */
const CODE_LENGTH = 8

/** ทำความสะอาดรหัสที่พิมพ์ / วาง: ตัวพิมพ์ใหญ่ ไม่มีช่องว่างหรือขีด */
function cleanJoinCode(text: string): string {
  return text.toUpperCase().replace(/[\s-]/g, '').slice(0, CODE_LENGTH)
}

type JoinCourseSectionProps = {
  open: boolean
  onToggle: () => void
  /** เข้าร่วมสำเร็จ (หรืออยู่แล้ว) — หน้าแสดงแถบข้อความและโหลดรายการใหม่ */
  onJoined: (result: JoinResult) => void
  /** กรอกไม่ผ่าน — หน้าบังคับเปิดส่วนนี้ค้างไว้ */
  onFailed: () => void
}

/** ลูกศร ⌄ ท้ายหัว (หมุนเมื่อพับ) */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={
        'ml-auto shrink-0 text-brand motion-safe:transition-transform motion-safe:duration-150 ' +
        (open ? '' : '-rotate-90')
      }
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function JoinCourseSection({ open, onToggle, onJoined, onFailed }: JoinCourseSectionProps) {
  const { t } = useTranslation()
  const panelId = useId()
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [joining, setJoining] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (code.length !== CODE_LENGTH || joining) return
    setJoining(true)
    setError(undefined)
    try {
      const result = await joinCourse(code)
      setCode('')
      onJoined(result)
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
      onFailed()
    } finally {
      setJoining(false)
    }
  }

  return (
    <section className="flex flex-col gap-1 rounded-card border border-line bg-surface p-2 lg:px-4 lg:py-2.5">
      <h2 className="m-0 flex">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={
            'flex min-h-[52px] grow cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-2 ' +
            'text-left font-[inherit] text-inherit hover:bg-canvas ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          }
        >
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-canvas text-brand">
            <PlusIcon />
          </span>
          <span className="font-display text-lg font-semibold lg:text-xl">
            {t('studentCourses.joinTitle')}
          </span>
          <Chevron open={open} />
        </button>
      </h2>

      {open && (
        <form
          id={panelId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-1.5 px-2 pt-1 pb-2.5 lg:pb-3"
        >
          <label htmlFor={inputId} className="sr-only">
            {t('studentCourses.joinLabel')}
          </label>
          <p id={helpId} className="m-0 text-[15px] leading-[1.6] text-ink-muted">
            {t('studentCourses.joinHelp')}
          </p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row">
            <input
              id={inputId}
              type="text"
              value={code}
              onChange={(event) => {
                setCode(cleanJoinCode(event.target.value))
                setError(undefined)
              }}
              placeholder={t('studentCourses.joinPlaceholder')}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={joining}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${helpId} ${errorId}` : helpId}
              className={
                'h-[46px] w-full rounded-control border bg-surface px-3.5 text-[19px] tracking-[4px] text-ink ' +
                'placeholder:text-[15px] placeholder:tracking-normal placeholder:text-ink-muted/75 ' +
                'focus:outline-2 focus:outline-offset-1 focus:outline-brand disabled:bg-canvas lg:max-w-[320px] ' +
                (error ? 'border-danger' : 'border-line-strong')
              }
            />
            <Button type="submit" disabled={code.length !== CODE_LENGTH || joining} className="shrink-0">
              {joining ? t('studentCourses.joining') : t('studentCourses.joinButton')}
            </Button>
          </div>
          {error && (
            <p id={errorId} role="alert" className="m-0 mt-1 text-[13.5px] font-medium text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
