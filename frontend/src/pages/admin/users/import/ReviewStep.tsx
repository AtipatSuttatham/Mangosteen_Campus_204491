/**
 * ขั้น ② ตรวจข้อมูล — หน้าตาตาม board "นำเข้า CSV ② พบปัญหา" และ "② ถูกทุกแถว — สรุปก่อนนำเข้า" (ขั้น 2.7)
 *
 *   📄 นักศึกษา_204111.csv   46 แถว
 *   ── มีแถวผิด ───────────────────────────        ── ถูกทุกแถว ──────────────────────────────
 *   ⚠ พบปัญหา 5 แถว ยังไม่มีบัญชีใดถูกสร้าง         ✓ ข้อมูลถูกต้องทุกแถว พร้อมนำเข้า
 *   แถว │ คอลัมน์ │ ปัญหา │ ค่าในไฟล์               [46 บัญชีทั้งหมด] [44 ผู้เรียน] [2 ผู้สอน]
 *                  [ยกเลิก] [เลือกไฟล์ใหม่]       แถว │ ชื่อ-นามสกุล │ อีเมล │ รหัส │ บทบาท  (5 แถวแรก)
 *                                                และอีก 41 แถว
 *                                                ระบบสุ่มรหัส…   [เลือกไฟล์ใหม่] [นำเข้า 46 บัญชี]
 *
 * มือถือ: ตาราง → การ์ดทีละแถว ; ปุ่มเต็มความกว้าง (ผู้ใช้เลือกข้อ 3.ก ขั้น 2.7)
 */
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { CsvReport } from '../../../../api/adminUsers'
import { Button, buttonClassName } from '../../../../components/ui'
import { CheckIcon, FileIcon, UploadIcon, WarnIcon } from '../icons'
import { csvProblemText } from './csvProblem'
import { ColumnCode } from './UploadStep'

/** หัวตาราง (ตาม th ใน canvas) */
const TH = 'border-b border-line px-4 py-3 text-left text-sm font-semibold whitespace-nowrap text-ink-muted first:pl-6'
/** ช่องข้อมูล */
const TD = 'border-b border-line-soft px-4 py-3 align-middle text-[15px] first:pl-6'

type ReviewStepProps = {
  fileName: string
  report: CsvReport
  /** เลือกไฟล์ใหม่ (กลับไปขั้น ①) */
  onChooseAgain: () => void
  /** กด "นำเข้า N บัญชี" */
  onImport: () => void
  /** กำลังนำเข้าอยู่ */
  importing: boolean
  /** ข้อความเพิ่มเหนือรายงาน เช่น "ข้อมูลในระบบเปลี่ยนระหว่างตรวจกับนำเข้า…" หรือ error ตอนนำเข้า */
  notice?: string
}

const formatCount = (value: number) => value.toLocaleString('th-TH')

