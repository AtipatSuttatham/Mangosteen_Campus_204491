/**
 * ตารางรายชื่อผู้ใช้สำหรับจอใหญ่ — หน้าตาตาม board "รายชื่อผู้ใช้" (ขั้น 2.5)
 *
 *   ชื่อและอีเมล               รหัสนักศึกษา/พนักงาน   บทบาท     สถานะ
 *   ─────────────────────────────────────────────────────────────────────
 *   ธนพล ใจดี                   670510118             ผู้เรียน   [✓ ใช้งานได้]
 *   s670510118@example.com
 *
 * - บัญชีที่ถูกระงับ: ตัวอักษรของชื่อ/รหัส/บทบาทเป็นสีรอง (ตาม wireframe)
 * - คอลัมน์สุดท้าย = ปุ่มทำรายการของแถวนั้น (UserActions — ขั้น 2.6) ; หัวคอลัมน์ซ่อนไว้ให้โปรแกรมอ่านหน้าจอ
 * - ซ่อนบนจอเล็ก (lg:table) — มือถือใช้การ์ดแทน
 * - ความกว้างคอลัมน์คงที่ (table-fixed + colgroup) — เปลี่ยนหน้าแล้วคอลัมน์ไม่ขยับตามความยาวข้อมูล
 */
import { useTranslation } from 'react-i18next'
import type { AdminUser } from '../../../api/adminUsers'
import { UserActions, type UserActionHandlers } from './UserActions'
import { UserName, UserStatusBadge } from './UserBits'

/** หัวตาราง (ตาม th ใน canvas: 14px ตัวหนา สีรอง) */
const TH = 'border-b border-line px-4 py-3 text-left text-sm font-semibold whitespace-nowrap text-ink-muted'
/** ช่องข้อมูล (ตาม td ใน canvas: 15px เส้นคั่นแถวสีอ่อน) */
const TD = 'border-b border-line-soft px-4 py-3 align-middle text-[15px]'

type UsersTableProps = {
  users: AdminUser[]
  /** รหัสบัญชีของผู้ที่เข้าสู่ระบบอยู่ (ใช้ติดป้าย "คุณ" และซ่อนปุ่มที่ทำกับตัวเองไม่ได้) */
  currentUserId: number
  /** ตัวจัดการปุ่มของแต่ละแถว */
  actions: UserActionHandlers
}

export function UsersTable({ users, currentUserId, actions }: UsersTableProps) {
  const { t } = useTranslation()

  return (
    <table className="hidden w-full table-fixed border-collapse lg:table">
      {/* สัดส่วนคอลัมน์: ชื่อและอีเมล / รหัส / บทบาท / สถานะ / ปุ่ม */}
      <colgroup>
        <col className="w-[25%]" />
        <col className="w-[20%]" />
        <col className="w-[11%]" />
        <col className="w-[18%]" />
        <col className="w-[26%]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={`${TH} pl-6`}>
            {t('adminUsers.columnName')}
          </th>
          {/* หัวคอลัมน์รหัสยาว — ให้ขึ้นบรรทัดใหม่ได้ (คอลัมน์แคบลงเพราะมีคอลัมน์ปุ่ม) */}
          <th scope="col" className={`${TH} whitespace-normal!`}>
            {t('adminUsers.columnId')}
          </th>
          <th scope="col" className={TH}>
            {t('adminUsers.columnRole')}
          </th>
          <th scope="col" className={TH}>
            {t('adminUsers.columnStatus')}
          </th>
          <th scope="col" className={`${TH} pr-4`}>
            <span className="sr-only">{t('adminUsers.columnActions')}</span>
          </th>
        </tr>
      </thead>
      <tbody className="[&>tr:last-child>td]:border-b-0">
        {users.map((user) => {
          // บัญชีที่ถูกระงับ: ข้อมูลเป็นสีรอง
          const tone = user.is_active ? '' : 'text-ink-muted'
          return (
            <tr key={user.id}>
              <td className={`${TD} pl-6 ${tone}`}>
                <UserName user={user} isSelf={user.id === currentUserId} />
                <div className="text-[13.5px] leading-[1.6] break-all text-ink-muted">
                  {user.email}
                </div>
              </td>
              <td className={`${TD} ${tone}`}>
                {user.student_or_staff_id ?? (
                  // ไม่มีรหัส: ขีดสำหรับตา + ข้อความให้โปรแกรมอ่านหน้าจอ
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">{t('adminUsers.noId')}</span>
                  </>
                )}
              </td>
              <td className={`${TD} whitespace-nowrap ${tone}`}>{t(`roles.${user.role}`)}</td>
              <td className={TD}>
                <UserStatusBadge isActive={user.is_active} />
              </td>
              {/* ปุ่มชิดซ้ายของช่อง (ตาม canvas) — ขอบซ้ายเล็กเพราะปุ่มตัวอักษรมีขอบในอยู่แล้ว */}
              <td className={`${TD} pr-4 pl-2`}>
                <UserActions user={user} isSelf={user.id === currentUserId} {...actions} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
