/**
 * หน้าจัดการบัญชีผู้ใช้ /users (UC-04 — ขั้น 2.5) เฉพาะผู้ดูแลระบบ
 * หน้าตาตาม board "รายชื่อผู้ใช้" + "รายชื่อผู้ใช้ (มือถือ)" ใน design canvas (ผู้ใช้อนุมัติ 2026-10-12)
 */
import { useTranslation } from 'react-i18next'

export default function UsersPage() {
  const { t } = useTranslation()

  return (
    <h1 className="m-0 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]">
      {t('adminUsers.title')}
    </h1>
  )
}
