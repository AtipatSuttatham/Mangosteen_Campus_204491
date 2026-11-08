/**
 * แท็บ "วางรายการหรือเลือกไฟล์" ของหน้าต่างเพิ่มผู้เรียน ตาม board "เพิ่มผู้เรียน ②–④" (ขั้น 3.6)
 *
 *   ขั้นกรอก:  พื้นที่เลือกไฟล์ + ช่องรายการ → "ตรวจรายการ"     (เลือกไฟล์แล้วตรวจให้ทันที)
 *   ขั้นตรวจ:  ตาราง รหัส / ชื่อ–นามสกุล / อีเมล / ผลเมื่อกดเพิ่ม → "เพิ่มผู้เรียน 39 คน"
 *   ขั้นผล:    รายงานผล + ในช่องเหลือเฉพาะรายการที่เพิ่มไม่ได้
 *
 * - ไฟล์อ่านในเบราว์เซอร์ (lib/rosterFile.ts) ส่งเฉพาะรายการขึ้น server
 * - รายการจากไฟล์แทนที่รายการเดิมในช่อง (ผู้ใช้เลือกแบบ ช2)
 * - อ่านไฟล์ไม่ได้ → รายการในช่องไม่เปลี่ยน
 * - ตารางเป็นแค่ผลตรวจ: ตอนกดเพิ่ม backend ตรวจซ้ำ และรายงานผลจริงเสมอ
 */
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { Course } from '../../api/courses'
import {
  addStudents,
  MAX_IDENTIFIERS,
  previewStudents,
  type AddStudentsResult,
  type EnrollmentPreview,
  type PreviewRow,
} from '../../api/enrollments'
import { errorMessage } from '../../api/errors'
import { Button, DialogBody, DialogFooter } from '../../components/ui'
import { readRosterFile, RosterFileError, type RosterFile } from '../../lib/rosterFile'
import { AddReport } from './AddReport'
import { SheetIcon, UploadIcon, WarnIcon } from './icons'
import { ReviewList, ReviewSummary } from './ReviewList'
import { sortRows } from './reviewRows'
import { useRefreshCourse } from './useCoursePage'

/** แยกข้อความในช่องเป็นรายการ (ข้ามบรรทัดว่าง) */
const toLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/** ปัญหาของไฟล์ที่เลือกล่าสุด */
type FileFailure = { name: string | null; message: string }

type AddByListProps = {
  course: Course
  /** แท็บนี้เปิดอยู่หรือไม่ (ปิดอยู่ = ไม่แสดง แต่รายการยังอยู่) */
  active: boolean
  onDone: () => void
  onBusyChange: (busy: boolean) => void
  onWideChange: (wide: boolean) => void
}

