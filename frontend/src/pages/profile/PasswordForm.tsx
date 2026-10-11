/**
 * ฟอร์ม "เปลี่ยนรหัสผ่าน" ของหน้าข้อมูลส่วนตัว (UC-02, ขั้น 1.8)
 * หน้าตาตาม board "ข้อมูลส่วนตัว" ใน canvas: หัวข้อ + คำเตือนเรื่องอุปกรณ์อื่น, 3 ช่อง, ปุ่มรอง
 *
 * การทำงาน (React Hook Form):
 *   - ตรวจในหน้าเว็บก่อนส่ง: ช่องว่าง → "กรุณากรอกข้อมูลช่องนี้" ;
 *     "ยืนยันรหัสผ่านใหม่" ไม่ตรงกับ "รหัสผ่านใหม่" → "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"
 *   - backend ปฏิเสธ → ข้อความใต้ช่อง: รหัสเดิมผิด / รหัสใหม่ไม่ผ่านกฎ (ไม่ผ่านหลายข้อ → แสดงทุกข้อ)
 *   - สำเร็จ → ใช้บัตรชุดใหม่ (เครื่องนี้อยู่ในระบบต่อ) + ล้างทุกช่อง + ป้ายเขียว "เปลี่ยนรหัสผ่านแล้ว" ;
 *     อุปกรณ์อื่นออกจากระบบทันที (backend ขั้น 1.7)
 *   - รหัสผ่านไม่ตัดช่องว่าง (เหมือนตอนเข้าสู่ระบบ)
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { changePassword } from '../../api/auth'
import { ApiError } from '../../api/client'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../api/errors'
import { useAuth } from '../../auth/AuthContext'
import { Button, PasswordField, StatusBadge } from '../../components/ui'
import { CheckIcon } from './icons'

/** ข้อมูลในฟอร์ม */
type PasswordFormValues = {
  current_password: string
  new_password: string
  confirm_password: string
}

const EMPTY: PasswordFormValues = { current_password: '', new_password: '', confirm_password: '' }

export function PasswordForm() {
  const { t } = useTranslation()
  const { acceptSession } = useAuth()
  // เปลี่ยนสำเร็จแล้ว (แสดงป้าย "เปลี่ยนรหัสผ่านแล้ว")
  const [changed, setChanged] = useState(false)
  // error ที่ไม่ผูกกับช่องใด (เช่น ติดต่อเซิร์ฟเวอร์ไม่ได้)
  const [formError, setFormError] = useState<string>()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({ defaultValues: EMPTY })

  /** ส่งฟอร์ม (เรียกเมื่อผ่านการตรวจในหน้าเว็บแล้ว) */
  async function onSubmit(values: PasswordFormValues) {
    setChanged(false)
    setFormError(undefined)
    try {
      acceptSession(await changePassword(values.current_password, values.new_password))
      reset(EMPTY)
      setChanged(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'validation_error') {
        for (const field of ['current_password', 'new_password'] as const) {
          const message = fieldErrorsMessage(caught.fields[field])
          if (message) setError(field, { type: 'server', message })
        }
        return
      }
      setFormError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
    }
  }

  // พิมพ์แก้ช่องใดก็ได้ → ซ่อนป้ายสำเร็จและข้อความ error รวม
  const onEdit = () => {
    setChanged(false)
    setFormError(undefined)
  }

  /** ข้อความใต้ช่อง: ตรวจในหน้าเว็บ (ช่องว่าง / ไม่ตรงกัน) หรือข้อความจาก backend */
  const messageOf = (field: keyof PasswordFormValues) => {
    const error = errors[field]
    if (!error) return undefined
    if (error.type === 'required') return fieldErrorMessage('required')
    if (error.type === 'validate') return fieldErrorMessage('password_mismatch')
    return error.message as string | undefined
  }

  return (
    <form
      noValidate
      aria-labelledby="profile-password-title"
      aria-describedby="profile-password-note"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-[18px]"
    >
      <div>
        <h2
          id="profile-password-title"
          className="m-0 font-display text-xl leading-[1.4] font-semibold"
        >
          {t('profile.passwordTitle')}
        </h2>
        <p id="profile-password-note" className="m-0 mt-0.5 text-sm leading-[1.6] text-ink-muted">
          {t('profile.passwordNote')}
        </p>
      </div>

      <PasswordField
        label={t('profile.currentPassword')}
        autoComplete="current-password"
        error={messageOf('current_password')}
        {...register('current_password', { required: true, onChange: onEdit })}
      />
      <PasswordField
        label={t('profile.newPassword')}
        autoComplete="new-password"
        hint={t('profile.newPasswordHint')}
        error={messageOf('new_password')}
        {...register('new_password', { required: true, onChange: onEdit })}
      />
      <PasswordField
        label={t('profile.confirmPassword')}
        autoComplete="new-password"
        error={messageOf('confirm_password')}
        {...register('confirm_password', {
          required: true,
          onChange: onEdit,
          // ต้องตรงกับช่อง "รหัสผ่านใหม่"
          validate: (value, all) => value === all.new_password,
        })}
      />

      <div className="flex flex-wrap items-center gap-3.5">
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? t('profile.changingPassword') : t('profile.changePassword')}
        </Button>
        <span role="status">
          {changed && (
            <StatusBadge tone="ok" icon={<CheckIcon />}>
              {t('profile.passwordChanged')}
            </StatusBadge>
          )}
        </span>
      </div>
      {formError && (
        <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
          {formError}
        </p>
      )}
    </form>
  )
}
