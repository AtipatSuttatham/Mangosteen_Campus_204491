/**
 * หน้าต่างเพิ่มลิงก์ (ตาม board "เพิ่มลิงก์" — ขั้น 4.6 ก ; กฉ1 + กฎ1)
 *
 *   ┌ เพิ่มลิงก์                                    ✕ ┐
 *   │ หน่วยที่ 3 โครงสร้างควบคุมทิศทาง                  │
 *   │ ลิงก์       [https://youtu.be/…_____________]    │
 *   │             ▶ วิดีโอจาก YouTube · ผู้เรียนดูได้ในหน้าบทเรียนเลย │
 *   │ ชื่อหัวข้อ (ไม่บังคับ) [______________________]    │
 *   │ เว้นว่างได้ ระบบตั้งชื่อเป็น …                       │
 *   │ ⓘ ลิงก์ YouTube เล่นในหน้า … เนื้อหาใหม่ยังไม่เผยแพร่ │
 *   │                          [ยกเลิก] [เพิ่มลิงก์]     │
 *   └─────────────────────────────────────────────────┘
 *
 * - ช่องเดียวรับทุกลิงก์ — backend ตัดสินเองว่าเป็นวิดีโอ YouTube หรือลิงก์เว็บ
 *   คำแนะนำใต้ช่องเป็นแค่ตัวช่วยให้เห็นก่อนกด (looksLikeYoutube ดูแค่ชื่อเว็บ)
 * - ไม่กรอกหัวข้อ → ระบบตั้งเป็น "วิดีโอจาก YouTube" หรือชื่อเว็บไซต์
 * - ลิงก์ใหม่ต่อท้ายหน่วยและยังไม่เผยแพร่
 */
import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { createLinkContent, type Content, type Module } from '../../../api/content'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../../api/errors'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, TextField } from '../../../components/ui'
import { refreshModules } from '../courseCache'
import { InfoIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'
import { looksLikeYoutube } from './contentLabels'
import { DialogNote, FormError } from './contentForm'

type LinkDialogProps = {
  /** หน่วยที่กดปุ่ม "เพิ่มลิงก์" */
  module: Module
  /** ลำดับของหน่วยนั้นบนจอ (เริ่มที่ 1) */
  number: number
  onClose: () => void
  /** เพิ่มสำเร็จ (รายการโหลดใหม่แล้ว) */
  onSaved: (content: Content) => void
}

type LinkFormValues = { url: string; title: string }

/** ลิงก์ที่พิมพ์มาอ่านเป็นที่อยู่เว็บ http / https ได้ไหม (ไว้ตัดสินว่าจะขึ้นคำแนะนำไหม) */
function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function LinkDialog({ module, number, onClose, onSaved }: LinkDialogProps) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const queryClient = useQueryClient()
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const [formError, setFormError] = useState<string>()

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LinkFormValues>({ defaultValues: { url: '', title: '' } })
  const urlField = register('url', { required: true, validate: (value) => value.trim() !== '' })
  const url = useWatch({ control, name: 'url' })

  async function onSubmit(values: LinkFormValues) {
    setFormError(undefined)
    try {
      const title = values.title.trim()
      const saved = await createLinkContent(course.id, module.id, {
        url: values.url.trim(),
        ...(title ? { title } : {}),
      })
      await refreshModules(queryClient, course.id)
      onSaved(saved)
    } catch (caught) {
      // ปัญหารายช่อง (ลิงก์ผิดรูปแบบ / หัวข้อยาวเกิน) → ใต้ช่อง ; อื่น ๆ → ข้อความรวมเหนือปุ่ม
      if (caught instanceof ApiError) {
        const urlMessage = fieldErrorsMessage(caught.fields.url)
        const titleMessage = fieldErrorsMessage(caught.fields.title)
        if (urlMessage) setError('url', { type: 'server', message: urlMessage })
        if (titleMessage) setError('title', { type: 'server', message: titleMessage })
        if (urlMessage || titleMessage) return
      }
      setFormError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
    }
  }

  const requestClose = () => {
    if (!isSubmitting) onClose()
  }
  const urlError = errors.url
    ? errors.url.type === 'server'
      ? errors.url.message
      : fieldErrorMessage('required')
    : undefined
  // คำแนะนำใต้ช่องลิงก์: บอกว่าผู้เรียนจะเห็นแบบไหน (เฉพาะเมื่อพิมพ์ลิงก์ที่อ่านได้แล้ว)
  const urlHint = isWebUrl(url)
    ? looksLikeYoutube(url)
      ? t('content.linkYoutubeHint')
      : t('content.linkWebHint')
    : undefined

  return (
    <Dialog labelledBy={titleId} onClose={requestClose} initialFocusRef={firstFieldRef}>
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex grow flex-col"
      >
        <DialogHeader
          titleId={titleId}
          title={t('content.linkCreateTitle')}
          subtitle={t('content.dialogModule', { number, title: module.title })}
          onClose={requestClose}
          closeDisabled={isSubmitting}
        />
        <DialogBody>
          <TextField
            label={t('content.linkLabel')}
            type="url"
            inputMode="url"
            autoComplete="off"
            maxLength={500}
            placeholder="https://"
            disabled={isSubmitting}
            error={urlError}
            hint={urlHint}
            {...urlField}
            ref={(element) => {
              urlField.ref(element)
              firstFieldRef.current = element
            }}
          />
          <TextField
            label={t('content.linkTitleLabel')}
            autoComplete="off"
            maxLength={200}
            disabled={isSubmitting}
            error={errors.title?.message}
            hint={t('content.linkTitleHint')}
            {...register('title')}
          />
          <DialogNote icon={<InfoIcon />}>{t('content.linkNote')}</DialogNote>
          <FormError message={formError} />
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
            {t('dialog.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('content.adding') : t('content.linkSubmit')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
