/**
 * หน้าข้อมูลส่วนตัว /profile — แบบชั่วคราว (ขั้น 1.4) แสดงข้อมูลจาก GET /auth/me/
 * (ใช้ TanStack Query ดึงข้อมูล — พิสูจน์ว่าการแนบบัตร/แลกบัตรอัตโนมัติทำงาน)
 * หน้าตาจริง + แก้ไขข้อมูลตาม wireframe UC-02 ทำในขั้น 1.8
 * แสดงภายในโครงหน้าจอ (AppShell) ตั้งแต่ขั้น 1.6 — กลับหน้าแรกผ่านเมนู "ภาพรวม"
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchMe } from '../api/auth'

export default function ProfilePage() {
  const { t } = useTranslation()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 font-display text-[32px] font-semibold">{t('profile.title')}</h1>
      {me && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          <li className="font-semibold">
            {me.first_name} {me.last_name}
          </li>
          <li className="text-ink-muted">{t(`roles.${me.role}`)}</li>
          <li className="text-ink-muted">{me.email}</li>
          {me.student_or_staff_id && <li className="text-ink-muted">{me.student_or_staff_id}</li>}
        </ul>
      )}
    </div>
  )
}
