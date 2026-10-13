/**
 * ชิ้นส่วนเล็กที่ตาราง (จอใหญ่) และการ์ด (มือถือ) ของหน้ารายชื่อผู้ใช้ใช้ร่วมกัน
 *
 *   <UserName>          ชื่อ-นามสกุล (ตัวหนา) + ป้าย "คุณ" ถ้าเป็นบัญชีของผู้ที่เข้าสู่ระบบอยู่
 *   <UserStatusBadge>   ป้ายเขียว ✓ "ใช้งานได้" / ป้ายแดง 🔒 "ระงับการใช้งาน"
 */
import { useTranslation } from 'react-i18next'
import type { AdminUser } from '../../../api/adminUsers'
import { StatusBadge } from '../../../components/ui'
import { ActiveIcon, SuspendedIcon } from './icons'

/** ชื่อ-นามสกุล + ป้าย "คุณ" (แถวของตัวเอง — การตัดสินใจก้อน 2 "กันล็อกตัวเอง") */
export function UserName({
  user,
  isSelf,
  className = '',
}: {
  user: AdminUser
  isSelf: boolean
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={`font-semibold ${className}`}>
      {user.first_name} {user.last_name}
      {isSelf && (
        <StatusBadge tone="mute" size="sm" className="ml-1.5 align-[2px]">
          {t('adminUsers.self')}
        </StatusBadge>
      )}
    </div>
  )
}

/** ป้ายสถานะของบัญชี */
export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation()
  return isActive ? (
    <StatusBadge tone="ok" icon={<ActiveIcon />}>
      {t('adminUsers.statusActive')}
    </StatusBadge>
  ) : (
    <StatusBadge tone="bad" icon={<SuspendedIcon />}>
      {t('adminUsers.statusSuspended')}
    </StatusBadge>
  )
}
