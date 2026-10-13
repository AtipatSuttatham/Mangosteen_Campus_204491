/**
 * รายชื่อผู้ใช้แบบการ์ดสำหรับจอเล็ก — หน้าตาตาม board "รายชื่อผู้ใช้ (มือถือ)" (ขั้น 2.5)
 *
 *   ┌──────────────────────────────────────────┐
 *   │ กันต์พงษ์ วิไลรัตน์            [✓ ใช้งานได้] │
 *   │ s660510221@example.com                    │
 *   │ ผู้เรียน     รหัส 660510221                │
 *   └──────────────────────────────────────────┘
 *
 * - 1 คน = 1 การ์ด เรียงลงมา
 * - อีเมลอยู่ใต้แถวชื่อ + ป้าย ใช้ความกว้างเต็มการ์ด (ป้ายยาวอย่าง "ระงับการใช้งาน" ไม่บีบอีเมลจนตัดกลางคำ) ;
 *   อีเมลยาวมากจริง ๆ ยังตัดขึ้นบรรทัดใหม่ได้ (ไม่ล้นจอ)
 * - ยังไม่มีแถวปุ่มแก้ไข / รีเซ็ต / ระงับ ด้านล่างการ์ด — มาในขั้น 2.6 (ผู้ใช้เลือกข้อ 1.ก ขั้น 2.5)
 * - ซ่อนบนจอใหญ่ (lg:hidden) — จอใหญ่ใช้ตารางแทน
 */
import { useTranslation } from 'react-i18next'
import type { AdminUser } from '../../../api/adminUsers'
import { Card } from '../../../components/ui'
import { UserName, UserStatusBadge } from './UserBits'

type UsersCardsProps = {
  users: AdminUser[]
  /** รหัสบัญชีของผู้ที่เข้าสู่ระบบอยู่ (ใช้ติดป้าย "คุณ") */
  currentUserId: number
}

export function UsersCards({ users, currentUserId }: UsersCardsProps) {
  const { t } = useTranslation()

  return (
    <ul aria-label={t('adminUsers.listLabel')} className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
      {users.map((user) => (
        <Card as="li" key={user.id} className="flex flex-col gap-2 p-4">
          <div>
            <div className="flex items-start justify-between gap-2.5">
              <UserName
                user={user}
                isSelf={user.id === currentUserId}
                className={`min-w-0 text-base ${user.is_active ? '' : 'text-ink-muted'}`}
              />
              <UserStatusBadge isActive={user.is_active} />
            </div>
            <div className="text-[13.5px] leading-[1.6] [overflow-wrap:anywhere] text-ink-muted">
              {user.email}
            </div>
          </div>
          {/* ข้อมูลประกอบวางเรียงกันโดยเว้นระยะ (ตาม .stats ใน canvas — ไม่คั่นด้วยจุด) */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
            <span>{t(`roles.${user.role}`)}</span>
            {user.student_or_staff_id && (
              <span>{t('adminUsers.idShort', { id: user.student_or_staff_id })}</span>
            )}
          </div>
        </Card>
      ))}
    </ul>
  )
}
