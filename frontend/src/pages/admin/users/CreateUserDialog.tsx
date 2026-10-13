/**
 * หน้าต่าง "เพิ่มผู้ใช้" (UC-04 — ขั้น 2.6) เปิดจากปุ่ม "เพิ่มผู้ใช้" บนหัวหน้า /users
 * หน้าตาตาม board "เพิ่มผู้ใช้" (จอใหญ่) และ "เพิ่มผู้ใช้ (มือถือ)" — มือถือเต็มจอ แบ่ง 3 กล่อง
 *
 * 2 หน้าในหน้าต่างเดียว:
 *   ① ฟอร์ม: ชื่อ / นามสกุล / อีเมล / รหัส / บทบาท / รหัสผ่านชั่วคราว (สุ่มให้แล้วตั้งแต่เปิด)
 *        → "สร้างบัญชี" → POST /api/v1/admin/users/
 *   ② สร้างบัญชีแล้ว (ผู้ใช้เลือกข้อ 1.ข): ใบข้อมูลเข้าสู่ระบบ + รหัส + ปุ่มคัดลอก
 *        → "เพิ่มอีกคน" (กลับไปฟอร์มเปล่า + รหัสสุ่มใหม่) หรือ "เสร็จ" (ปิดหน้าต่าง)
 *
 * - backend ปฏิเสธรายช่อง (อีเมลซ้ำ, รหัสผ่านไม่ผ่านกฎ ฯลฯ) → ข้อความใต้ช่องนั้น ; อื่น ๆ → ข้อความเหนือปุ่ม
 * - ระหว่างบันทึก: ปุ่มกดไม่ได้ + "กำลังสร้างบัญชี…" และปิดหน้าต่างไม่ได้ (กันสร้างซ้อน)
 * - สร้างสำเร็จ → รายชื่อด้านหลังโหลดใหม่ (บัญชีใหม่อยู่บนสุด)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createAdminUser, type AdminUser } from '../../../api/adminUsers'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader } from '../../../components/ui'
import { generateTempPassword } from '../../../lib/passwords'
import { FormGroup } from './FormGroup'
import { InfoIcon, KeyIcon, PlusIcon } from './icons'
import { DoneMark, PasswordSlip } from './PasswordSlip'
import { TempPasswordField } from './TempPasswordField'
import { UserFields } from './UserFields'
import { applySaveError, fieldMessage, type UserFormValues } from './userForm'

/** ค่าเริ่มต้นของฟอร์มเปล่า (บทบาทเริ่มที่ผู้เรียน ตาม board ; รหัสผ่านสุ่มใหม่ทุกครั้ง) */
function emptyForm(): UserFormValues {
  return {
    first_name: '',
    last_name: '',
    email: '',
    student_or_staff_id: '',
    role: 'student',
    password: generateTempPassword(),
  }
}

/** บัญชีที่เพิ่งสร้าง + รหัสที่ตั้ง (ใช้แสดงหน้า "สร้างบัญชีแล้ว") */
type Created = { user: AdminUser; password: string }

