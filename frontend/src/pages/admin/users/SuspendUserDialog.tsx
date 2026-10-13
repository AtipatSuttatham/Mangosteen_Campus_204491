/**
 * หน้าต่างยืนยันการระงับบัญชี (UC-04 — ขั้น 2.6) เปิดจากปุ่ม "ระงับ" ในแถว/การ์ด
 * หน้าตาตาม board "หน้าต่างยืนยัน (ใช้ซ้ำได้) — ระงับบัญชี" (ใช้ ConfirmDialog — ปุ่มแดงทึบ, โฟกัส "ยกเลิก" ก่อน)
 *
 *   ระงับบัญชี วิชัย ทองมา?
 *   ผู้ใช้จะออกจากระบบทันที และเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง
 *   ข้อมูลและคะแนนของผู้ใช้ยังอยู่ครบ
 *                                   [ยกเลิก] [ระงับบัญชี]
 *
 * - ยืนยัน → POST /api/v1/admin/users/{id}/suspend/ → สำเร็จ: ปิดหน้าต่าง + รายชื่อโหลดใหม่ + แจ้งหน้า (onSuspended)
 * - ไม่สำเร็จ (เช่น last_active_admin — admin 2 คนกดพร้อมกัน) → ข้อความในหน้าต่าง ลองใหม่หรือยกเลิกได้
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { suspendAdminUser, type AdminUser } from '../../../api/adminUsers'
import { ApiError } from '../../../api/client'
import { errorMessage } from '../../../api/errors'
import { ConfirmDialog } from '../../../components/ui'

type SuspendUserDialogProps = {
  user: AdminUser
  onClose: () => void
  /** ระงับสำเร็จ (หน้าแสดงข้อความ "ระงับบัญชี … แล้ว") */
  onSuspended: (user: AdminUser) => void
}

export function SuspendUserDialog({ user, onClose, onSuspended }: SuspendUserDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const name = `${user.first_name} ${user.last_name}`

  async function confirm() {
    setPending(true)
    setError(undefined)
    try {
      const updated = await suspendAdminUser(user.id)
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      onSuspended(updated)
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
      setPending(false)
    }
  }

  return (
    <ConfirmDialog
      title={t('adminUsers.suspendTitle', { name })}
      description={[t('adminUsers.suspendEffect'), t('adminUsers.suspendKeepsData')]}
      confirmLabel={t('adminUsers.suspendConfirm')}
      pendingLabel={t('adminUsers.suspending')}
      pending={pending}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  )
}
