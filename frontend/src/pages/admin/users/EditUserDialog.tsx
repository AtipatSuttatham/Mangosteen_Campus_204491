/**
 * หน้าต่าง "แก้ไขข้อมูลผู้ใช้" (UC-04 — ขั้น 2.6) เปิดจากปุ่ม "แก้ไข" ในแถว/การ์ดของรายชื่อ
 * หน้าตาตาม board "แก้ไขบัญชีตัวเอง — บทบาทล็อก" (จอใหญ่) ; มือถือใช้รูปแบบเดียวกับ "เพิ่มผู้ใช้ (มือถือ)"
 * (ผู้ใช้เลือกข้อ 2.ก ขั้น 2.6)
 *
 *   ช่องเหมือนหน้าต่างเพิ่มผู้ใช้ แต่ไม่มีรหัสผ่าน (เปลี่ยนรหัสใช้ปุ่ม "รีเซ็ตรหัสผ่าน")
 *   บัญชีตัวเอง: บทบาทล็อก + คำอธิบาย (การตัดสินใจก้อน 2 "กันล็อกตัวเอง")
 *
 * - ส่งไป backend เฉพาะช่องที่เปลี่ยนจริง (PATCH) → AuditLog จดเฉพาะช่องที่เปลี่ยน
 *   ยังไม่แก้อะไร → ปุ่ม "บันทึก" กดไม่ได้
 * - บันทึกสำเร็จ → ปิดหน้าต่าง + รายชื่อโหลดใหม่ + แถบข้อความใต้หัวหน้า (onSaved) ; แก้บัญชีตัวเอง → ชื่อใน sidebar/ทุกแท็บเปลี่ยนทันที
 * - backend ปฏิเสธรายช่อง → ข้อความใต้ช่อง ; อื่น ๆ (เช่น last_active_admin) → ข้อความเหนือปุ่ม
 */
import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { updateAdminUser, type AdminUser, type AdminUserUpdate } from '../../../api/adminUsers'
import { useAuth } from '../../../auth/AuthContext'
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader } from '../../../components/ui'
import { UserFields } from './UserFields'
import { applySaveError, type UserFormValues } from './userForm'

/** ช่องที่แก้ได้ (ส่งเฉพาะช่องที่ค่าเปลี่ยน) */
const EDITABLE = ['first_name', 'last_name', 'email', 'student_or_staff_id', 'role'] as const

type EditUserDialogProps = {
  user: AdminUser
  /** เป็นบัญชีของผู้ดูแลระบบที่เข้าสู่ระบบอยู่ (บทบาทล็อก) */
  isSelf: boolean
  onClose: () => void
  /** บันทึกสำเร็จ (หน้าแสดงข้อความ "บันทึกข้อมูลของ … แล้ว") */
  onSaved?: (user: AdminUser) => void
}

export function EditUserDialog({ user, isSelf, onClose, onSaved }: EditUserDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { updateUser } = useAuth()
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  // error ที่ไม่ผูกกับช่องใด (เช่น last_active_admin / ติดต่อเซิร์ฟเวอร์ไม่ได้)
  const [formError, setFormError] = useState<string>()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormValues>({
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      student_or_staff_id: user.student_or_staff_id ?? '',
      role: user.role,
      password: '',
    },
  })

  /** ส่งฟอร์ม: เทียบกับค่าเดิม แล้วส่งเฉพาะช่องที่เปลี่ยน */
  async function onSubmit(values: UserFormValues) {
    setFormError(undefined)
    const original: Record<(typeof EDITABLE)[number], string> = {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      student_or_staff_id: user.student_or_staff_id ?? '',
      role: user.role,
    }
    const changes: AdminUserUpdate = {}
    for (const field of EDITABLE) {
      // บัญชีตัวเองไม่ส่งบทบาท (ล็อกไว้) ; ตัดช่องว่างหัวท้ายก่อนเทียบ (backend ก็ตัดเหมือนกัน)
      if (field === 'role' && isSelf) continue
      if (values[field].trim() !== original[field]) Object.assign(changes, { [field]: values[field] })
    }
    // แก้แค่ช่องว่างหัวท้าย = ไม่มีอะไรเปลี่ยนจริง → ปิดเฉย ๆ
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    try {
      const updated = await updateAdminUser(user.id, changes)
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      if (isSelf) {
        // ชื่อ/อีเมลของตัวเองเปลี่ยน → ทั่วหน้าจอและทุกแท็บเปลี่ยนตาม (เหมือนหน้าข้อมูลส่วนตัว)
        updateUser({
          id: updated.id,
          email: updated.email,
          student_or_staff_id: updated.student_or_staff_id,
          role: updated.role,
          first_name: updated.first_name,
          last_name: updated.last_name,
          avatar_url: updated.avatar_url,
        })
      }
      onSaved?.(updated)
      onClose()
    } catch (caught) {
      setFormError(applySaveError(caught, setError))
    }
  }

  // ระหว่างบันทึกปิดหน้าต่างไม่ได้ (รอผลก่อน)
  const requestClose = () => {
    if (!isSubmitting) onClose()
  }

  const name = `${user.first_name} ${user.last_name}`
  const subtitle = isSelf
    ? t('userForm.selfAccount', { name })
    : user.student_or_staff_id
      ? t('userForm.nameWithId', { name, id: user.student_or_staff_id })
      : name

  return (
    <Dialog labelledBy={titleId} onClose={requestClose} initialFocusRef={firstFieldRef}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex grow flex-col">
        <DialogHeader
          titleId={titleId}
          title={t('userForm.editTitle')}
          subtitle={subtitle}
          eyebrow={t('adminUsers.title')}
          onClose={requestClose}
          closeDisabled={isSubmitting}
        />
        <DialogBody>
          <UserFields
            register={register}
            errors={errors}
            firstFieldRef={firstFieldRef}
            lockedRole={isSelf ? user.role : undefined}
          />
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
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? t('userForm.saving') : t('userForm.save')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
