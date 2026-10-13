/**
 * หน้าต่าง "รีเซ็ตรหัสผ่าน" (UC-04 — ขั้น 2.6) เปิดจากปุ่ม "รีเซ็ตรหัสผ่าน" ในแถว/การ์ด
 * (ไม่มีในแถวของตัวเอง — เปลี่ยนรหัสตัวเองที่หน้าข้อมูลส่วนตัว)
 * หน้าตาตาม board "รีเซ็ตรหัสผ่าน" และ "รีเซ็ตรหัสผ่านแล้ว" ; มือถือเต็มจอ หัวม่วง (ผู้ใช้เลือกข้อ 2.ก)
 *
 * 2 หน้าในหน้าต่างเดียว:
 *   ① ⚠ ผู้ใช้จะออกจากระบบทุกอุปกรณ์ทันที…  +  รหัสผ่านชั่วคราวใหม่ (สุ่มให้แล้ว)
 *        → "รีเซ็ตรหัสผ่าน" → POST /api/v1/admin/users/{id}/password/ (backend ตอบ 204)
 *   ② รีเซ็ตรหัสผ่านแล้ว (ผู้ใช้เลือกข้อ 1.ข): ใบข้อมูลเข้าสู่ระบบ + รหัสใหม่ + ปุ่มคัดลอก → "เสร็จ"
 *
 * - รหัสไม่ผ่านกฎ (backend ตอบที่ช่อง new_password) → ข้อความใต้ช่อง ; อื่น ๆ → ข้อความเหนือปุ่ม
 * - ระหว่างบันทึกปิดหน้าต่างไม่ได้
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { resetAdminUserPassword, type AdminUser } from '../../../api/adminUsers'
import { ApiError } from '../../../api/client'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../../api/errors'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader } from '../../../components/ui'
import { generateTempPassword } from '../../../lib/passwords'
import { FormGroup } from './FormGroup'
import { KeyIcon, WarnIcon } from './icons'
import { DoneMark, PasswordSlip } from './PasswordSlip'
import { TempPasswordField } from './TempPasswordField'

type ResetForm = { password: string }

type ResetPasswordDialogProps = {
  user: AdminUser
  onClose: () => void
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  // รหัสที่รีเซ็ตสำเร็จแล้ว (null = ยังอยู่หน้าฟอร์ม)
  const [donePassword, setDonePassword] = useState<string | null>(null)
  // error ที่ไม่ผูกกับช่อง (เช่น ติดต่อเซิร์ฟเวอร์ไม่ได้)
  const [formError, setFormError] = useState<string>()
  // ค่าเริ่มต้น: สุ่มรหัสครั้งเดียวตอนเปิดหน้าต่าง
  const [initialValues] = useState<ResetForm>(() => ({ password: generateTempPassword() }))

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ defaultValues: initialValues })
  const password = useWatch({ control, name: 'password' })
  const passwordField = register('password', { required: true })
  // ช่องรหัส: ส่ง ref ให้ทั้ง React Hook Form และหน้าต่าง (โฟกัสเมื่อเปิด)
  const registration = {
    ...passwordField,
    ref: (element: HTMLInputElement | null) => {
      passwordField.ref(element)
      passwordRef.current = element
    },
  }

  // เปลี่ยนเป็นหน้า "รีเซ็ตแล้ว" → โฟกัสปุ่มคัดลอก
  useEffect(() => {
    if (donePassword) copyRef.current?.focus()
  }, [donePassword])

  /** ส่งฟอร์ม */
  async function onSubmit(values: ResetForm) {
    setFormError(undefined)
    try {
      await resetAdminUserPassword(user.id, values.password)
      setDonePassword(values.password)
    } catch (caught) {
      // รหัสไม่ผ่านกฎ: backend ตอบที่ช่อง new_password → แสดงใต้ช่องรหัส
      const fieldMessage =
        caught instanceof ApiError && caught.code === 'validation_error'
          ? fieldErrorsMessage(caught.fields.new_password)
          : undefined
      if (fieldMessage) setError('password', { type: 'server', message: fieldMessage })
      else setFormError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
    }
  }

  const requestClose = () => {
    if (!isSubmitting) onClose()
  }

  const name = `${user.first_name} ${user.last_name}`
  const passwordError =
    errors.password?.type === 'required' ? fieldErrorMessage('required') : errors.password?.message

  return (
    <Dialog
      labelledBy={titleId}
      onClose={donePassword ? onClose : requestClose}
      size="sm"
      initialFocusRef={passwordRef}
    >
      {donePassword ? (
        <>
          <DialogHeader
            titleId={titleId}
            title={t('userForm.resetDoneTitle')}
            subtitle={t('userForm.resetDoneSubtitle', { name })}
            eyebrow={t('adminUsers.title')}
            icon={<DoneMark />}
            onClose={onClose}
          />
          <DialogBody className="max-lg:pt-5">
            <PasswordSlip
              email={user.email}
              studentId={user.student_or_staff_id}
              passwordLabel={t('userForm.resetDonePassword')}
              password={donePassword}
              copyRef={copyRef}
            />
          </DialogBody>
          <DialogFooter mobileColumns="grid-cols-1">
            <Button onClick={onClose}>{t('userForm.done')}</Button>
          </DialogFooter>
        </>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex grow flex-col">
          <DialogHeader
            titleId={titleId}
            title={t('userForm.resetTitle')}
            subtitle={
              user.student_or_staff_id
                ? t('userForm.nameWithId', { name, id: user.student_or_staff_id })
                : name
            }
            eyebrow={t('adminUsers.title')}
            onClose={requestClose}
            closeDisabled={isSubmitting}
          />
          <DialogBody>
            {/* คำเตือนผลของการรีเซ็ต (กล่องส้ม ตาม board) */}
            <div className="flex items-start gap-2.5 rounded-[10px] bg-warn-soft px-3.5 py-3 text-sm leading-[1.55] text-warn">
              <span className="mt-0.5">
                <WarnIcon />
              </span>
              <p className="m-0">{t('userForm.resetWarning')}</p>
            </div>
            <FormGroup title={t('userForm.newPassword')} icon={<KeyIcon />}>
              <TempPasswordField
                label={t('userForm.newPassword')}
                labelClassName="max-lg:sr-only"
                value={password}
                error={passwordError}
                onGenerate={(next) =>
                  setValue('password', next, { shouldValidate: errors.password !== undefined })
                }
                registration={registration}
              />
            </FormGroup>
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
              {isSubmitting ? t('userForm.resetting') : t('userForm.reset')}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