export function ReviewStep({
  fileName,
  report,
  onChooseAgain,
  onImport,
  importing,
  notice,
}: ReviewStepProps) {
  const { t } = useTranslation()
  // จำนวนแถวที่มีปัญหา (1 แถวอาจมีหลายช่อง)
  const problemRows = new Set(report.errors.map((error) => error.row)).size
  const moreRows = report.total - report.preview.length

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-col gap-3.5 border-b border-line px-5 py-5 lg:px-6 lg:py-[22px]">
        {/* ไฟล์ที่เลือก + จำนวนแถว */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14.5px] text-ink-muted">
          <FileIcon />
          <span className="font-semibold [overflow-wrap:anywhere] text-ink">{fileName}</span>
          <span>{t('csvImport.rowCount', { total: formatCount(report.total) })}</span>
        </div>
        {notice && (
          <p role="alert" className="m-0 text-[14.5px] leading-[1.55] font-semibold text-danger">
            {notice}
          </p>
        )}
        {report.valid ? (
          <>
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-[10px] bg-ok-soft px-3.5 py-3 text-[15px] font-semibold text-ok"
            >
              <CheckIcon />
              {t('csvImport.readyTitle')}
            </div>
            {/* ตัวเลขสรุป 3 กล่อง (ตัวเลข Taviraj สีม่วง) */}
            <dl className="m-0 grid grid-cols-3 gap-2.5 sm:flex sm:gap-3">
              {(
                [
                  ['csvImport.statTotal', report.total],
                  ['csvImport.statStudents', report.by_role.student],
                  ['csvImport.statTeachers', report.by_role.teacher],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse rounded-xl border border-line px-[18px] py-3 sm:min-w-[120px]">
                  <dt className="text-sm text-ink-muted">{t(label)}</dt>
                  <dd className="m-0 font-display text-[30px] leading-[1.2] font-semibold text-brand">
                    {formatCount(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[10px] bg-bad-soft px-3.5 py-3 text-[15px] leading-[1.55] text-bad"
          >
            <span className="mt-0.5">
              <WarnIcon />
            </span>
            <div>
              <p className="m-0 font-semibold">{t('csvImport.errorsTitle', { count: problemRows })}</p>
              <p className="m-0">{t('csvImport.errorsHint')}</p>
              <p className="m-0 text-[13.5px]">{t('csvImport.errorsRowNote')}</p>
            </div>
          </div>
        )}
      </div>

      {report.valid ? <PreviewList report={report} /> : <ProblemList report={report} />}

      {report.valid && moreRows > 0 && (
        <p className="m-0 border-t border-line-soft px-5 pt-2.5 pb-3.5 text-sm text-ink-muted lg:px-6">
          {t('csvImport.moreRows', { count: moreRows })}
        </p>
      )}

      {/* ปุ่มท้ายการ์ด: มือถือเต็มความกว้างเรียงลง (ปุ่มหลักอยู่บน) */}
      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        {report.valid && (
          <p className="m-0 text-sm leading-[1.55] text-ink-muted">{t('csvImport.readyHint')}</p>
        )}
        <div className="flex flex-col-reverse gap-2.5 lg:ml-auto lg:flex-row">
          {report.valid ? (
            <>
              <Button variant="secondary" onClick={onChooseAgain} disabled={importing}>
                {t('csvImport.chooseAgain')}
              </Button>
              <Button onClick={onImport} disabled={importing}>
                {importing
                  ? t('csvImport.importing')
                  : t('csvImport.importButton', { count: report.total })}
              </Button>
            </>
          ) : (
            <>
              <Link to="/users" className={buttonClassName('secondary')}>
                {t('csvImport.cancel')}
              </Link>
              <Button onClick={onChooseAgain}>
                <UploadIcon />
                {t('csvImport.chooseAgain')}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** รายการปัญหา: ตาราง (จอใหญ่) / การ์ดทีละปัญหา (มือถือ) */
function ProblemList({ report }: { report: CsvReport }) {
  const { t } = useTranslation()
  const valueText = (value: string) => value || t('csvImport.emptyValue')
  return (
    <>
      <table aria-label={t('csvImport.errorsTableLabel')} className="hidden w-full border-collapse lg:table">
        <thead>
          <tr>
            <th scope="col" className={`${TH} w-20`}>
              {t('csvImport.columnHeadRow')}
            </th>
            <th scope="col" className={`${TH} w-[190px]`}>
              {t('csvImport.columnHeadColumn')}
            </th>
            <th scope="col" className={TH}>
              {t('csvImport.columnHeadProblem')}
            </th>
            <th scope="col" className={`${TH} w-[250px]`}>
              {t('csvImport.columnHeadValue')}
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {report.errors.map((error) => (
            <tr key={`${error.row}-${error.column}`}>
              {/* เลขแถวเด่น (Taviraj สีแดง) ให้หาในไฟล์ง่าย */}
              <td className={`${TD} font-display text-[17px] font-semibold text-bad`}>{error.row}</td>
              <td className={TD}>
                <ColumnCode name={error.column} />
              </td>
              <td className={TD}>{csvProblemText(error)}</td>
              <td className={`${TD} text-[14.5px] break-all text-ink-muted`}>{valueText(error.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={t('csvImport.errorsTableLabel')} className="m-0 list-none p-0 lg:hidden">
        {report.errors.map((error) => (
          <li
            key={`${error.row}-${error.column}`}
            className="flex flex-col gap-1 border-b border-line-soft px-5 py-3.5 last:border-b-0"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[17px] font-semibold text-bad">
                {t('csvImport.rowLabel', { row: error.row })}
              </span>
              <ColumnCode name={error.column} />
            </div>
            <p className="m-0 text-[15px]">{csvProblemText(error)}</p>
            <p className="m-0 text-sm [overflow-wrap:anywhere] text-ink-muted">{valueText(error.value)}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

/** ตัวอย่างบัญชีที่จะนำเข้า: ตาราง (จอใหญ่) / การ์ด (มือถือ) */
function PreviewList({ report }: { report: CsvReport }) {
  const { t } = useTranslation()
  return (
    <>
      <table aria-label={t('csvImport.previewTableLabel')} className="hidden w-full border-collapse lg:table">
        <thead>
          <tr>
            <th scope="col" className={`${TH} w-20`}>
              {t('csvImport.columnHeadRow')}
            </th>
            <th scope="col" className={TH}>
              {t('csvImport.columnHeadName')}
            </th>
            <th scope="col" className={TH}>
              {t('csvImport.columnHeadEmail')}
            </th>
            <th scope="col" className={TH}>
              {t('csvImport.columnHeadId')}
            </th>
            <th scope="col" className={TH}>
              {t('csvImport.columnHeadRole')}
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {report.preview.map((row) => (
            <tr key={row.row}>
              <td className={`${TD} text-[14.5px] text-ink-muted`}>{row.row}</td>
              <td className={`${TD} font-semibold`}>
                {row.first_name} {row.last_name}
              </td>
              <td className={`${TD} break-all`}>{row.email}</td>
              <td className={TD}>{row.student_or_staff_id ?? '—'}</td>
              <td className={`${TD} whitespace-nowrap`}>{t(`roles.${row.role}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={t('csvImport.previewTableLabel')} className="m-0 list-none p-0 lg:hidden">
        {report.preview.map((row) => (
          <li key={row.row} className="flex flex-col gap-0.5 border-b border-line-soft px-5 py-3 last:border-b-0">
            <span className="font-semibold">
              {row.first_name} {row.last_name}
            </span>
            <span className="text-sm [overflow-wrap:anywhere] text-ink-muted">{row.email}</span>
            <span className="flex flex-wrap gap-x-5 text-sm text-ink-muted">
              <span>{t(`roles.${row.role}`)}</span>
              {row.student_or_staff_id && <span>{t('adminUsers.idShort', { id: row.student_or_staff_id })}</span>}
              <span>{t('csvImport.rowLabel', { row: row.row })}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
