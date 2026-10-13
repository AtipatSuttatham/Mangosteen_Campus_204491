/**
 * ปุ่มทำรายการของแต่ละบัญชี — คอลัมน์ท้ายตาราง (จอใหญ่) และแถวปุ่มท้ายการ์ด (มือถือ)
 * หน้าตาตาม board "รายชื่อผู้ใช้" / "รายชื่อผู้ใช้ (มือถือ)" (ขั้น 2.6):
 *
 *   แก้ไข   รีเซ็ตรหัสผ่าน  │  ระงับ          ← บัญชีที่ใช้งานได้ ("ระงับ" สีแดง)
 *   แก้ไข   รีเซ็ตรหัสผ่าน  │  เปิดใช้งาน     ← บัญชีที่ถูกระงับ
 *   แก้ไข                                  ← บัญชีตัวเอง (รีเซ็ต/ระงับตัวเองไม่ได้ — การตัดสินใจก้อน 2)
 *
 * แสดงเฉพาะปุ่มที่ทำงานได้แล้ว (ผู้ใช้เลือกข้อ 1.ก ขั้น 2.5) — ปุ่มที่ไม่ได้ส่งตัวจัดการมาจะไม่แสดง
 * ชื่อปุ่มสำหรับโปรแกรมอ่านหน้าจอมีชื่อผู้ใช้ต่อท้าย (เช่น "แก้ไข ธนพล ใจดี") เพราะมีหลายแถว
 */
import { useTranslation } from 'react-i18next'
import type { AdminUser } from '../../../api/adminUsers'
import { Button } from '../../../components/ui'

/** ตัวจัดการปุ่มต่าง ๆ — หน้า UsersPage เป็นคนเปิดหน้าต่าง */
export type UserActionHandlers = {
  onEdit: (user: AdminUser) => void
  onResetPassword: (user: AdminUser) => void
}

type UserActionsProps = UserActionHandlers & {
  user: AdminUser
  /** บัญชีของผู้ที่เข้าสู่ระบบอยู่ — มีแค่ "แก้ไข" */
  isSelf: boolean
  className?: string
}

export function UserActions({
  user,
  isSelf,
  onEdit,
  onResetPassword,
  className = '',
}: UserActionsProps) {
  const { t } = useTranslation()
  const name = `${user.first_name} ${user.last_name}`

  return (
    <div className={`flex flex-wrap items-center ${className}`}>
      <Button
        variant="text"
        aria-label={t('adminUsers.editLabel', { name })}
        onClick={() => onEdit(user)}
      >
        {t('adminUsers.edit')}
      </Button>
      {/* บัญชีตัวเองรีเซ็ตรหัสไม่ได้ (ใช้หน้าข้อมูลส่วนตัว — cannot_modify_self) */}
      {!isSelf && (
        <Button
          variant="text"
          aria-label={t('adminUsers.resetPasswordLabel', { name })}
          onClick={() => onResetPassword(user)}
        >
          {t('adminUsers.resetPassword')}
        </Button>
      )}
    </div>
  )
}
