/**
 * ฟอร์ม "ข้อมูลทั่วไป" ของหน้าข้อมูลส่วนตัว — ชื่อ / นามสกุล / อีเมล (UC-02, ขั้น 1.8)
 * หน้าตาตาม board "ข้อมูลส่วนตัว" ใน canvas: ชื่อ-นามสกุลคู่กันในแถวเดียว (แคบมากค่อยเรียงลง) แล้วอีเมล
 *
 * การทำงาน (React Hook Form):
 *   - เปิดหน้ามา ช่องมีข้อมูลปัจจุบันอยู่แล้ว (จากข้อมูลผู้ใช้ที่ระบบมี ไม่ต้องดึงซ้ำ)
 *   - ช่องว่าง → "กรุณากรอกข้อมูลช่องนี้" (ไม่ส่งไป backend)
 *   - บันทึกสำเร็จ → ป้ายเขียว "บันทึกแล้ว" ข้างปุ่ม (อยู่จนกว่าจะพิมพ์แก้ใหม่) ;
 *     ชื่อทั่วหน้าจอ (sidebar, แถบมือถือ, หน้าแรก) และแท็บอื่นเปลี่ยนตามทันที (updateUser)
 *   - backend ปฏิเสธรายช่อง (อีเมลซ้ำ / รูปแบบผิด) → ข้อความใต้ช่องนั้น ;
 *     error อื่น (ติดต่อไม่ได้ ฯลฯ) → ข้อความใต้ปุ่ม
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { updateProfile } from '../../api/auth'
import { ApiError } from '../../api/client'
import { errorMessage, fieldErrorMessage, fieldErrorsMessage } from '../../api/errors'
import { useAuth } from '../../auth/AuthContext'
import { Button, StatusBadge, TextField } from '../../components/ui'
import { CheckIcon } from './icons'

/** ข้อมูลในฟอร์ม (ชื่อช่องตรงกับ API) */
type InfoForm = {
  first_name: string
  last_name: string
  email: string
}

const FIELDS = ['first_name', 'last_name', 'email'] as const

export function ProfileInfoForm() {
  const { t } = useTranslation()
  const { user, updateUser } = useAuth()
  // บันทึกสำเร็จแล้ว (แสดงป้าย "บันทึกแล้ว")
  const [saved, setSaved] = useState(false)
  // error ที่ไม่ผูกกับช่องใด (เช่น ติดต่อเซิร์ฟเวอร์ไม่ได้)
  const [formError, setFormError] = useState<string>()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InfoForm>({
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
    },
  })

  /** ส่งฟอร์ม (เรียกเมื่อกรอกครบทุกช่องแล้วเท่านั้น) */
  async function onSubmit(values: InfoForm) {
    setSaved(false)
    setFormError(undefined)
    try {
      const updated = await updateProfile(values)
      updateUser(updated)
      // ใช้ค่าที่ backend บันทึกจริง (ตัดช่องว่าง / อีเมลตัวพิมพ์เล็ก) เป็นค่าในช่อง
      reset({ first_name: updated.first_name, last_name: updated.last_name, email: updated.email })
      setSaved(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'validation_error') {
        // ข้อความใต้ช่องที่ backend บอกว่าผิด
        for (const field of FIELDS) {
          const message = fieldErrorsMessage(caught.fields[field])
          if (message) setError(field, { type: 'server', message })
        }
        return
      }
      setFormError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
    }
  }

  // พิมพ์แก้ช่องใดก็ได้ → ซ่อนป้าย "บันทึกแล้ว" และข้อความ error รวม
  const onEdit = () => {
    setSaved(false)
    setFormError(undefined)
  }

  /** ข้อความใต้ช่อง: ช่องว่าง (ตรวจในหน้าเว็บ) หรือข้อความจาก backend */
  const messageOf = (field: keyof InfoForm) =>
    errors[field]?.type === 'required'
      ? fieldErrorMessage('required')
      : (errors[field]?.message as string | undefined)

  return (
    <form
      noValidate
      aria-labelledby="profile-info-title"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-[18px]"
    >
      <h2
        id="profile-info-title"
        className="m-0 font-display text-xl leading-[1.4] font-semibold"
      >
        {t('profile.infoTitle')}
      </h2>

      {/* ชื่อ-นามสกุลคู่กัน — จอแคบมากเรียงลงเอง
          ช่องกว้างอย่างน้อย 140px (canvas ใช้ 150px แต่โครงหน้าจอมือถือเว้นขอบ 20px มากกว่า board
          ข้อมูลส่วนตัว 4px ต่อข้าง → ที่มือถือ 390px ต้อง 140px ถึงจะคู่กันได้ตาม wireframe) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <TextField
          label={t('profile.firstName')}
          autoComplete="given-name"
          error={messageOf('first_name')}
          {...register('first_name', { required: true, onChange: onEdit })}
        />
        <TextField
          label={t('profile.lastName')}
          autoComplete="family-name"
          error={messageOf('last_name')}
          {...register('last_name', { required: true, onChange: onEdit })}
        />
      </div>
      <TextField
        label={t('profile.email')}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={messageOf('email')}
        {...register('email', { required: true, onChange: onEdit })}
      />

      <div className="flex flex-wrap items-center gap-3.5">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('profile.saving') : t('profile.save')}
        </Button>
        {/* role=status: โปรแกรมอ่านหน้าจออ่าน "บันทึกแล้ว" เมื่อป้ายปรากฏ */}
        <span role="status">
          {saved && (
            <StatusBadge tone="ok" icon={<CheckIcon />}>
              {t('profile.saved')}
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
