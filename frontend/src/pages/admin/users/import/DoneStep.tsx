/**
 * ขั้น ③ รับรหัสผ่าน — หน้าตาตาม board "นำเข้า CSV ③ ดาวน์โหลดไฟล์รหัสผ่าน" (ขั้น 2.7)
 *
 *   ┌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┐  ← หัวม่วง + ลายกลีบเลี้ยง
 *   │▓ (✓) สร้างบัญชีแล้ว 46 บัญชี                          ▓│
 *   │▓     ผู้เรียน 44 คน ผู้สอน 2 คน จากไฟล์ …             ▓│
 *   ├────────────────────────────────────────────────────┤
 *   │ ⚠ ดาวน์โหลดไฟล์รหัสผ่านก่อนออกจากหน้านี้ …             │  ← ดาวน์โหลดแล้ว → กล่องเขียว ✓
 *   │ [⇩ ดาวน์โหลดไฟล์รหัสผ่าน]  กลับไปจัดการบัญชีผู้ใช้       │
 *   │ ไฟล์ CSV ที่ได้มีคอลัมน์เดิมทั้ง 5 คอลัมน์ และเพิ่ม password … │
 *   └────────────────────────────────────────────────────┘
 *
 * ไฟล์รหัสผ่านสร้างในหน้าเว็บจากผลการนำเข้า (server ไม่เก็บรหัส) — กันสูตร Excel แล้ว (lib/csvFiles.ts)
 */
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ImportResult } from '../../../../api/adminUsers'
import { CalyxPattern } from '../../../../components/brand/CalyxPattern'
import { Button } from '../../../../components/ui'
import { CheckIcon, DownloadIcon, WarnIcon } from '../icons'

type DoneStepProps = {
  fileName: string
  result: ImportResult
  /** ดาวน์โหลดไฟล์รหัสผ่านแล้วอย่างน้อย 1 ครั้ง */
  downloaded: boolean
  onDownload: () => void
}

const formatCount = (value: number) => value.toLocaleString('th-TH')

export function DoneStep({ fileName, result, downloaded, onDownload }: DoneStepProps) {
  const { t } = useTranslation()
  return (
    <section className="max-w-[760px]">
      <div className="relative overflow-hidden rounded-t-card bg-brand px-5 py-6 lg:px-7 lg:py-[26px]">
        <CalyxPattern
          size={300}
          strokeWidth={0.35}
          className="pointer-events-none absolute -top-24 -right-20 text-accent opacity-[0.22]"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-brand-hover">
            <CheckIcon size={26} />
          </span>
          <div>
            <h2 className="m-0 font-display text-[22px] leading-[1.3] font-semibold text-white lg:text-[26px]">
              {t('csvImport.doneTitle', { count: result.created })}
            </h2>
            <p className="m-0 text-[14.5px] [overflow-wrap:anywhere] text-on-brand-muted">
              {t('csvImport.doneSummary', {
                students: formatCount(result.by_role.student),
                teachers: formatCount(result.by_role.teacher),
                name: fileName,
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[18px] rounded-b-card border border-t-0 border-line bg-surface px-5 pt-6 pb-7 lg:px-7">
        {/* ยังไม่ดาวน์โหลด = กล่องส้มเตือน ; ดาวน์โหลดแล้ว = กล่องเขียวยืนยัน (role=status ประกาศให้โปรแกรมอ่านหน้าจอ) */}
        <div
          role="status"
          className={
            'flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-[15px] leading-[1.55] ' +
            (downloaded ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')
          }
        >
          <span className="mt-0.5">{downloaded ? <CheckIcon /> : <WarnIcon />}</span>
          <div>
            <p className="m-0 font-semibold">
              {t(downloaded ? 'csvImport.downloadedTitle' : 'csvImport.downloadWarningTitle')}
            </p>
            <p className="m-0">
              {t(downloaded ? 'csvImport.downloadedBody' : 'csvImport.downloadWarningBody')}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3.5 sm:flex-row sm:flex-wrap sm:items-center">
          <Button variant={downloaded ? 'secondary' : 'primary'} onClick={onDownload}>
            <DownloadIcon />
            {t(downloaded ? 'csvImport.downloadAgain' : 'csvImport.downloadPasswords')}
          </Button>
          <Link to="/users" className="text-center text-[15px] font-semibold">
            {t('csvImport.backToUsers')}
          </Link>
        </div>

        <p className="m-0 text-[13.5px] leading-[1.6] text-ink-muted">
          <Trans
            i18nKey="csvImport.passwordFileHint"
            components={{
              code: (
                <code className="rounded-md bg-canvas px-[7px] py-px font-sans text-sm font-semibold text-brand" />
              ),
            }}
          />
        </p>
      </div>
    </section>
  )
}
