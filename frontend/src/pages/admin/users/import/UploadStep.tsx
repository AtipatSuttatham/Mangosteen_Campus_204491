/**
 * ขั้น ① เลือกไฟล์ — หน้าตาตาม board "นำเข้า CSV ① เลือกไฟล์" (ขั้น 2.7)
 *
 *   ┌─ การ์ด ───────────────────────────────────────────────────────────────┐
 *   │ เลือกไฟล์                          │ ไฟล์ต้องมี 5 คอลัมน์นี้              │
 *   │ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │ email   อีเมล ห้ามซ้ำ…              │
 *   │ ╎   (⇧)  ลากไฟล์ CSV มาวางที่นี่   ╎  │ …                                  │
 *   │ ╎        หรือ [เลือกไฟล์]          ╎  │ • ผู้ดูแลระบบนำเข้าจากไฟล์ไม่ได้ …   │
 *   │ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │ [⇩ ดาวน์โหลดไฟล์ตัวอย่าง]           │
 *   └────────────────────────────────────────────────────────────────────┘
 *   มือถือ: 2 ส่วนเรียงลงมา
 *
 * - เลือกไฟล์ (หรือลากมาวาง) → ส่งให้หน้าหลักตรวจทันที (onFile) — ไม่มีปุ่ม "อัปโหลด" แยก
 * - ระหว่างตรวจ: ช่องแสดง "กำลังตรวจไฟล์ …" และกดเลือกซ้ำไม่ได้
 * - ไฟล์ผิดทั้งไฟล์ (อ่านไม่ออก / ขาดคอลัมน์ / ใหญ่เกิน …) → ข้อความแดงใต้ช่อง (error)
 */
import { useId, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CSV_COLUMNS, type CsvColumn } from '../../../../api/adminUsers'
import { Button } from '../../../../components/ui'
import { downloadCsv, sampleCsv } from '../../../../lib/csvFiles'
import { DownloadIcon, UploadIcon } from '../icons'

/** คำอธิบายของแต่ละคอลัมน์ (ตาม board) */
const COLUMN_HELP: Record<CsvColumn, string> = {
  email: 'csvImport.columnEmail',
  student_or_staff_id: 'csvImport.columnId',
  first_name: 'csvImport.columnFirstName',
  last_name: 'csvImport.columnLastName',
  role: 'csvImport.columnRole',
}

type UploadStepProps = {
  /** ผู้ใช้เลือก/วางไฟล์แล้ว */
  onFile: (file: File) => void
  /** ชื่อไฟล์ที่กำลังตรวจ (null = ไม่ได้ตรวจอยู่) */
  checkingName: string | null
  /** ข้อความ error ระดับไฟล์ (แปลแล้ว) */
  error?: string
}

/** ชื่อคอลัมน์ในกล่องม่วงอ่อน (ตาม .code ใน canvas) */
export function ColumnCode({ name }: { name: string }) {
  return (
    <code className="rounded-md bg-canvas px-[7px] py-px font-sans text-sm font-semibold text-brand">
      {name}
    </code>
  )
}

export function UploadStep({ onFile, checkingName, error }: UploadStepProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  // กำลังลากไฟล์อยู่เหนือช่องหรือไม่ (เน้นขอบให้รู้ว่าวางได้)
  const [dragging, setDragging] = useState(false)
  const checking = checkingName !== null

  /** รับไฟล์แรกที่ลากมาวาง */
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && !checking) onFile(file)
  }

  return (
    <section className="grid gap-7 rounded-card border border-line bg-surface p-5 lg:grid-cols-2 lg:gap-9 lg:p-7">
      <div className="flex flex-col gap-3.5">
        <h2 className="m-0 font-display text-xl font-semibold">{t('csvImport.chooseTitle')}</h2>
        {/* ช่องลากวาง: เส้นประ ; ลากไฟล์มาอยู่เหนือช่อง → ขอบม่วง */}
        <div
          data-testid="csv-dropzone"
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={
            'flex min-h-[220px] grow flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-6 text-center lg:min-h-[260px] ' +
            (dragging ? 'border-brand bg-canvas' : 'border-line-strong bg-canvas-soft')
          }
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-canvas text-brand">
            <UploadIcon size={26} />
          </span>
          {checking ? (
            <p role="status" className="m-0 text-base font-semibold">
              {t('csvImport.checking', { name: checkingName })}
            </p>
          ) : (
            <>
              <p className="m-0 text-base font-semibold">{t('csvImport.dropHere')}</p>
              <p className="m-0 text-sm text-ink-muted">{t('csvImport.or')}</p>
            </>
          )}
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={checking}
            aria-describedby={error ? errorId : undefined}
          >
            {t('csvImport.chooseFile')}
          </Button>
          {/* ช่องเลือกไฟล์จริงของเบราว์เซอร์ (ซ่อน — กดผ่านปุ่มด้านบน) ; ล้างค่าหลังเลือก ให้เลือกไฟล์เดิมซ้ำได้ */}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            data-testid="csv-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onFile(file)
            }}
          />
          <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
            {t('csvImport.limits')}
            <br />
            {t('csvImport.checkNow')}
          </p>
        </div>
        {error && (
          <p id={errorId} role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        <h2 className="m-0 font-display text-xl font-semibold">{t('csvImport.columnsTitle')}</h2>
        <table className="w-full border-collapse">
          <tbody>
            {CSV_COLUMNS.map((column) => (
              <tr key={column}>
                <td className="border-b border-line-soft py-[9px] pr-3 align-top whitespace-nowrap">
                  <ColumnCode name={column} />
                </td>
                <td className="border-b border-line-soft py-[9px] text-[14.5px] text-ink-muted">
                  {t(COLUMN_HELP[column] as 'csvImport.columnEmail')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="m-0 flex flex-col gap-1.5 rounded-[10px] bg-mute-soft py-3 pr-3.5 pl-[32px] text-sm leading-[1.55] text-mute">
          <li>{t('csvImport.noteAdmin')}</li>
          <li>{t('csvImport.noteEncoding')}</li>
        </ul>
        <div>
          <Button
            variant="secondary"
            onClick={() => downloadCsv(t('csvImport.sampleFileName'), sampleCsv())}
          >
            <DownloadIcon />
            {t('csvImport.downloadSample')}
          </Button>
        </div>
      </div>
    </section>
  )
}
