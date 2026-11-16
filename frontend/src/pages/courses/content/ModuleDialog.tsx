/**
 * หน้าต่างเพิ่ม / แก้หน่วยการเรียน (ตาม board "เพิ่มหน่วยการเรียน" แถวก้อน 4 — ขั้น 4.5)
 *
 *   ┌ เพิ่มหน่วยการเรียน                              ✕ ┐
 *   │ Python พื้นฐาน (204111)                          │
 *   │ ชื่อหน่วยการเรียน  [__________________________]   │
 *   │ คำอธิบาย (ไม่บังคับ) [__________________________] │
 *   │ ใช้ Markdown ได้ …                                │
 *   │ ⓘ หน่วยใหม่ต่อท้ายรายการและยังไม่เผยแพร่ …          │  ← เฉพาะตอนเพิ่ม
 *   │                     [ยกเลิก] [บันทึกหน่วยการเรียน] │
 *   └──────────────────────────────────────────────────┘
 *
 * - module ไม่ส่ง = เพิ่มใหม่ ; ส่ง = แก้ (ส่งเฉพาะช่องที่เปลี่ยน — แบบฟอร์มอื่นของระบบ)
 * - ชื่อห้ามว่าง ≤ 200 ตัว (backend ตรวจซ้ำ) ; ระหว่างบันทึกปิดหน้าต่างไม่ได้ ; มือถือเต็มจอแบบหน้าต่างอื่น
 */
import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { createModule, updateModule, type Module } from '../../../api/content'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../../api/errors'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, TextField } from '../../../components/ui'
import { refreshModules } from '../courseCache'
import { InfoIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'

type ModuleDialogProps = {
  /** หน่วยที่แก้ ; ไม่ส่ง = เพิ่มหน่วยใหม่ */
  module?: Module
  onClose: () => void
  /** บันทึกสำเร็จ (ได้หน่วยล่าสุดจาก backend) */
  onSaved: (module: Module) => void
}

type ModuleFormValues = { title: string; description: string }

export function ModuleDialog({ module, onClose, onSaved }: ModuleDialogProps) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const queryClient = useQueryClient()
  const titleId = useId()
  const descriptionId = useId()
  const hintId = useId()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const [formError, setFormError] = useState<string>()
  const editing = module !== undefined

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ModuleFormValues>({
    defaultValues: { title: module?.title ?? '', description: module?.description ?? '' },
  })
  const titleField = register('title', { required: true, validate: (value) => value.trim() !== '' })

  async function onSubmit(values: ModuleFormValues) {
    setFormError(undefined)
    try {
      let saved: Module
      if (editing) {
        // ส่งเฉพาะช่องที่แก้ ; ไม่ได้แก้อะไร = ปิดหน้าต่างเฉย ๆ
        const changes: Partial<ModuleFormValues> = {}
        if (dirtyFields.title) changes.title = values.title.trim()
        if (dirtyFields.description) changes.description = values.description
        if (Object.keys(changes).length === 0) {
          onClose()
          return
        }
        saved = await updateModule(course.id, module.id, changes)
      } else {
        saved = await createModule(course.id, {
          title: values.title.trim(),
          description: values.description,
        })
      }
      await refreshModules(queryClient, course.id)
      onSaved(saved)
    } catch (caught) {
      // ปัญหารายช่อง → ข้อความใต้ช่อง ; อื่น ๆ (เช่น รายวิชาเพิ่งถูกปิด) → ข้อความรวมเหนือปุ่ม
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
  // error จาก backend มีข้อความแล้ว ; error จากกฎในฟอร์ม (ว่าง) ไม่มีข้อความ → ใช้ "กรุณากรอกข้อมูลช่องนี้"
  const titleError = errors.title
    ? errors.title.type === 'server'
      ? errors.title.message
      : fieldErrorMessage('required')
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
          title={editing ? t('content.editTitle') : t('content.createTitle')}
          subtitle={`${course.name} (${course.code})`}
          onClose={requestClose}
          closeDisabled={isSubmitting}
        />
        <DialogBody>
          <TextField
            label={t('content.titleLabel')}
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor={descriptionId} className="text-[15px] font-semibold">
              {t('content.descriptionLabel')}{' '}
              <span className="font-normal text-ink-muted">{t('content.optional')}</span>
            </label>
            <textarea
              id={descriptionId}
              rows={4}
              disabled={isSubmitting}
              aria-describedby={hintId}
              className={
                'w-full resize-y rounded-control border border-line-strong bg-surface px-3.5 py-3 text-[15px] ' +
                'leading-[1.6] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-brand ' +
                'disabled:border-line disabled:bg-canvas disabled:text-ink-muted'
              }
              {...register('description')}
            />
            <p id={hintId} className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
              {t('content.descriptionHint')}
            </p>
          </div>
          {!editing && (
            <div className="flex items-start gap-2.5 rounded-[10px] bg-mute-soft px-3.5 py-3 text-[13.5px] leading-[1.55] text-mute">
              <span className="mt-0.5">
                <InfoIcon />
              </span>
              <p className="m-0">{t('content.newModuleNote')}</p>
            </div>
          )}
          {formError && (
            <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
              {formError}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
            {t('dialog.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('content.saving') : t('content.save')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