export function AddByList({
  course,
  active,
  onDone,
  onBusyChange,
  onWideChange,
}: AddByListProps) {
  const { t } = useTranslation()
  const listId = useId()
  const hintId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refresh = useRefreshCourse(course.id)

  const [text, setText] = useState('')
  const [file, setFile] = useState<RosterFile | null>(null)
  const [fileFailure, setFileFailure] = useState<FileFailure | null>(null)
  const [review, setReview] = useState<EnrollmentPreview | null>(null)
  const [report, setReport] = useState<(AddStudentsResult & { duplicates: number }) | null>(null)
  const [error, setError] = useState<string>()
  // กำลังทำอะไรอยู่ (ปุ่มกดไม่ได้ ปิดหน้าต่างไม่ได้)
  const [work, setWork] = useState<'reading' | 'checking' | 'adding' | null>(null)
  const busy = work !== null

  useEffect(() => onBusyChange(busy), [busy, onBusyChange])
  useEffect(() => onWideChange(review !== null), [review, onWideChange])

  const apiMessage = (caught: unknown) =>
    errorMessage(caught instanceof ApiError ? caught.code : 'unknown')

  /** ส่งรายการไปตรวจ แล้วเปิดตาราง */
  async function check(identifiers: string[]) {
    if (identifiers.length > MAX_IDENTIFIERS) {
      setError(t('addStudents.tooManyLines', { total: identifiers.length }))
      return
    }
    setWork('checking')
    setError(undefined)
    setFileFailure(null)
    setReport(null)
    try {
      const result = await previewStudents(course.id, identifiers)
      setReview({ ...result, rows: sortRows(result.rows) })
    } catch (caught) {
      setError(apiMessage(caught))
      await refresh()
    } finally {
      setWork(null)
    }
  }

  /** เลือกไฟล์แล้ว: อ่าน → แทนที่รายการ → ตรวจทันที */
  async function chooseFile(chosen: File) {
    setWork('reading')
    setFileFailure(null)
    setError(undefined)
    try {
      const loaded = await readRosterFile(chosen)
      setFile(loaded)
      setText(loaded.identifiers.join('\n'))
      await check(loaded.identifiers)
    } catch (caught) {
      const message =
        caught instanceof RosterFileError
          ? t(`addStudents.fileProblem.${caught.problem}`, { total: caught.total })
          : t('addStudents.fileProblem.unreadable')
      setFileFailure({ name: chosen.name, message })
      setWork(null)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (busy) return
    const files = event.dataTransfer.files
    if (files.length > 1) {
      setFileFailure({ name: null, message: t('addStudents.oneFileOnly') })
    } else if (files[0]) {
      void chooseFile(files[0])
    }
  }

  /** เอาไฟล์ออก: กลับไปขั้นกรอก ช่องว่าง */
  function removeFile() {
    setFile(null)
    setReview(null)
    setText('')
    setError(undefined)
  }

  /** กลับไปแก้รายการที่วาง */
  function editList() {
    setReview(null)
    setError(undefined)
  }

  /** เอาแถวออกจากตาราง ; เอาออกหมด → กลับขั้นกรอก */
  function removeRow(target: PreviewRow) {
    if (!review) return
    const rows = review.rows.filter((row) => row !== target)
    setText(rows.map((row) => row.identifier).join('\n'))
    if (rows.length === 0) {
      setFile(null)
      setReview(null)
    } else {
      setReview({ ...review, rows })
    }
  }

  /** กดเพิ่มในตาราง: ส่งทุกแถวที่เหลือ แล้วรายงานผลจริงจาก backend */
  async function add() {
    if (!review) return
    setWork('adding')
    setError(undefined)
    try {
      const result = await addStudents(
        course.id,
        review.rows.map((row) => row.identifier),
      )
      setReport({ ...result, duplicates: review.duplicates })
      setText(result.failed.map((item) => item.identifier).join('\n'))
      setFile(null)
      setReview(null)
      await refresh()
    } catch (caught) {
      setError(apiMessage(caught))
      await refresh()
    } finally {
      setWork(null)
    }
  }

  if (!active) return null

  const lines = toLines(text)
  const errorLine = error && (
    <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
      {error}
    </p>
  )

  // ---- ขั้นตรวจ: ตาราง ----
  if (review) {
    const addable = review.rows.filter((row) => row.result === 'add' || row.result === 'reactivate').length
    const total = review.rows.length + review.duplicates
    return (
      <>
        {/* จอใหญ่: ส่วนนี้ไม่เลื่อนเอง ให้ตารางในนั้นหดเต็มพื้นที่ที่เหลือแล้วเลื่อนเฉพาะตาราง (แบบ ถ1)
            มือถือ: สูงตามเนื้อหา แล้วทั้งหน้าต่างเลื่อน — ถ้าหดได้ (min-h-0) กล่องการ์ดจะถูกบีบ
            จนรายการที่เกินถูกซ่อนและเลื่อนดูไม่ได้ (พบตอนตรวจมือถือขั้น 3.6 รอบ 3) */}
        <DialogBody className="pt-3! lg:min-h-0 lg:overflow-hidden lg:pt-[18px]!">
          <div className="flex items-center gap-3.5 rounded-[10px] border border-line bg-surface py-3 pr-2 pl-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-ok-soft text-ok">
              <SheetIcon />
            </span>
            <div className="min-w-0 grow">
              <div className="text-[15px] leading-normal font-semibold wrap-anywhere">
                {file ? file.name : t('addStudents.pastedList')}
              </div>
              <div className="text-[13.5px] leading-[1.55] text-ink-muted">
                {file ? fileSummary(file, t) : t('addStudents.pastedCount', { total })}
              </div>
            </div>
            <Button variant="text" disabled={busy} onClick={file ? removeFile : editList}>
              {file ? t('addStudents.removeFile') : t('addStudents.editList')}
            </Button>
          </div>
          <ReviewSummary review={review} />
          <ReviewList rows={review.rows} disabled={busy} onRemove={removeRow} />
          <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">{t('addStudents.reviewHint')}</p>
          {errorLine}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={onDone}>
            {t('dialog.cancel')}
          </Button>
          <Button disabled={busy || addable === 0} onClick={() => void add()}>
            {work === 'adding' ? t('addStudents.adding') : t('addStudents.addCount', { total: addable })}
          </Button>
        </DialogFooter>
      </>
    )
  }

  // ---- ขั้นกรอก / ขั้นผล ----
  return (
    <>
      <DialogBody className="pt-3! lg:pt-[18px]!">
        {report && <AddReport report={report} />}

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className={
            'flex items-center gap-3.5 rounded-[10px] border-2 border-dashed bg-canvas-soft px-4 py-3.5 ' +
            (fileFailure ? 'border-bad' : 'border-line-strong')
          }
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas text-brand max-lg:hidden">
            <UploadIcon />
          </span>
          <div className="min-w-0 grow">
            <div className="text-[15px] leading-normal font-semibold">
              <span className="max-lg:hidden">{t('addStudents.dropTitle')}</span>
              <span className="lg:hidden">{t('addStudents.dropTitleMobile')}</span>
            </div>
            <div className="text-[13.5px] leading-[1.55] text-ink-muted">{t('addStudents.dropHint')}</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv,.txt"
            aria-label={t('addStudents.chooseFile')}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const chosen = event.target.files?.[0]
              // ล้างค่า → เลือกไฟล์เดิมซ้ำได้หลังแก้ไฟล์
              event.target.value = ''
              if (chosen) void chooseFile(chosen)
            }}
          />
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            {work === 'reading' ? t('addStudents.readingFile') : t('addStudents.chooseFile')}
          </Button>
        </div>

        {fileFailure && (
          <div role="alert" className="flex flex-col gap-0.5 rounded-[10px] bg-bad-soft px-3.5 py-3 text-bad">
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <WarnIcon />
              {fileFailure.name
                ? t('addStudents.fileFailed', { name: fileFailure.name })
                : fileFailure.message}
            </div>
            {fileFailure.name && (
              <div className="pl-[26px] text-sm leading-[1.6] text-ink">{fileFailure.message}</div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={listId} className="text-[15px] font-semibold">
            {t('addStudents.listLabel')}
          </label>
          <textarea
            id={listId}
            rows={report ? 3 : 6}
            value={text}
            disabled={busy}
            onChange={(event) => {
              setText(event.target.value)
              // แก้รายการเองแล้ว → รายการไม่ใช่ของไฟล์นั้นอีกต่อไป
              setFile(null)
            }}
            aria-describedby={hintId}
            className={
              'w-full resize-y rounded-control border border-line-strong bg-surface px-3.5 py-3 text-[15px] ' +
              'leading-[1.6] text-ink tabular-nums focus:outline-2 focus:outline-offset-1 focus:outline-brand ' +
              'disabled:border-line disabled:bg-canvas disabled:text-ink-muted'
            }
          />
          <div id={hintId} className="text-[13.5px] leading-[1.55] text-ink-muted">
            {report && report.failed.length > 0 && <div>{t('addStudents.listRetryHint')}</div>}
            <div>{t('addStudents.listHint')}</div>
            {lines.length > 0 && <div>{t('addStudents.listCount', { total: lines.length })}</div>}
          </div>
        </div>
        {errorLine}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" disabled={busy} onClick={onDone}>
          {report ? t('addStudents.done') : t('dialog.cancel')}
        </Button>
        <Button disabled={busy || lines.length === 0} onClick={() => void check(lines)}>
          {work === 'checking' ? t('addStudents.checking') : t('addStudents.check')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** บรรทัดบอกว่าอ่านไฟล์จากตรงไหน พบกี่รายการ */
function fileSummary(file: RosterFile, t: ReturnType<typeof useTranslation>['t']): string {
  const total = file.identifiers.length
  const { sheet, column } = file
  if (sheet && column) return t('addStudents.fileSheetColumn', { sheet, column, total })
  if (sheet) return t('addStudents.fileSheet', { sheet, total })
  if (column) return t('addStudents.fileColumn', { column, total })
  return t('addStudents.filePlain', { total })
}
