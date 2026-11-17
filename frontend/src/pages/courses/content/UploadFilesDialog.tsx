/**
 * หน้าต่างอัปโหลดหลายไฟล์ (ตาม board "อัปโหลดหลายไฟล์" จอใหญ่ + มือถือ และ "อัปโหลดไม่ผ่าน" — ขั้น 4.6 ข)
 *
 *   ┌ อัปโหลดไฟล์                                                  ✕ ┐
 *   │ หน่วยที่ 3 โครงสร้างควบคุมทิศทาง                                 │
 *   │ ┌╌╌ ⇡ ลากไฟล์มาวางเพิ่มที่นี่ หรือ [เลือกไฟล์] ╌╌┐               │  ← ยังไม่เลือก = กล่องใหญ่ (กส1)
 *   │ ไฟล์ที่เลือก 6 ไฟล์                     อัปโหลดแล้ว 2 จาก 4 ไฟล์ │
 *   │ ┌ ▣ แผนภาพ-for-loop.png  รูปภาพ · 340 KB        ✓ อัปโหลดแล้ว ┐ │  ← รายการเลื่อนในตัว (จอใหญ่)
 *   │ │ ▣ if-elif-else.mp4  37.2 จาก 64.2 MB (58%) ▬▬▬▭     ยกเลิก │ │
 *   │ │ ▣ สรุป.m4a  เสียง · 4.8 MB                  ◷ รอคิว  เอาออก │ │
 *   │ └ ⚠ ใบงาน3.exe  ไม่รองรับไฟล์ .exe                            ┘ │
 *   │ เลือกได้ครั้งละไม่เกิน 20 ไฟล์ …   (ตารางชนิดไฟล์ + ขนาดสูงสุด)       │
 *   │ หัวข้อใช้ชื่อไฟล์ …          [หยุดไฟล์ที่เหลือ] [กำลังอัปโหลด…]      │
 *   └────────────────────────────────────────────────────────────────┘
 *   จบแล้ว: แถบเขียว "อัปโหลดแล้ว N ไฟล์" / แดง "อัปโหลดไม่ได้ M ไฟล์" + [อัปโหลดไฟล์อื่นเพิ่ม] [เสร็จ]
 *   มือถือ: เต็มจอ ปุ่ม "เลือกไฟล์เพิ่ม" เต็มความกว้าง (ไม่มีลากวาง) ปุ่มล่างติดจอ ทั้งหน้าต่างเลื่อน
 *
 * การทำงานอยู่ใน useUploadQueue.ts (ส่งทีละไฟล์, ยกเลิก / เอาออก / ลองใหม่ / หยุดไฟล์ที่เหลือ)
 * - เลือกแล้วเริ่มส่งทันที (board ไม่มีปุ่มเริ่ม) ; ระหว่างส่งเลือก / ลากเพิ่มได้ ต่อท้ายคิว
 * - ปิดหน้าต่างระหว่างส่ง → ถามยืนยัน (กญ1) ; ออกจากหน้าระหว่างส่ง → ถามยืนยันทุกทาง (useLeaveGuard — กล1)
 * - โฟกัส: ปุ่มที่หายไปหลังกด (ยกเลิก / เอาออก / ลองใหม่) → โฟกัสหัวรายการ "ไฟล์ที่เลือก N ไฟล์"
 *   ปุ่มล่างซ้ายเปลี่ยนชื่อในตำแหน่งเดิม (หยุดไฟล์ที่เหลือ → อัปโหลดไฟล์อื่นเพิ่ม) โฟกัสจึงไม่หลุด
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Module } from '../../../api/content'
import { Button, ConfirmDialog, Dialog, DialogBody, DialogFooter, DialogHeader } from '../../../components/ui'
import { useLeaveGuard } from '../../../lib/useLeaveGuard'
import { refreshModules } from '../courseCache'
import { CheckIcon, UploadIcon, WarnIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'
import { ClockIcon, ContentKindIcon, DoneIcon } from './contentIcons'
import { formatFileSize } from './contentLabels'
import { fileKindName, fileProblemMessage } from './contentNames'
import { LOCKED } from './RowControls'
import { acceptFor, CONTENT_MAX_BYTES, CONTENT_VIDEO_MAX_BYTES } from './fileRules'
import { MAX_FILES_PER_PICK, useUploadQueue, type UploadItem } from './useUploadQueue'

type UploadFilesDialogProps = {
  /** หน่วยที่จะอัปโหลดเข้า + ลำดับบนจอ */
  module: Module
  number: number
  onClose: () => void
}

