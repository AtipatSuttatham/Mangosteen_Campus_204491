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
 *   + สิ่งที่โฟกัสอยู่หายไปเพราะหน้าต่างเปลี่ยนเอง (ส่งจบ → กล่องเลือกไฟล์หาย, คิวเดิน → ปุ่มในแถวเปลี่ยน)
 *     → โฟกัสหัวรายการเช่นกัน (แก้หลังตรวจขั้น 4.6 ข — กฮ1 ; กติกาเดียวกับ กภ1)
 * - ระหว่างหน้าต่างเปิด วางไฟล์พลาดนอกพื้นที่รับ (หัวหน้าต่าง / พื้นมืด) → ไม่ทำอะไร
 *   (ไม่งั้นเบราว์เซอร์เปิดไฟล์นั้นแทนหน้าเว็บ — กฮ1)
 *
 * ไฟล์ชื่อซ้ำ (ชซ1 — board "อัปโหลดไฟล์ชื่อซ้ำ" / "เปลี่ยนชื่อไฟล์ที่ซ้ำ" / "อัปโหลดไฟล์เดียวที่ชื่อซ้ำ" / มือถือ):
 *   │ ⚠ มี 2 ไฟล์ที่ชื่อซ้ำกับไฟล์ในหน่วยนี้ … (อธิบาย 4 ปุ่ม)                     │  ← กล่องส้มเมื่อมีไฟล์รอเลือก
 *   │ ⧉ บทที่3-ลูป.pdf  มีไฟล์ชื่อนี้ในหน่วยนี้แล้ว / ไฟล์เดิม: …     ◷ รอเลือก │  ← แถวพื้นส้มอ่อน
 *   │    [ยืนยัน] [แทนที่] [เปลี่ยนชื่อ] ยกเลิก                                 │
 *   │                                 [ยกเลิก] [รอเลือก 2 ไฟล์]               │  ← ไม่มีไฟล์กำลังส่ง
 * - ไฟล์ที่รอเลือกไม่ขวางไฟล์อื่น ; ยังรอเลือกอยู่ = ยังไม่สรุปผล
 * - ไม่มีไฟล์กำลังส่ง → ปุ่มซ้าย "ยกเลิก" ปิดได้ทันทีโดยไม่ถาม (ยังไม่มีอะไรถูกส่ง ไฟล์ที่รอเลือกไม่ถูกอัปโหลด)
 * - โฟกัส: ยืนยัน / แทนที่ / ยกเลิก / ส่งชื่อใหม่สำเร็จ → หัวรายการ (ปุ่มหายไป — กติกาเดียวกับ กภ1) ;
 *   เปลี่ยนชื่อ → ช่องชื่อใหม่ ; กลับ → ปุ่ม "เปลี่ยนชื่อ" ของแถวเดิม
 */
import { useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { Content, Module } from '../../../api/content'
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  TextField,
} from '../../../components/ui'
import { formatDateTime } from '../../../lib/datetime'
import { useLeaveGuard } from '../../../lib/useLeaveGuard'
import { modulesKey, refreshModules } from '../courseCache'
import { CheckIcon, UploadIcon, WarnIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'
import { ClockIcon, ContentKindIcon, DoneIcon } from './contentIcons'
import { formatFileSize } from './contentLabels'
import { fileKindName, fileProblemMessage } from './contentNames'
import { LOCKED } from './RowControls'
import { splitName, suggestStem, type RenameProblem } from './duplicateNames'
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
  /** element ล่าสุดที่ได้โฟกัสในหน้าต่าง — ใช้รู้ว่าโฟกัสหลุดเพราะ element นั้นถูกถอดออก */
  const lastFocusRef = useRef<HTMLElement | null>(null)

  const refresh = useCallback(() => void refreshModules(queryClient, course.id), [queryClient, course.id])
  // เนื้อหาล่าสุดของหน่วยจากแคช (โหลดใหม่หลังส่งแต่ละไฟล์) — module ที่ได้มาเป็นภาพตอนเปิดหน้าต่าง อาจเก่าแล้ว
  const getContents = useCallback(
    () =>
      (
        queryClient.getQueryData<Module[]>(modulesKey(course.id))?.find((entry) => entry.id === module.id) ??
        module
      ).contents,
    [queryClient, course.id, module],
  )
  const queue = useUploadQueue(course.id, module.id, refresh, getContents)
  const { items, running } = queue
  const leave = useLeaveGuard(running)

  // โฟกัสหลุดเพราะสิ่งที่โฟกัสอยู่ถูกถอดออก (ไม่ใช่ผู้ใช้คลิกที่อื่น) → ย้ายไปหัวรายการ / ปุ่มเลือกไฟล์
  // ตรวจหลังวาดทุกครั้ง เพราะหน้าต่างเปลี่ยนเองได้ตลอดระหว่างส่ง (ความคืบหน้า / คิวเดิน / ส่งจบ)
  useEffect(() => {
    const last = lastFocusRef.current
    if (!last || last.isConnected || document.activeElement !== document.body) return
    lastFocusRef.current = null
    ;(listHeadingRef.current ?? chooseRef.current)?.focus()
  })

  // วางไฟล์พลาดนอกพื้นที่รับ → กันเบราว์เซอร์เปิดไฟล์แทนหน้าเว็บ (ในพื้นที่รับ ตัวจัดการด้านล่างรับไฟล์ตามปกติ)
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => event.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  // นับตามสถานะ
  const count = (status: UploadItem['status']) => items.filter((item) => item.status === status).length
  const done = count('done')
  const invalid = count('invalid')
  const failed = count('failed')
  const cancelled = count('cancelled')
  /** ไฟล์ชื่อซ้ำที่รอผู้ใช้เลือก (ชซ1) */
  const waiting = count('duplicate')
  /** ส่งสำเร็จแบบ "แทนที่" (นับรวมใน done ด้วย) */
  const replaced = items.filter((item) => item.status === 'done' && item.replaceId !== null).length
  /** ไฟล์ที่จะ / ได้ส่ง (ไม่นับไฟล์แดงที่ตรวจไม่ผ่าน และไฟล์ที่ยกเลิก) */
  const sendable = items.length - invalid - cancelled
  /** จบแล้ว: มีรายการ แต่ไม่มีไฟล์กำลังส่ง / รอคิว / รอเลือก → หน้าสรุปผล */
  const finished =
    items.length > 0 && !running && !items.some((item) => item.status === 'queued') && waiting === 0

  /** รับไฟล์จากช่องเลือก / การลากวาง */
  function takeFiles(files: File[]) {
    const tooMany = queue.addFiles(files)
    setPickError(
      tooMany === null ? undefined : t('content.tooManyFiles', { max: MAX_FILES_PER_PICK, count: tooMany }),
    )
  }

  // วางไฟล์ได้ทั้งเนื้อหน้าต่างและแถบปุ่ม (ไม่ต้องตรงกล่องพอดี) ; หน้าสรุปผลไม่รับไฟล์เพิ่ม
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
        onFocus={(event) => {
          lastFocusRef.current = event.target
        }}
      >
        <DialogBody className="lg:min-h-0 lg:overflow-y-auto">
          {/* กล่องสถานะอยู่ตลอด (โปรแกรมอ่านหน้าจออ่านเมื่อมีข้อความเข้ามา) — ว่าง = ซ่อน */}
          <div role="status" className="flex flex-col gap-2.5 empty:hidden">
            {finished && (
              <Summary
                done={done}
                replaced={replaced}
                failed={failed + invalid}
                cancelled={cancelled}
                number={number}
              />
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

          {waiting > 0 && <DuplicateNote count={waiting} />}

          {items.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                {/* tabIndex -1: รับโฟกัสด้วยโค้ดหลังปุ่มในแถวหายไป */}
                <span ref={listHeadingRef} tabIndex={-1} className="text-[15px] font-semibold outline-none">
                  {t('content.selectedCount', { count: items.length })}
                </span>
                {sendable > 0 && (
                  <span role="status" className="text-[13.5px] text-ink-muted lg:text-sm">
                    {waiting > 0
                      ? t('content.uploadedOfWaiting', { done, total: sendable, waiting })
                      : t('content.uploadedOf', { done, total: sendable })}
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
                    onKeepBoth={afterRowAction(() => queue.keepBoth(item.key))}
                    onReplace={afterRowAction(() => queue.replace(item.key))}
                    onSkip={afterRowAction(() => queue.skip(item.key))}
                    onRename={(stem) => {
                      const problem = queue.rename(item.key, stem)
                      if (!problem) listHeadingRef.current?.focus()
                      return problem
                    }}
                    knownContents={queue.knownContents}
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
              : running || waiting > 0
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
          ) : finished ? (
            <Button onClick={onClose}>{t('content.uploadFinish')}</Button>
          ) : (
            // คิวว่างแล้วแต่ยังมีไฟล์ชื่อซ้ำรอเลือก — บอกว่ารออะไร (กดไม่ได้)
            waiting > 0 && <Button disabled>{t('content.waitingChoice', { count: waiting })}</Button>
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
  onKeepBoth,
  onReplace,
  onSkip,
  onRename,
  knownContents,
}: {
  item: UploadItem
  onCancel: () => void
  onRemove: () => void
  onRetry: () => void
  onKeepBoth: () => void
  onReplace: () => void
  onSkip: () => void
  /** ส่งชื่อใหม่ (ส่วนชื่อ) → ปัญหาของชื่อ หรือ null เมื่อส่งเข้าคิวแล้ว */
  onRename: (stem: string) => RenameProblem | null
  knownContents: () => Content[]
}) {
  const { t } = useTranslation()
  const bad = item.status === 'invalid' || item.status === 'failed'
  const duplicate = item.status === 'duplicate'
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
  } else if (duplicate && item.duplicateOf) {
    meta = <DuplicateMeta existing={item.duplicateOf} />
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
        {item.replaceId !== null ? t('content.statusReplaced') : t('content.statusDone')}
      </span>
    )
  } else if (duplicate) {
    side = (
      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold whitespace-nowrap text-warn">
        <ClockIcon />
        {t('content.statusWaitingChoice')}
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
        (bad ? 'bg-bad-soft' : '') +
        // ชื่อซ้ำ: พื้นส้มอ่อน + ปุ่มเลือกขึ้นบรรทัดใหม่ใต้ชื่อ (จอใหญ่ห่อบรรทัด)
        (duplicate ? 'bg-warn-soft/40 lg:flex-wrap' : '')
      }
    >
      <span
        className={
          'flex size-10 shrink-0 items-center justify-center rounded-[10px] ' +
          (bad ? 'bg-surface text-bad' : duplicate ? 'bg-warn-soft text-warn' : 'bg-canvas text-brand')
        }
      >
        {bad ? (
          <WarnIcon />
        ) : duplicate ? (
          <DuplicateIcon />
        ) : (
          <ContentKindIcon kind={item.kind ?? 'file'} size={20} />
        )}
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
      {duplicate && (
        <DuplicateChoice
          name={name}
          onKeepBoth={onKeepBoth}
          onReplace={onReplace}
          onSkip={onSkip}
          onRename={onRename}
          suggest={() => suggestStem(name, knownContents())}
        />
      )}
    </li>
  )
}

/** บรรทัดรองของแถวชื่อซ้ำ: บอกว่าซ้ำ + ข้อมูลไฟล์เดิม (ให้ผู้สอนรู้ว่าจะแทนที่อะไร) */
function DuplicateMeta({ existing }: { existing: Content }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-warn">{t('content.duplicateFound')}</span>
      <span>
        {t('content.duplicateExisting', {
          status: existing.is_published ? t('content.duplicatePublished') : t('content.duplicateDraft'),
          size: existing.file_size === null ? '' : formatFileSize(existing.file_size, t),
          date: formatDateTime(existing.updated_at),
        })}
      </span>
    </div>
  )
}

/**
 * ปุ่มเลือก 4 ทางของแถวชื่อซ้ำ / ช่องเปลี่ยนชื่อ (ชซ1)
 * จอใหญ่: เรียงแถวใต้ชื่อ (เยื้องตรงชื่อ) ; มือถือ: ตาราง 2×2 เต็มความกว้าง
 */
function DuplicateChoice({
  name,
  onKeepBoth,
  onReplace,
  onSkip,
  onRename,
  suggest,
}: {
  name: string
  onKeepBoth: () => void
  onReplace: () => void
  onSkip: () => void
  onRename: (stem: string) => RenameProblem | null
  /** ชื่อตั้งต้นของช่อง (เติม (2), (3) … จนไม่ซ้ำ) */
  suggest: () => string
}) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const [stem, setStem] = useState('')
  const [problem, setProblem] = useState<RenameProblem | null>(null)
  const renameButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** กด "กลับ" แล้ว → โฟกัสปุ่ม "เปลี่ยนชื่อ" หลังวาดใหม่ (ไม่ให้โฟกัสหลุดไปหัวรายการ) */
  const returnFocusRef = useRef(false)
  const { ext } = splitName(name)

  // effect ของแถวทำงานก่อน effect ของหน้าต่าง (ตัวที่ย้ายโฟกัสที่หลุดไปหัวรายการ) → โฟกัสตรงนี้ได้ก่อน
  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false
      renameButtonRef.current?.focus()
    }
  }, [renaming])

  function startRename() {
    setStem(suggest())
    setProblem(null)
    setRenaming(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setProblem(onRename(stem))
  }

  const wrap = 'col-span-full lg:basis-full lg:pl-[54px]'

  if (renaming) {
    return (
      <form className={`${wrap} flex flex-col gap-2.5 pt-1`} onSubmit={submit} noValidate>
        <TextField
          ref={inputRef}
          label={t('content.renameLabel')}
          value={stem}
          onChange={(event) => {
            setStem(event.target.value)
            setProblem(null)
          }}
          error={problem ? t(`content.renameProblem.${problem}`) : undefined}
          hint={t('content.renameHint')}
          // นามสกุลล็อกไว้ (backend ดูชนิดไฟล์จากนามสกุล) — แสดงท้ายช่องให้รู้ว่าชื่อเต็มเป็นอะไร
          trailing={
            <span className="flex h-10 items-center px-2.5 text-[15px] text-ink-muted" aria-hidden="true">
              {ext}
            </span>
          }
          aria-label={t('content.renameInputLabel', { name, ext })}
          className="lg:max-w-[440px]"
        />
        {/* มือถือเรียงลงเต็มความกว้าง: จอ 320px แบ่ง 2 คอลัมน์แล้ว "อัปโหลดด้วยชื่อนี้" ล้นปุ่ม (พบตอนทดสอบใน Chrome) */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Button type="submit">{t('content.renameSubmit')}</Button>
          <Button
            variant="text"
            onClick={() => {
              returnFocusRef.current = true
              setRenaming(false)
            }}
          >
            {t('content.renameBack')}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div
      role="group"
      aria-label={t('content.duplicateChoiceLabel', { name })}
      className={`${wrap} grid grid-cols-2 gap-2 pt-1 lg:flex lg:flex-wrap lg:items-center`}
    >
      <Button variant="secondary" onClick={onKeepBoth} aria-label={t('content.keepBothLabel', { name })}>
        {t('content.keepBoth')}
      </Button>
      <Button variant="secondary" onClick={onReplace} aria-label={t('content.replaceLabel', { name })}>
        {t('content.replace')}
      </Button>
      <Button
        ref={renameButtonRef}
        variant="secondary"
        onClick={startRename}
        aria-label={t('content.renameLabelButton', { name })}
      >
        {t('content.rename')}
      </Button>
      <Button variant="text" onClick={onSkip} aria-label={t('content.skipLabel', { name })}>
        {t('content.skip')}
      </Button>
    </div>
  )
}

/** กล่องส้มเหนือรายการเมื่อมีไฟล์ชื่อซ้ำรอเลือก — อธิบาย 4 ปุ่มครั้งเดียว (ไม่ซ้ำทุกแถว) */
function DuplicateNote({ count }: { count: number }) {
  const { t } = useTranslation()
  const terms = [
    [t('content.keepBoth'), t('content.keepBothHelp')],
    [t('content.replace'), t('content.replaceHelp')],
    [t('content.rename'), t('content.renameHelp')],
    [t('content.skip'), t('content.skipHelp')],
  ]
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-warn-soft px-3.5 py-3 text-sm leading-[1.6] text-warn">
      <span className="mt-0.5 shrink-0">
        <WarnIcon />
      </span>
      <div>
        <p className="m-0">
          <b>{count === 1 ? t('content.duplicateNoteOne') : t('content.duplicateNoteMany', { count })}</b>{' '}
          {count === 1 ? t('content.duplicateNoteOneBody') : t('content.duplicateNoteManyBody')}
        </p>
        <dl className="m-0 mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 text-ink">
          {terms.map(([term, help]) => (
            <div key={term} className="contents">
              <dt className="font-semibold text-warn">{term}</dt>
              <dd className="m-0">{help}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

/** ไอคอนไฟล์ซ้อนกัน 2 แผ่น (แถวชื่อซ้ำ) — ตกแต่งอย่างเดียว */
function DuplicateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="3.5" width="12" height="14" rx="1.5" />
      <path d="M16 17.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1h3" />
    </svg>
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
  replaced,
  failed,
  cancelled,
  number,
}: {
  done: number
  /** ในจำนวน done มีกี่ไฟล์ที่แทนที่ไฟล์เดิม (ชซ1) */
  replaced: number
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
          replaced > 0
            ? t('content.summaryDoneReplaced', { count: done, replaced })
            : t('content.summaryDone', { count: done }),
          // แทนที่ทั้งหมด = ไม่มีไฟล์ใหม่ต่อท้ายหน่วย → ไม่ใช้ข้อความ "ต่อท้ายหน่วย…"
          replaced === done ? t('content.summaryReplacedBody') : t('content.summaryDoneBody', { number }),
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
