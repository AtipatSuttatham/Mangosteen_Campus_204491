/**
 * หน้าต่างแก้เนื้อหาที่เป็นไฟล์ / ลิงก์ / วิดีโอ YouTube (ตาม board "แก้ไขเนื้อหาแบบไฟล์" — ขั้น 4.6 ก)
 * (ข้อความใช้ TextContentDialog)
 *
 *   ┌ แก้ไขเนื้อหา                                               ✕ ┐
 *   │ หน่วยที่ 3 โครงสร้างควบคุมทิศทาง                               │
 *   │ ชนิดเนื้อหา  [เอกสาร]  ระบบตั้งจากไฟล์ เปลี่ยนภายหลังไม่ได้        │
 *   │ ชื่อหัวข้อ / คำอธิบาย (ไม่บังคับ) / อยู่ในหน่วย                   │
 *   │ ไฟล์  ┌ while-for-loop.pdf  2.1 MB          [เปลี่ยนไฟล์] ┐    │  ← ลิงก์ / YouTube: ช่อง "ลิงก์" แทน
 *   │       └ ไฟล์ใหม่ต้องเป็นเอกสารเหมือนเดิม … ไฟล์เดิมจะถูกลบ ┘    │
 *   │ (สวิตช์) ให้ผู้เรียนดาวน์โหลดได้                                │  ← หรือ "ไฟล์ชนิดนี้ผู้เรียนต้องดาวน์โหลดเพื่อเปิด"
 *   │                                    [ยกเลิก] [บันทึกเนื้อหา] │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * เปลี่ยนไฟล์ (ผู้ใช้เลือกแบบ กว1): เลือกไฟล์ไว้ก่อน → ส่งตอนกด "บันทึกเนื้อหา"
 *   - ตรวจชนิด / ขนาดในหน้าเว็บทันทีที่เลือก (fileRules — กย1) ไม่ผ่าน = ข้อความแดงใต้ส่วนไฟล์ ไม่เก็บไฟล์ไว้
 *   - กด "ยกเลิก" ก่อนบันทึก = ไฟล์เดิมไม่หาย ; "ไม่เปลี่ยน" = ทิ้งไฟล์ที่เลือก
 *   - บันทึก: ส่งไฟล์ก่อน (แถบความคืบหน้า + ปุ่ม "หยุดอัปโหลด") แล้วค่อยบันทึกช่องอื่น
 *     ส่งครบแล้ว → ข้อความ "ส่งไฟล์ครบแล้ว กำลังบันทึก…" + ซ่อนปุ่มหยุด (หยุดเซิร์ฟเวอร์ไม่ได้แล้ว — กศ1)
 *     ไฟล์ไม่ผ่าน / หยุด → ช่องอื่นยังไม่ถูกบันทึก หน้าต่างยังเปิดอยู่ ;
 *     ไฟล์ผ่านแต่ช่องอื่นไม่ผ่าน → บอกว่าไฟล์เปลี่ยนแล้ว (ส่วนไฟล์แสดงไฟล์ใหม่)
 * สวิตช์ดาวน์โหลด (กฑ2): แสดงเฉพาะไฟล์ที่เบราว์เซอร์เปิดดูได้ (can_disable_download — กพ1)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import {
  replaceContentFile,
  updateContent,
  type Content,
  type ContentChanges,
  type Module,
} from '../../../api/content'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../../api/errors'
import { UploadAbortedError, type UploadProgress } from '../../../api/upload'
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Switch,
  TextField,
} from '../../../components/ui'
import { refreshModules } from '../courseCache'
import { useCoursePage } from '../useCoursePage'
import { formatFileSize } from './contentLabels'
import { FieldHint, FormError, KindField, MarkdownTextarea, ModuleField } from './contentForm'
import { fileProblemMessage } from './contentNames'
import { acceptFor, checkFile, type FileKind } from './fileRules'

type ContentEditDialogProps = {
  /** เนื้อหาที่แก้ (ไม่ใช่ชนิดข้อความ) */
  content: Content
  /** หน่วยที่เนื้อหาอยู่ + ลำดับบนจอ (บรรทัดรองใต้หัวหน้าต่าง) */
  module: Module
  number: number
  /** หน่วยทั้งหมดของวิชา (ตัวเลือกของช่อง "อยู่ในหน่วย") */
  modules: Module[]
  onClose: () => void
  /** บันทึกสำเร็จ (ได้เนื้อหาล่าสุดจาก backend — รายการโหลดใหม่แล้ว) */
  onSaved: (content: Content) => void
}

