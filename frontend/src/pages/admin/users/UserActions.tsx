/**
 * ปุ่มทำรายการของแต่ละบัญชี — คอลัมน์ท้ายตาราง (จอใหญ่) และแถวปุ่มท้ายการ์ด (มือถือ)
 * หน้าตาตาม board "รายชื่อผู้ใช้" / "รายชื่อผู้ใช้ (มือถือ)" (ขั้น 2.6):
 *
 *   แก้ไข   รีเซ็ตรหัสผ่าน  │  ระงับ          ← บัญชีที่ใช้งานได้ ("ระงับ" สีแดง → ถามยืนยันก่อน)
 *   แก้ไข   รีเซ็ตรหัสผ่าน  │  เปิดใช้งาน     ← บัญชีที่ถูกระงับ (ทำทันทีไม่ถาม)
 *   แก้ไข                                  ← บัญชีตัวเอง (รีเซ็ต/ระงับตัวเองไม่ได้ — การตัดสินใจก้อน 2)
 *
 * ชื่อปุ่มสำหรับโปรแกรมอ่านหน้าจอมีชื่อผู้ใช้ต่อท้าย (เช่น "ระงับ ธนพล ใจดี") เพราะมีหลายแถว
 */
import { useTranslation } from 'react-i18next'
import type { AdminUser } from '../../../api/adminUsers'
import { Button } from '../../../components/ui'

/** ตัวจัดการปุ่มต่าง ๆ — หน้า UsersPage เป็นคนเปิดหน้าต่าง / เรียก API */
export type UserActionHandlers = {
  onEdit: (user: AdminUser) => void
  onResetPassword: (user: AdminUser) => void
  onSuspend: (user: AdminUser) => void
  onActivate: (user: AdminUser) => void
  /** รหัสบัญชีที่กำลังเปิดใช้งานอยู่ (ปุ่มของแถวนั้นกดไม่ได้ + ข้อความรอ) */
  activatingId: number | null
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
  onSuspend,
  onActivate,
  activatingId,
  className = '',
}: UserActionsProps) {
  const { t } = useTranslation()
  const name = `${user.first_name} ${user.last_name}`
  const activating = activatingId === user.id
  // ขอบในของปุ่มแคบลงเล็กน้อย (6px) ให้ 3 ปุ่มอยู่แถวเดียวในคอลัมน์ตาราง
  const tight = 'px-1.5'

  return (
    <div className={`flex flex-wrap items-center ${className}`}>
      <Button
        variant="text"
        className={tight}
        aria-label={t('adminUsers.editLabel', { name })}
        onClick={() => onEdit(user)}
      >
        {t('adminUsers.edit')}
      </Button>
      {/* บัญชีตัวเองรีเซ็ตรหัส/ระงับไม่ได้ (cannot_modify_self) — เปลี่ยนรหัสที่หน้าข้อมูลส่วนตัว */}
      {!isSelf && (
        <>
          <Button
            variant="text"
            className={tight}
            aria-label={t('adminUsers.resetPasswordLabel', { name })}
            onClick={() => onResetPassword(user)}
          >
            {t('adminUsers.resetPassword')}
          </Button>
          {/* เส้นคั่นก่อนปุ่มเปลี่ยนสถานะ (ตาม canvas) */}
          <span aria-hidden="true" className="mx-1 h-[22px] w-px bg-line" />
          {user.is_active ? (
            <Button
              variant="danger-text"
              className={tight}
              aria-label={t('adminUsers.suspendLabel', { name })}
              onClick={() => onSuspend(user)}
            >
              {t('adminUsers.suspend')}
            </Button>
          ) : (
            <Button
              variant="text"
              className={tight}
              aria-label={activating ? undefined : t('adminUsers.activateLabel', { name })}
              disabled={activating}
              onClick={() => onActivate(user)}
            >
              {activating ? t('adminUsers.activating') : t('adminUsers.activate')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
