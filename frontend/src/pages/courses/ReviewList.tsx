/**
 * ตารางตรวจรายการก่อนเพิ่มผู้เรียน ตาม board "เพิ่มผู้เรียน ③" + "ตรวจรายการ (มือถือ)" (ขั้น 3.6)
 *
 *   [จะเพิ่ม 38 คน] [เพิ่มกลับ 1 คน] [อยู่ในรายวิชาแล้ว 1 คน] [รายการซ้ำ 1 รายการ] [เพิ่มไม่ได้ 3 รายการ]
 *   รหัส         ชื่อ–นามสกุล    อีเมล          ผลเมื่อกดเพิ่ม     เอาออก
 *
 * - เรียงแถวที่มีปัญหาไว้บนสุด (ผู้ใช้เลือกแบบ ฎ1) ; รายการซ้ำอยู่แค่ในป้ายสรุป
 * - ตารางเลื่อนในกรอบ หัวตารางค้างด้านบน ; มือถือเป็นการ์ด
 */
import { useTranslation } from 'react-i18next'
import type { EnrollmentPreview, PreviewResult, PreviewRow } from '../../api/enrollments'
import { Button, StatusBadge, type StatusTone } from '../../components/ui'

/** สีป้ายของแต่ละผล */
const RESULT_TONE: Record<PreviewResult, StatusTone> = {
  add: 'ok',
  reactivate: 'warn',
  already: 'mute',
  not_found: 'bad',
  not_student: 'bad',
  suspended: 'bad',
}

/** ป้ายสรุปจำนวน — แสดงเฉพาะกลุ่มที่มี */
export function ReviewSummary({ review }: { review: EnrollmentPreview }) {
  const { t } = useTranslation()
  const count = (...results: PreviewResult[]) =>
    review.rows.filter((row) => results.includes(row.result)).length
  const items: { text: string; tone: StatusTone; total: number }[] = [
    { total: count('add'), tone: 'ok', text: t('addStudents.summaryAdd', { total: count('add') }) },
    {
      total: count('reactivate'),
      tone: 'warn',
      text: t('addStudents.summaryReactivate', { total: count('reactivate') }),
    },
    {
      total: count('already'),
      tone: 'mute',
      text: t('addStudents.summaryAlready', { total: count('already') }),
    },
    {
      total: review.duplicates,
      tone: 'mute',
      text: t('addStudents.summaryDuplicates', { total: review.duplicates }),
    },
    {
      total: count('not_found', 'not_student', 'suspended'),
      tone: 'bad',
      text: t('addStudents.summaryFailed', { total: count('not_found', 'not_student', 'suspended') }),
    },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {items
        .filter((item) => item.total > 0)
        .map((item) => (
          <StatusBadge key={item.text} tone={item.tone}>
            {item.text}
          </StatusBadge>
        ))}
    </div>
  )
}

const TH =
  'sticky top-0 z-[1] border-b border-line bg-surface px-3 py-2.5 text-left text-[13.5px] font-semibold whitespace-nowrap text-ink-muted'
const TD = 'border-b border-line-soft px-3 py-2 align-middle text-[14.5px]'

type ReviewListProps = {
  rows: PreviewRow[]
  disabled: boolean
  onRemove: (row: PreviewRow) => void
}

export function ReviewList({ rows, disabled, onRemove }: ReviewListProps) {
  const { t } = useTranslation()
  const name = (row: PreviewRow) =>
    row.student ? `${row.student.first_name} ${row.student.last_name}` : null
  const rowId = (row: PreviewRow) => row.student?.student_or_staff_id ?? row.identifier

  const removeButton = (row: PreviewRow) => (
    <Button
      variant="text"
      disabled={disabled}
      aria-label={t('addStudents.removeLabel', { identifier: rowId(row) })}
      onClick={() => onRemove(row)}
    >
      {t('addStudents.remove')}
    </Button>
  )
  const resultBadge = (row: PreviewRow) => (
    <StatusBadge tone={RESULT_TONE[row.result]} className="h-[26px]! text-[12.5px]!">
      {t(`addStudents.result.${row.result}`)}
    </StatusBadge>
  )

  return (
    <>
      {/* จอใหญ่ = ตาราง */}
      <div
        tabIndex={0}
        role="region"
        aria-label={t('addStudents.reviewLabel')}
        className="max-h-[430px] overflow-auto rounded-[10px] border border-line max-lg:hidden"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={`${TH} pl-4`}>
                {t('addStudents.columnId')}
              </th>
              <th scope="col" className={TH}>
                {t('addStudents.columnName')}
              </th>
              <th scope="col" className={TH}>
                {t('addStudents.columnEmail')}
              </th>
              <th scope="col" className={TH}>
                {t('addStudents.columnResult')}
              </th>
              <th scope="col" className={`${TH} pr-1.5`}>
                <span className="sr-only">{t('addStudents.columnActions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.identifier} className="last:[&>td]:border-b-0">
                <td className={`${TD} pl-4 tabular-nums`}>{rowId(row)}</td>
                <td className={`${TD} ${row.student ? 'font-semibold' : 'text-ink-muted'}`}>
                  {name(row) ?? t('addStudents.noData')}
                </td>
                <td className={`${TD} ${row.student ? '' : 'text-ink-muted'}`}>
                  {row.student?.email ?? t('addStudents.noData')}
                </td>
                <td className={TD}>{resultBadge(row)}</td>
                <td className={`${TD} pr-1.5 text-right`}>{removeButton(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* มือถือ = การ์ด */}
      <ul className="m-0 list-none divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface p-0 lg:hidden">
        {rows.map((row) => (
          <li key={row.identifier} className="flex flex-col gap-1 py-3 pr-1.5 pl-3.5">
            <div className="flex items-center gap-2">
              <span className="grow text-[14.5px] font-semibold tabular-nums wrap-anywhere">{rowId(row)}</span>
              {removeButton(row)}
            </div>
            {row.student && (
              <>
                <div className="text-[15px] font-semibold">{name(row)}</div>
                <div className="text-[13.5px] leading-[1.6] wrap-anywhere text-ink-muted">{row.student.email}</div>
              </>
            )}
            <div>{resultBadge(row)}</div>
          </li>
        ))}
      </ul>
    </>
  )
}