type EditFormValues = { title: string; body: string; module: string; url: string }

/** ชนิดไฟล์ของเนื้อหาที่มีไฟล์ (ใช้กำหนดว่าไฟล์ใหม่ต้องเป็นชนิดไหน) */
function fileKindOfContent(content: Content): FileKind | null {
  if (!content.file_link) return null
  return content.content_type === 'text' || content.content_type === 'link' ? null : content.content_type
}

/** คำแนะนำใต้ส่วนไฟล์ ตามชนิดไฟล์ (ข้อความเต็มประโยคใน th.ts) */
const REPLACE_HINT = {
  file: 'content.replaceHintFile',
  image: 'content.replaceHintImage',
  audio: 'content.replaceHintAudio',
  video: 'content.replaceHintVideo',
} as const

/** ข้อความของ error จาก backend: รหัสรวม → ข้อความไทย */
const apiMessage = (caught: unknown) => errorMessage(caught instanceof ApiError ? caught.code : 'unknown')

export function ContentEditDialog({
  content,
  module,
  number,
  modules,
  onClose,
  onSaved,
}: ContentEditDialogProps) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const queryClient = useQueryClient()
  const titleId = useId()
  const fileLabelId = useId()
  const switchLabelId = useId()
  const switchHintId = useId()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  /** เนื้อหาล่าสุด — เปลี่ยนไฟล์สำเร็จแล้วใช้ข้อมูลไฟล์ใหม่ (แม้ช่องอื่นยังบันทึกไม่สำเร็จ) */
  const [current, setCurrent] = useState(content)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string>()
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  /**
   * ส่งไฟล์ครบทุกไบต์แล้ว รอเซิร์ฟเวอร์เก็บไฟล์ (แก้หลังตรวจขั้น 4.6 ก — กศ1)
   * ช่วงนี้ซ่อนปุ่ม "หยุดอัปโหลด" เพราะหยุดเซิร์ฟเวอร์ไม่ได้แล้ว (เช่น กำลังส่งต่อไปที่ B2)
   */
  const [sent, setSent] = useState(false)
  const [allowDownload, setAllowDownload] = useState(content.allow_download)
  const [formError, setFormError] = useState<string>()

  const fileKind = fileKindOfContent(current)
  const isLink = !fileKind

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<EditFormValues>({
    defaultValues: {
      title: content.title,
      body: content.body,
      module: String(content.module),
      url: content.external_url,
    },
  })
  const titleField = register('title', { required: true, validate: (value) => value.trim() !== '' })

  /** เลือกไฟล์ใหม่: ตรวจชนิดเดิม / ขนาดก่อน ไม่ผ่าน = ข้อความแดง (ไม่เก็บไฟล์ไว้) */
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // ล้างค่าในช่อง ให้เลือกไฟล์เดิมซ้ำได้ (เช่น แก้ไฟล์แล้วเลือกใหม่)
    event.target.value = ''
    if (!file || !fileKind) return
    setFormError(undefined)
    const problem = checkFile(file, fileKind)
    if (problem) {
      setPendingFile(null)
      setFileError(fileProblemMessage(problem, file.size, t))
      return
    }
    setFileError(undefined)
    setPendingFile(file)
  }

  /** ปัญหารายช่องจาก backend → ใต้ช่อง ; คืน true ถ้าเจอ */
  function showFieldErrors(caught: unknown): boolean {
    if (!(caught instanceof ApiError)) return false
    const titleMessage = fieldErrorsMessage(caught.fields.title)
    const urlMessage = fieldErrorsMessage(caught.fields.url)
    if (titleMessage) setError('title', { type: 'server', message: titleMessage })
    if (urlMessage) setError('url', { type: 'server', message: urlMessage })
    return Boolean(titleMessage || urlMessage)
  }

  async function onSubmit(values: EditFormValues) {
    setFormError(undefined)
    // ส่งเฉพาะช่องที่แก้
    const changes: ContentChanges = {}
    if (dirtyFields.title) changes.title = values.title.trim()
    if (dirtyFields.body) changes.body = values.body
    if (dirtyFields.module) changes.module = Number(values.module)
    if (isLink && dirtyFields.url) changes.url = values.url.trim()
    if (current.can_disable_download && allowDownload !== current.allow_download) {
      changes.allow_download = allowDownload
    }
    if (!pendingFile && Object.keys(changes).length === 0) {
      onClose()
      return
    }

    let latest = current
    let fileReplaced = false
    // ① ส่งไฟล์ใหม่ก่อน (กว1)
    if (pendingFile) {
      const controller = new AbortController()
      abortRef.current = controller
      setProgress({ loaded: 0, total: pendingFile.size })
      try {
        latest = await replaceContentFile(course.id, current.id, pendingFile, {
          onProgress: setProgress,
          signal: controller.signal,
          onSent: () => setSent(true),
        })
      } catch (caught) {
        if (caught instanceof UploadAbortedError) {
          setFormError(t('content.uploadStopped'))
          // เผื่อกดหยุดพร้อมกับที่ไฟล์ส่งครบพอดี — โหลดรายการใหม่ให้ตรงกับข้อมูลจริงเสมอ
          await refreshModules(queryClient, course.id)
        } else {
          setFileError(apiMessage(caught))
        }
        return
      } finally {
        abortRef.current = null
        setProgress(null)
        setSent(false)
      }
      fileReplaced = true
      setCurrent(latest)
      setPendingFile(null)
    }

    // ② บันทึกช่องอื่น
    if (Object.keys(changes).length > 0) {
      try {
        latest = await updateContent(course.id, current.id, changes)
      } catch (caught) {
        if (fileReplaced) {
          // ไฟล์เปลี่ยนไปแล้ว → รายการต้องโหลดใหม่ และบอกให้ชัดว่าส่วนไหนสำเร็จ
          await refreshModules(queryClient, course.id)
          showFieldErrors(caught)
          setFormError(t('content.fileReplacedOnly', { reason: apiMessage(caught) }))
        } else if (!showFieldErrors(caught)) {
          setFormError(apiMessage(caught))
        }
        return
      }
    }

    await refreshModules(queryClient, course.id)
    onSaved(latest)
  }

  const requestClose = () => {
    if (!isSubmitting) onClose()
  }
  const titleError = errors.title
    ? errors.title.type === 'server'
      ? errors.title.message
      : fieldErrorMessage('required')
    : undefined
  const uploading = progress !== null
  const percent = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0

  return (
    <Dialog labelledBy={titleId} onClose={requestClose} initialFocusRef={firstFieldRef} size="lg">
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex grow flex-col"
      >
        <DialogHeader
          titleId={titleId}
          title={t('content.contentEditTitle')}
          subtitle={t('content.dialogModule', { number, title: module.title })}
          onClose={requestClose}
          closeDisabled={isSubmitting}
        />
        <DialogBody>
          <KindField content={current} />
          <TextField
            label={t('content.contentTitleLabel')}
            autoComplete="off"
            maxLength={200}
            disabled={isSubmitting}
            error={titleError}
            {...titleField}
            ref={(element) => {
              titleField.ref(element)
              firstFieldRef.current = element
            }}
          />
          <MarkdownTextarea
            label={t('content.contentDescriptionLabel')}
            hint={isLink ? t('content.contentDescriptionLinkHint') : t('content.contentDescriptionFileHint')}
            optional
            disabled={isSubmitting}
            {...register('body')}
          />
          <ModuleField modules={modules} disabled={isSubmitting} {...register('module')} />

          {isLink ? (
            <TextField
              label={t('content.linkLabel')}
              type="url"
              inputMode="url"
              autoComplete="off"
              maxLength={500}
              disabled={isSubmitting}
              error={
                errors.url
                  ? errors.url.type === 'server'
                    ? errors.url.message
                    : fieldErrorMessage('required')
                  : undefined
              }
              {...register('url', { required: true, validate: (value) => value.trim() !== '' })}
            />
          ) : (
            <div className="flex flex-col gap-1.5" role="group" aria-labelledby={fileLabelId}>
              <span id={fileLabelId} className="text-[15px] font-semibold">
                {t('content.fileLabel')}
              </span>
              <div className="flex flex-col gap-3 rounded-[10px] border border-line px-3.5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 grow">
                  {pendingFile && (
                    <span className="mb-0.5 block text-[13px] font-semibold text-brand">
                      {t('content.newFile')}
                    </span>
                  )}
                  <span className="block text-[15px] font-semibold break-all">
                    {pendingFile ? pendingFile.name : current.file_name}
                  </span>
                  <span className="block text-[13.5px] text-ink-muted">
                    {formatFileSize(pendingFile ? pendingFile.size : (current.file_size ?? 0), t)}
                  </span>
                </div>
                {pendingFile ? (
                  <Button
                    variant="secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      setPendingFile(null)
                      setFileError(undefined)
                    }}
                  >
                    {t('content.keepFile')}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={isSubmitting}
                    aria-label={t('content.replaceFileLabel', { name: current.file_name })}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('content.replaceFile')}
                  </Button>
                )}
                {/* ช่องเลือกไฟล์ของเครื่อง (ซ่อน — เปิดด้วยปุ่ม "เปลี่ยนไฟล์") ; กรองเฉพาะนามสกุลชนิดเดิม */}
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  tabIndex={-1}
                  accept={fileKind ? acceptFor(fileKind) : undefined}
                  onChange={chooseFile}
                />
              </div>
              {uploading && progress && (
                <div className="flex flex-col gap-1">
                  <div
                    role="progressbar"
                    aria-labelledby={fileLabelId}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="h-2 overflow-hidden rounded-full bg-canvas"
                  >
                    <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                  </div>
                  {/* ตัวเลขเปลี่ยนหลายครั้งต่อวินาที — ไม่ประกาศ (ผู้ใช้โปรแกรมอ่านหน้าจอถามค่าจาก progressbar ได้) */}
                  <span className="text-[13.5px] text-ink-muted">
                    {sent
                      ? t('content.uploadSaving')
                      : t('content.uploadProgress', {
                          loaded: formatFileSize(progress.loaded, t),
                          total: formatFileSize(progress.total, t),
                          percent,
                        })}
                  </span>
                </div>
              )}
              {/* ประกาศเฉพาะจุดเปลี่ยนสถานะ: เริ่มส่ง → ส่งครบแล้วกำลังบันทึก (กศ1) */}
              <span role="status" className="sr-only">
                {uploading ? (sent ? t('content.uploadSaving') : t('content.uploadStarted')) : ''}
              </span>
              {fileError ? (
                <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
                  {fileError}
                </p>
              ) : (
                <FieldHint>
                  {pendingFile ? t('content.newFileNote') : fileKind && t(REPLACE_HINT[fileKind])}
                </FieldHint>
              )}
            </div>
          )}

          {!isLink &&
            (current.can_disable_download ? (
              <div className="flex items-start gap-3.5">
                <Switch
                  checked={allowDownload}
                  labelledBy={switchLabelId}
                  describedBy={switchHintId}
                  disabled={isSubmitting}
                  onChange={() => setAllowDownload((value) => !value)}
                />
                <div>
                  <span id={switchLabelId} className="block text-[15px] font-semibold">
                    {t('content.downloadSwitch')}
                  </span>
                  <FieldHint id={switchHintId}>{t('content.downloadSwitchHint')}</FieldHint>
                </div>
              </div>
            ) : (
              <FieldHint>{t('content.downloadAlways')}</FieldHint>
            ))}

          <FormError message={formError} />
        </DialogBody>
        <DialogFooter>
          {uploading && !sent ? (
            // ระหว่างส่งไฟล์: ปุ่มซ้ายเปลี่ยนเป็น "หยุดอัปโหลด" (ไฟล์เดิมยังอยู่ ช่องอื่นยังไม่บันทึก)
            // ส่งครบแล้ว (sent) → กลับเป็น "ยกเลิก" ที่กดไม่ได้ เพราะหยุดเซิร์ฟเวอร์ไม่ได้แล้ว
            <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
              {t('content.stopUpload')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
              {t('dialog.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('content.saving') : t('content.saveContent')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
