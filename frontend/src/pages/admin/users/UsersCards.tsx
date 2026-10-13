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
 * - แถวปุ่มทำรายการท้ายการ์ด คั่นด้วยเส้นบาง (UserActions — ขั้น 2.6)
 * - ซ่อนบนจอใหญ่ (lg:hidden) — จอใหญ่ใช้ตารางแทน
 */
import { useTranslation } from 'react-i18next'
import type { AdminUser } from '../../../api/adminUsers'
import { Card } from '../../../components/ui'
import { UserActions, type UserActionHandlers } from './UserActions'
import { UserName, UserStatusBadge } from './UserBits'

type UsersCardsProps = {
  users: AdminUser[]
  /** รหัสบัญชีของผู้ที่เข้าสู่ระบบอยู่ (ใช้ติดป้าย "คุณ" และซ่อนปุ่มที่ทำกับตัวเองไม่ได้) */
  currentUserId: number
  /** ตัวจัดการปุ่มของแต่ละการ์ด */
  actions: UserActionHandlers
}

export function UsersCards({ users, currentUserId, actions }: UsersCardsProps) {
  const { t } = useTranslation()

  return (
    <ul aria-label={t('adminUsers.listLabel')} className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
      {users.map((user) => (
        <Card as="li" key={user.id} className="flex flex-col gap-2 px-4 pt-4 pb-2">
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
          {/* แถวปุ่มท้ายการ์ด (ตาม board มือถือ: เส้นคั่นบาง ปุ่มชิดซ้าย) */}
          <UserActions
            user={user}
            isSelf={user.id === currentUserId}
            {...actions}
            className="-ml-1.5 border-t border-line-soft pt-1"
          />
        </Card>
      ))}
    </ul>
  )
}
