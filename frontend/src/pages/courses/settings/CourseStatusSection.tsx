/**
 * สถานะ "ปิดรายวิชาแล้ว" ของแท็บตั้งค่า — 2 แบบตามบทบาท (ขั้น 3.6 / 3.8)
 *
 * - ClosedSummary (ผู้สอน): กล่องบนสุด "ปิดรายวิชาแล้ว · ปิดเมื่อ … โดย …" + บอกว่าดูได้อย่างเดียว
 * - CourseStatusSection (ผู้ดูแลระบบ — board "ตั้งค่ารายวิชาที่ปิดแล้ว (ผู้ดูแลระบบ)"): ข้อความเดียวกัน
 *   + ปุ่ม "เปิดรายวิชาคืน" (ทำทันที ย้อนได้ด้วยการปิดอีกครั้ง)
 *   เปิดคืนแล้วส่วนนี้หายไป → ผลขึ้นแถบด้านบน + เลื่อนหน้าขึ้นไปให้เห็น (แบบเดียวกับปิดรายวิชา)
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, StatusBadge } from '../../../components/ui'
import { formatDateTime } from '../../../lib/datetime'
import { LockIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'
import { Hint, Section } from './SettingsSection'
import { apiMessage, type SettingsActions } from './useSettingsActions'

/** "ปิดเมื่อ … โดย …" (อ่านจาก AuditLog close_course ฝั่ง backend) ; ไม่มีบันทึก = ไม่แสดง */
function useClosedNote(): string | null {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  if (!course.closed_at) return null
  return t('courseSettings.closedNote', {
    date: formatDateTime(course.closed_at),
    name: course.closed_by ?? '',
  })
}

/** กล่องวิชาที่ปิดแล้วของผู้สอน (ผู้ดูแลระบบเห็น CourseStatusSection แทน) */
export function ClosedSummary() {
  const { t } = useTranslation()
  const note = useClosedNote()
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3.5 lg:px-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge tone="mute" icon={<LockIcon />}>
          {t('courses.closed')}
        </StatusBadge>
        {note && <span className="text-sm text-ink-muted">{note}</span>}
      </div>
      <Hint>{t('courseSettings.closedHint')}</Hint>
    </div>
  )
}

/** ส่วน "สถานะรายวิชา" ของผู้ดูแลระบบ (แสดงเฉพาะวิชาที่ปิดแล้ว) */
export function CourseStatusSection({ actions, className }: { actions: SettingsActions; className: string }) {
  const { t } = useTranslation()
  const { notify } = useCoursePage()
  const note = useClosedNote()
  // ป้ายบนปุ่มเปลี่ยนเป็น "กำลังเปิด…" เฉพาะปุ่มนี้ (ล็อกปุ่มอื่นด้วย actions.running)
  const [reopening, setReopening] = useState(false)

  function reopen() {
    setReopening(true)
    return actions.run(async () => {
      try {
        await actions.apply('reopen')
        notify({ tone: 'ok', text: t('courseSettings.reopenedNotice') })
      } catch (caught) {
        notify({ tone: 'bad', text: t('courseSettings.actionFailed', { reason: apiMessage(caught) }) })
        await actions.refresh()
      } finally {
        setReopening(false)
        window.scrollTo({ top: 0 })
      }
    })
  }

  return (
    <Section
      title={t('courseSettings.statusTitle')}
      body={t('courseSettings.statusBody')}
      className={className}
    >
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:gap-4">
        <div className="grow">
          <StatusBadge tone="mute" icon={<LockIcon />} className="mb-1.5 w-fit">
            {t('courses.closed')}
          </StatusBadge>
          {note && <p className="m-0 text-[15px] leading-[1.6] font-semibold">{note}</p>}
          <p className="m-0 text-sm leading-[1.6] text-ink-muted">{t('courseSettings.reopenNote')}</p>
        </div>
        <Button
          variant="secondary"
          disabled={actions.running}
          onClick={() => void reopen()}
          className="shrink-0"
        >
          {reopening ? t('courseSettings.reopening') : t('courseSettings.reopen')}
        </Button>
      </div>
    </Section>
  )
}
