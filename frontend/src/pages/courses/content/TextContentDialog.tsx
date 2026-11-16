/**
 * หน้าต่างเขียน / แก้ข้อความ (ตาม board "แก้ไขเนื้อหาแบบข้อความ" — ขั้น 4.6 ก)
 *
 *   ┌ แก้ไขเนื้อหา                                       ✕ ┐
 *   │ หน่วยที่ 3 โครงสร้างควบคุมทิศทาง                       │
 *   │ ชนิดเนื้อหา  [ข้อความ]  ชนิดเนื้อหาเปลี่ยนหลังสร้างแล้วไม่ได้ │  ← เฉพาะตอนแก้
 *   │ ชื่อหัวข้อ    [_____________________________]          │
 *   │ อยู่ในหน่วย  [3. โครงสร้างควบคุมทิศทาง ▾]               │  ← เฉพาะตอนแก้
 *   │ เนื้อความ                         [เขียน][ดูตัวอย่าง]   │
 *   │ [______________________________________________]      │
 *   │ ใช้ Markdown ได้ …                                    │
 *   │                              [ยกเลิก] [บันทึกเนื้อหา] │
 *   └──────────────────────────────────────────────────────┘
 *
 * - content ไม่ส่ง = เขียนข้อความใหม่ต่อท้ายหน่วย (ยังไม่เผยแพร่ — มีหมายเหตุบอก) ;
 *   ส่ง = แก้ (ส่งเฉพาะช่องที่เปลี่ยน ; เปลี่ยนหน่วย = ย้ายไปต่อท้ายหน่วยนั้น)
 * - หัวข้อบังคับ ≤ 200 ตัว (backend ตรวจซ้ำ) ; ระหว่างบันทึกปิดหน้าต่างไม่ได้
 * - แท็บ "ดูตัวอย่าง" แสดง Markdown แบบเดียวกับหน้าผู้เรียน (ผู้ใช้เลือกแบบ กร1)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import {
  createTextContent,
  updateContent,
  type Content,
  type ContentChanges,
  type Module,
} from '../../../api/content'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../../api/errors'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, TextField } from '../../../components/ui'
import { refreshModules } from '../courseCache'
import { InfoIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'
import { DialogNote, FormError, KindField, MarkdownEditor, ModuleField } from './contentForm'

type TextContentDialogProps = {
  /** หน่วยที่เนื้อหาอยู่ (ตอนเขียนใหม่ = หน่วยที่กดปุ่ม) */
  module: Module
  /** ลำดับของหน่วยนั้นบนจอ (เริ่มที่ 1) */
  number: number
  /** หน่วยทั้งหมดของวิชา (ตัวเลือกของช่อง "อยู่ในหน่วย") */
  modules: Module[]
  /** ข้อความที่แก้ ; ไม่ส่ง = เขียนใหม่ */
  content?: Content
  onClose: () => void
  /** บันทึกสำเร็จ (ได้เนื้อหาล่าสุดจาก backend — รายการโหลดใหม่แล้ว) */
  onSaved: (content: Content) => void
}

type TextFormValues = { title: string; body: string; module: string }

export function TextContentDialog({
  module,
  number,
  modules,
  content,
  onClose,
  onSaved,
}: TextContentDialogProps) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const queryClient = useQueryClient()
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const [formError, setFormError] = useState<string>()
  const editing = content !== undefined

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<TextFormValues>({
    defaultValues: { title: content?.title ?? '', body: content?.body ?? '', module: String(module.id) },
  })
  const body = useWatch({ control, name: 'body' })
  const titleField = register('title', { required: true, validate: (value) => value.trim() !== '' })

  async function onSubmit(values: TextFormValues) {
    setFormError(undefined)
    try {
      let saved: Content
      if (editing) {
        // ส่งเฉพาะช่องที่แก้ ; ไม่ได้แก้อะไร = ปิดหน้าต่างเฉย ๆ
        const changes: ContentChanges = {}
        if (dirtyFields.title) changes.title = values.title.trim()
        if (dirtyFields.body) changes.body = values.body
        if (dirtyFields.module) changes.module = Number(values.module)
        if (Object.keys(changes).length === 0) {
          onClose()
          return
        }
        saved = await updateContent(course.id, content.id, changes)
      } else {
        saved = await createTextContent(course.id, module.id, {
          title: values.title.trim(),
          body: values.body,
        })
      }
      await refreshModules(queryClient, course.id)
      onSaved(saved)
    } catch (caught) {
      // ปัญหาของช่องหัวข้อ → ใต้ช่อง ; อื่น ๆ (เช่น รายวิชาเพิ่งถูกปิด / หน่วยถูกลบ) → ข้อความรวมเหนือปุ่ม
      const titleMessage = caught instanceof ApiError ? fieldErrorsMessage(caught.fields.title) : undefined
      if (titleMessage) {
        setError('title', { type: 'server', message: titleMessage })
        return
      }
      setFormError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
    }
  }

  const requestClose = () => {
    if (!isSubmitting) onClose()
  }
  const titleError = errors.title
    ? errors.title.type === 'server'
      ? errors.title.message
      : fieldErrorMessage('required')
    : undefined

  return (
    <Dialog labelledBy={titleId} onClose={requestClose} initialFocusRef={firstFieldRef} size="lg">
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex grow flex-col"
      >
        <DialogHeader
          titleId={titleId}
          title={editing ? t('content.contentEditTitle') : t('content.textCreateTitle')}
          subtitle={t('content.dialogModule', { number, title: module.title })}
          onClose={requestClose}
          closeDisabled={isSubmitting}
        />
        <DialogBody>
          {editing && <KindField content={content} />}
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
          {editing && <ModuleField modules={modules} disabled={isSubmitting} {...register('module')} />}
          <MarkdownEditor
            label={t('content.bodyLabel')}
            value={body}
            disabled={isSubmitting}
            {...register('body')}
          />
          {!editing && <DialogNote icon={<InfoIcon />}>{t('content.newContentNote')}</DialogNote>}
          <FormError message={formError} />
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
            {t('dialog.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('content.saving') : t('content.saveContent')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