export function UploadFilesDialog({ module, number, onClose }: UploadFilesDialogProps) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const queryClient = useQueryClient()
  const titleId = useId()
  const chooseRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listHeadingRef = useRef<HTMLSpanElement>(null)
  const [pickError, setPickError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const refresh = useCallback(() => void refreshModules(queryClient, course.id), [queryClient, course.id])
  const queue = useUploadQueue(course.id, module.id, refresh)
  const { items, running } = queue
  const leave = useLeaveGuard(running)

  // นับตามสถานะ
  const count = (status: UploadItem['status']) => items.filter((item) => item.status === status).length
  const done = count('done')
  const invalid = count('invalid')
  const failed = count('failed')
  const cancelled = count('cancelled')
  /** ไฟล์ที่จะ / ได้ส่ง (ไม่นับไฟล์แดงที่ตรวจไม่ผ่าน และไฟล์ที่ยกเลิก) */
  const sendable = items.length - invalid - cancelled
  /** จบแล้ว: มีรายการ แต่ไม่มีไฟล์กำลังส่งหรือรอคิว → หน้าสรุปผล */
  const finished = items.length > 0 && !running && !items.some((item) => item.status === 'queued')

  /** รับไฟล์จากช่องเลือก / การลากวาง */
  function takeFiles(files: File[]) {
    const tooMany = queue.addFiles(files)
    setPickError(
      tooMany === null ? undefined : t('content.tooManyFiles', { max: MAX_FILES_PER_PICK, count: tooMany }),
    )
  }

  // ลากวางได้ทั้งหน้าต่าง (กันเบราว์เซอร์เปิดไฟล์แทนหน้าเว็บเมื่อวางพลาดกล่อง) ; หน้าสรุปผลไม่รับไฟล์เพิ่ม
  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!finished) setDragging(true)
  }
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
  }
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (!finished) takeFiles(Array.from(event.dataTransfer.files))
  }

  /** ปุ่มในแถวที่กดแล้วตัวเองหายไป → ย้ายโฟกัสไปหัวรายการ (ไม่ให้หลุดไปต้นหน้าต่าง) */
  const afterRowAction = (action: () => void) => () => {
    action()
    listHeadingRef.current?.focus()
  }

  const requestClose = () => {
    if (running) setConfirmClose(true)
    else onClose()
  }

  /** "อัปโหลดไฟล์อื่นเพิ่ม": ล้างรายการแล้วเปิดหน้าต่างเลือกไฟล์ของเครื่อง */
  function uploadMore() {
    queue.reset()
    setPickError(undefined)
    inputRef.current?.click()
  }

  return (
    <Dialog labelledBy={titleId} onClose={requestClose} initialFocusRef={chooseRef} size="lg">
      <DialogHeader
        titleId={titleId}
        title={t('content.uploadTitle')}
        subtitle={t('content.dialogModule', { number, title: module.title })}
        onClose={requestClose}
      />
      {/* จอใหญ่: หัว + ปุ่มล่างอยู่กับที่ (กญ1) — รายการไฟล์เลื่อนในตัว (สูงไม่เกิน 340px ตาม board)
          และถ้าจอเตี้ยจนไม่พอ ส่วนกลางทั้งหมดเลื่อนได้ (เดิมลองให้รายการหด → จอ 639px เหลือรายการแค่ 1 แถว)
          มือถือ: สูงตามเนื้อหา ทั้งหน้าต่างเลื่อน ปุ่มล่างติดจอ */}
      <div
        className="flex grow flex-col lg:min-h-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <DialogBody className="lg:min-h-0 lg:overflow-y-auto">
          {/* กล่องสถานะอยู่ตลอด (โปรแกรมอ่านหน้าจออ่านเมื่อมีข้อความเข้ามา) — ว่าง = ซ่อน */}
          <div role="status" className="flex flex-col gap-2.5 empty:hidden">
            {finished && (
              <Summary done={done} failed={failed + invalid} cancelled={cancelled} number={number} />
            )}
          </div>
          {queue.haltReason && (
            <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
              {queue.haltReason}
            </p>
          )}

          {!finished && (
            <div className="flex flex-col gap-1.5">
              {/* กล่องเลือก / ลากไฟล์ — ปุ่มเป็น element เดิมทุกสถานะ (โฟกัสไม่หลุดหลังเลือกไฟล์) */}
              <div
                role="group"
                aria-label={t('content.dropGroup')}
                className={
                  'flex flex-col items-center gap-2.5 rounded-[12px] border-[1.5px] border-dashed bg-surface p-4 text-center ' +
                  'lg:gap-3.5 lg:px-5 ' +
                  (items.length > 0 ? 'lg:flex-row lg:justify-center lg:py-4 ' : 'lg:py-[26px] ') +
                  (dragging ? 'border-brand bg-canvas' : pickError ? 'border-bad' : 'border-line-strong')
                }
              >
                <span className="flex text-brand max-lg:hidden">
                  <UploadIcon />
                </span>
                <span className="text-[15px] max-lg:hidden">
                  {items.length > 0 ? t('content.dropMore') : t('content.dropTitle')}
                </span>
                <Button
                  ref={chooseRef}
                  variant="secondary"
                  className="max-lg:w-full"
                  onClick={() => inputRef.current?.click()}
                >
                  <span className="lg:hidden">
                    <UploadIcon />
                  </span>
                  {items.length > 0 ? (
                    // มีไฟล์แล้ว: มือถือ "เลือกไฟล์เพิ่ม" / จอใหญ่ "เลือกไฟล์" (ข้อความข้างกล่องบอกว่า "เพิ่ม" แล้ว)
                    <>
                      <span className="lg:hidden">{t('content.chooseMoreFiles')}</span>
                      <span className="max-lg:hidden">{t('content.chooseFiles')}</span>
                    </>
                  ) : (
                    t('content.chooseFiles')
                  )}
                </Button>
                <span className="text-[13.5px] text-ink-muted lg:hidden">
                  {t('content.chooseHintMobile')}
                </span>
              </div>
              {pickError && (
                <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
                  {pickError}
                </p>
              )}
            </div>
          )}
          {/* ช่องเลือกไฟล์ของเครื่อง (ซ่อน) — เลือกได้หลายไฟล์ กรองเฉพาะนามสกุลที่รับ */}
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            tabIndex={-1}
            accept={acceptFor()}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              // ล้างค่า → เลือกไฟล์ชุดเดิมซ้ำได้
              event.target.value = ''
              takeFiles(files)
            }}
          />

          {items.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                {/* tabIndex -1: รับโฟกัสด้วยโค้ดหลังปุ่มในแถวหายไป */}
                <span ref={listHeadingRef} tabIndex={-1} className="text-[15px] font-semibold outline-none">
                  {t('content.selectedCount', { count: items.length })}
                </span>
                {sendable > 0 && (
                  <span role="status" className="text-[13.5px] text-ink-muted lg:text-sm">
                    {t('content.uploadedOf', { done, total: sendable })}
                  </span>
                )}
              </div>
              <ul className="m-0 list-none divide-y divide-line-soft overflow-hidden rounded-[12px] border border-line bg-surface p-0 lg:max-h-[340px] lg:shrink-0 lg:overflow-y-auto">
                {items.map((item) => (
                  <FileRow
                    key={item.key}
                    item={item}
                    onCancel={afterRowAction(() => queue.cancel(item.key))}
                    onRemove={afterRowAction(() => queue.remove(item.key))}
                    onRetry={afterRowAction(() => queue.retry(item.key))}
                  />
                ))}
              </ul>
              {!finished && invalid > 0 && (
                <p className="m-0 text-[13.5px] font-medium text-bad">
                  {t('content.invalidNote', { count: invalid })}
                </p>
              )}
            </div>
          )}

          {!finished && <FileRules />}
          {/* มือถือ: คำอธิบายหัวข้อ / สถานะอยู่ในเนื้อหน้าต่าง (จอใหญ่อยู่ข้างปุ่ม) */}
          {!finished && (
            <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted lg:hidden">
              {t('content.uploadFooterHint')}
            </p>
          )}
        </DialogBody>
        <DialogFooter
          mobileColumns={
            finished
              ? // "อัปโหลดไฟล์อื่นเพิ่ม" ยาวกว่า "เสร็จ" → ปุ่มซ้ายกว้างกว่า (จอ 320px ข้อความไม่ชนขอบ)
                'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'
              : running
                ? undefined
                : 'grid-cols-1'
          }
        >
          {!finished && (
            <span className="mr-auto self-center text-[13.5px] leading-[1.55] text-ink-muted max-lg:hidden">
              {t('content.uploadFooterHint')}
            </span>
          )}
          {/* ปุ่มซ้าย: ตำแหน่งเดียวกันทุกสถานะ (React ใช้ปุ่มเดิม โฟกัสอยู่ต่อเมื่อเปลี่ยนสถานะ) */}
          {running ? (
            <Button
              variant="secondary"
              className={LOCKED}
              aria-disabled={!queue.canStop || undefined}
              onClick={() => {
                if (queue.canStop) queue.stopAll()
              }}
            >
              {t('content.stopRemaining')}
            </Button>
          ) : finished ? (
            <Button variant="secondary" onClick={uploadMore}>
              {t('content.uploadMore')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              {t('dialog.cancel')}
            </Button>
          )}
          {running ? (
            <Button disabled>{t('content.uploadingAll')}</Button>
          ) : (
            finished && <Button onClick={onClose}>{t('content.uploadFinish')}</Button>
          )}
        </DialogFooter>
      </div>

      {/* ปิดหน้าต่างระหว่างส่ง → ถามก่อน (โฟกัส "อัปโหลดต่อ" ก่อน) */}
      {confirmClose && (
        <ConfirmDialog
          title={t('content.closeUploadTitle')}
          description={[t('content.stopUploadBody')]}
          confirmLabel={t('content.closeUploadConfirm')}
          cancelLabel={t('content.keepUploading')}
          onConfirm={() => {
            queue.stopAll()
            setConfirmClose(false)
            onClose()
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      {/* ออกจากหน้า (เมนู / ปุ่มย้อนกลับ / ออกจากระบบ) ระหว่างส่ง — กล1 */}
      {leave.asking && (
        <ConfirmDialog
          title={t('content.leaveUploadTitle')}
          description={[t('content.stopUploadBody')]}
          confirmLabel={t('content.leaveUploadConfirm')}
          cancelLabel={t('content.keepUploading')}
          onConfirm={() => {
            queue.stopAll()
            leave.proceed()
          }}
          onCancel={leave.stay}
        />
      )}
    </Dialog>
  )
}

/** ไฟล์ 1 แถว: ไอคอน │ ชื่อ + รายละเอียด / แถบความคืบหน้า / เหตุผล │ สถานะ + ปุ่ม */
function FileRow({
  item,
  onCancel,
  onRemove,
  onRetry,
}: {
  item: UploadItem
  onCancel: () => void
  onRemove: () => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const bad = item.status === 'invalid' || item.status === 'failed'
  const name = item.file.name
  const size = formatFileSize(item.file.size, t)
  const percent = item.file.size > 0 ? Math.round((item.loaded / item.file.size) * 100) : 0

  // บรรทัดรองใต้ชื่อ
  let meta: ReactNode
  if (item.status === 'invalid' && item.problem) {
    meta = fileProblemMessage(item.problem, item.file.size, t)
  } else if (item.status === 'failed') {
    meta = item.error
  } else if (item.status === 'uploading') {
    meta = item.sent
      ? t('content.uploadSaving')
      : t('content.rowProgress', {
          loaded: formatFileSize(item.loaded, t),
          total: size,
          percent: Math.min(percent, 100),
        })
  } else {
    meta = (
      <>
        {item.kind && <span>{fileKindName(item.kind, t)}</span>}
        <span>{size}</span>
      </>
    )
  }

  // ด้านขวา: สถานะ + ปุ่ม
  let side: ReactNode = null
  if (item.status === 'done') {
    side = (
      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold whitespace-nowrap text-ok">
        <DoneIcon />
        {t('content.statusDone')}
      </span>
    )
  } else if (item.status === 'queued') {
    side = (
      <>
        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium whitespace-nowrap text-ink-muted">
          <ClockIcon />
          {t('content.statusQueued')}
        </span>
        <Button variant="text" onClick={onRemove} aria-label={t('content.removeFileLabel', { name })}>
          {t('content.removeFile')}
        </Button>
      </>
    )
  } else if (item.status === 'uploading' && !item.sent) {
    // ส่งครบทุกไบต์แล้ว (sent) ซ่อนปุ่ม — หยุดเซิร์ฟเวอร์ไม่ได้แล้ว (กติกาเดียวกับขั้น 4.6 ก กศ1)
    side = (
      <Button variant="text" onClick={onCancel} aria-label={t('content.cancelFileLabel', { name })}>
        {t('content.cancelFile')}
      </Button>
    )
  } else if (item.status === 'failed' && item.retryable) {
    side = (
      <Button variant="text" onClick={onRetry} aria-label={t('content.retryFileLabel', { name })}>
        {t('content.retryFile')}
      </Button>
    )
  } else if (item.status === 'cancelled') {
    side = (
      <span className="text-[13.5px] font-medium whitespace-nowrap text-ink-muted">
        {t('content.statusCancelled')}
      </span>
    )
  }

  return (
    <li
      className={
        'grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 px-3.5 py-3 ' +
        'lg:flex lg:items-center lg:gap-3.5 ' +
        (bad ? 'bg-bad-soft' : '')
      }
    >
      <span
        className={
          'flex size-10 shrink-0 items-center justify-center rounded-[10px] ' +
          (bad ? 'bg-surface text-bad' : 'bg-canvas text-brand')
        }
      >
        {bad ? <WarnIcon /> : <ContentKindIcon kind={item.kind ?? 'file'} size={20} />}
      </span>
      <div className="min-w-0 grow">
        <div className={'text-[15px] font-semibold [overflow-wrap:anywhere] ' + (bad ? 'text-bad' : '')}>
          {name}
        </div>
        <div
          className={
            'flex flex-wrap gap-x-3 text-[13.5px] leading-[1.55] ' + (bad ? 'text-bad' : 'text-ink-muted')
          }
        >
          {meta}
        </div>
        {item.status === 'invalid' && item.problem?.code === 'too_large' && item.problem.kind === 'video' && (
          <div className="mt-0.5 text-[13.5px] font-medium text-bad">{t('content.videoTooLargeTip')}</div>
        )}
        {item.status === 'uploading' && (
          // ตัวเลขเปลี่ยนหลายครั้งต่อวินาที — ไม่ประกาศ (ถามค่าจาก progressbar ได้ ; ประกาศเฉพาะ "อัปโหลดแล้ว x จาก y")
          <div
            role="progressbar"
            aria-label={t('content.rowProgressLabel', { name })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent, 100)}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-track"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(percent, 100)}%` }} />
          </div>
        )}
      </div>
      {side && <div className="col-start-2 flex shrink-0 items-center gap-1 lg:col-auto">{side}</div>}
    </li>
  )
}

/** ตารางชนิดไฟล์ที่รับ + ขนาดสูงสุด (ตรงกับ fileRules.ts) */
function FileRules() {
  const { t } = useTranslation()
  // เพดานเป็นจำนวน MB เต็ม → แสดง "20 MB" / "100 MB" แบบ board (ไม่มีทศนิยม)
  const mb = (bytes: number) => t('content.sizeMb', { size: bytes / (1024 * 1024) })
  const small = mb(CONTENT_MAX_BYTES)
  const rows = [
    [t('content.kindNameFile'), t('content.rulesFileTypes'), small],
    [t('content.kindNameImage'), t('content.rulesImageTypes'), small],
    [t('content.kindNameAudio'), t('content.rulesAudioTypes'), small],
    [t('content.kindNameVideo'), t('content.rulesVideoTypes'), mb(CONTENT_VIDEO_MAX_BYTES)],
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
        {t('content.rulesHint', { max: MAX_FILES_PER_PICK })}
      </p>
      <dl
        aria-label={t('content.rulesLabel')}
        className="m-0 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13.5px] leading-normal text-ink-muted"
      >
        {rows.map(([kind, types, max]) => (
          <div key={kind} className="contents">
            <dt className="font-semibold text-ink">{kind}</dt>
            <dd className="m-0">{types}</dd>
            <dd className="m-0 text-right whitespace-nowrap">{max}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** สรุปผลเมื่อจบ: เขียว = อัปโหลดแล้ว ; แดง = อัปโหลดไม่ได้ ; เทา = ยกเลิก */
function Summary({
  done,
  failed,
  cancelled,
  number,
}: {
  done: number
  failed: number
  cancelled: number
  number: number
}) {
  const { t } = useTranslation()
  const note = (tone: string, icon: ReactNode, title: string, body: string) => (
    <div className={`flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-sm leading-[1.55] ${tone}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="m-0">
        <b>{title}</b> {body}
      </p>
    </div>
  )
  return (
    <>
      {done > 0 &&
        note(
          'bg-ok-soft text-ok',
          <CheckIcon />,
          t('content.summaryDone', { count: done }),
          t('content.summaryDoneBody', { number }),
        )}
      {failed > 0 &&
        note(
          'bg-bad-soft text-bad',
          <WarnIcon />,
          t('content.summaryFailed', { count: failed }),
          t('content.summaryFailedBody'),
        )}
      {cancelled > 0 &&
        note(
          'bg-mute-soft text-mute',
          <ClockIcon />,
          t('content.summaryCancelled', { count: cancelled }),
          t('content.summaryCancelledBody'),
        )}
    </>
  )
}