export function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const titleId = useId()
  // null = หน้าฟอร์ม ; มีค่า = หน้า "สร้างบัญชีแล้ว"
  const [created, setCreated] = useState<Created | null>(null)
  // error ที่ไม่ผูกกับช่องใด (เช่น ติดต่อเซิร์ฟเวอร์ไม่ได้)
  const [formError, setFormError] = useState<string>()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  // ค่าเริ่มต้นของฟอร์ม (สุ่มรหัสครั้งเดียวตอนเปิดหน้าต่าง)
  const [initialValues] = useState(emptyForm)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({ defaultValues: initialValues })
  // รหัสในช่องตอนนี้ (ปุ่ม "คัดลอก" ใช้)
  const password = useWatch({ control, name: 'password' })

  const passwordField = register('password', { required: true })

  // เปลี่ยนหน้าในหน้าต่าง → ย้ายโฟกัสไปจุดเริ่มของหน้านั้น (ผู้ใช้แป้นพิมพ์ไม่หลงตำแหน่ง)
  const view = created ? 'done' : 'form'
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current === view) return
    previousView.current = view
    if (view === 'done') copyRef.current?.focus()
    else firstFieldRef.current?.focus()
  }, [view])

  /** ส่งฟอร์ม (เรียกเมื่อกรอกช่องบังคับครบแล้ว) */
  async function onSubmit(values: UserFormValues) {
    setFormError(undefined)
    try {
      const user = await createAdminUser(values)
      // รายชื่อด้านหลังโหลดใหม่ (ไม่ต้องรอ)
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setCreated({ user, password: values.password })
    } catch (caught) {
      setFormError(applySaveError(caught, setError))
    }
  }

  /** "เพิ่มอีกคน": กลับไปฟอร์มเปล่า + รหัสสุ่มใหม่ */
  function addAnother() {
    reset(emptyForm())
    setFormError(undefined)
    setCreated(null)
  }

  // ระหว่างบันทึกปิดหน้าต่างไม่ได้ (รอผลก่อน)
  const requestClose = () => {
    if (!isSubmitting) onClose()
  }

  // หน้าต่างเดียวกันทั้ง 2 หน้า (ไม่ปิด-เปิดใหม่) — เปลี่ยนแค่เนื้อหาข้างใน
  return (
    <Dialog
      labelledBy={titleId}
      onClose={created ? onClose : requestClose}
      size={created ? 'sm' : 'md'}
      initialFocusRef={firstFieldRef}
    >
      {created ? (
        <CreatedView
          created={created}
          titleId={titleId}
          copyRef={copyRef}
          onAddAnother={addAnother}
          onClose={onClose}
        />
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex grow flex-col">
          <DialogHeader
            titleId={titleId}
            title={t('userForm.createTitle')}
            // คำอธิบายนี้มีเฉพาะหัวม่วงบนมือถือ (board จอใหญ่ไม่มี)
            subtitle={<span className="lg:hidden">{t('userForm.createSubtitle')}</span>}
            eyebrow={t('adminUsers.title')}
            onClose={requestClose}
            closeDisabled={isSubmitting}
          />
          <DialogBody>
            <UserFields register={register} errors={errors} firstFieldRef={firstFieldRef} />

            <FormGroup title={t('userForm.groupPassword')} icon={<KeyIcon />}>
              <TempPasswordField
                label={t('userForm.password')}
                // มือถือ: หัวกล่องบอกชื่อแล้ว จึงซ่อนป้ายไว้ให้โปรแกรมอ่านหน้าจอ
                labelClassName="max-lg:sr-only"
                value={password}
                error={fieldMessage(errors, 'password')}
                // สุ่มใหม่ ; ถ้าช่องมี error อยู่ ตรวจใหม่ทันที (error หายเมื่อรหัสใช้ได้)
                onGenerate={(next) =>
                  setValue('password', next, { shouldValidate: errors.password !== undefined })
                }
                registration={passwordField}
              />
              <div
                className={
                  'flex items-start gap-2.5 rounded-[10px] bg-mute-soft px-3.5 py-3 text-[13.5px] ' +
                  'leading-[1.55] text-mute lg:-mt-1.5'
                }
              >
                <span className="mt-0.5">
                  <InfoIcon />
                </span>
                <p className="m-0">{t('userForm.passwordNote')}</p>
              </div>
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
              {isSubmitting ? t('userForm.creating') : t('userForm.create')}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}

/** หน้า "สร้างบัญชีแล้ว": ใบข้อมูลเข้าสู่ระบบ + ปุ่ม "เพิ่มอีกคน" / "เสร็จ" */
function CreatedView({
  created,
  titleId,
  copyRef,
  onAddAnother,
  onClose,
}: {
  created: Created
  titleId: string
  copyRef: RefObject<HTMLButtonElement | null>
  onAddAnother: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const name = `${created.user.first_name} ${created.user.last_name}`
  return (
    <>
      <DialogHeader
        titleId={titleId}
        title={t('userForm.createdTitle')}
        subtitle={t('userForm.nameWithRole', { name, role: t(`roles.${created.user.role}`) })}
        eyebrow={t('adminUsers.title')}
        icon={<DoneMark />}
        onClose={onClose}
      />
      <DialogBody className="max-lg:pt-5">
        <PasswordSlip
          email={created.user.email}
          studentId={created.user.student_or_staff_id}
          passwordLabel={t('userForm.password')}
          password={created.password}
          copyRef={copyRef}
        />
      </DialogBody>
      <DialogFooter mobileColumns="grid-cols-2">
        <Button variant="secondary" onClick={onAddAnother}>
          <PlusIcon />
          {t('userForm.addAnother')}
        </Button>
        <Button onClick={onClose}>{t('userForm.done')}</Button>
      </DialogFooter>
    </>
  )
}
