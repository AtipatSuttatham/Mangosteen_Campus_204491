/**
 * หน้าข้อมูลส่วนตัว /profile (UC-02 — ขั้น 1.8) ทุกบทบาท
 * หน้าตาตาม board "ข้อมูลส่วนตัว" (จอใหญ่) + "ข้อมูลส่วนตัว (มือถือ)" ใน design canvas (ผู้ใช้อนุมัติ 2026-10-11)
 * แสดงภายในโครงหน้าจอ (AppShell) — sidebar / แถบมือถือ / ลายจาง อยู่ที่โครง
 *
 *   ข้อมูลส่วนตัว
 *   ┌───────────────────── แถบบัตรประจำตัว (ProfileHeader) ─────────────────────┐
 *   └──────────────────────────────────────────────────────────────────────────┘
 *   ┌ การ์ด ─────────────────────────────┬──────────────────────────────────────┐
 *   │ ข้อมูลทั่วไป (ProfileInfoForm)       │ เปลี่ยนรหัสผ่าน (PasswordForm)        │  ← จอใหญ่ 2 คอลัมน์
 *   └────────────────────────────────────┴──────────────────────────────────────┘     มือถือเรียงลง
 *
 * ข้อความ error ของรูปประจำตัวแสดงบนสุดของการ์ด (ใต้รูปที่ยื่นลงมา)
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PasswordForm } from './PasswordForm'
import { ProfileHeader } from './ProfileHeader'
import { ProfileInfoForm } from './ProfileInfoForm'

export default function ProfilePage() {
  const { t } = useTranslation()
  // ข้อความ error ของรูปประจำตัว (ไฟล์ผิดชนิด / ใหญ่เกิน / ติดต่อไม่ได้)
  const [avatarError, setAvatarError] = useState<string>()

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <h1 className="m-0 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]">
        {t('profile.title')}
      </h1>

      <div className="max-w-[900px]">
        <ProfileHeader onAvatarError={setAvatarError} />

        {/* การ์ดต่อจากแถบ (ไม่มีขอบบน) — จอใหญ่เว้นด้านบน 76px ให้รูปที่ยื่นลงมา */}
        <div
          className={
            'grid gap-7 rounded-b-card border border-t-0 border-line bg-surface px-5 py-6 ' +
            'lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] lg:gap-10 lg:px-10 lg:pt-[76px] lg:pb-9'
          }
        >
          {avatarError && (
            <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger lg:col-span-3">
              {avatarError}
            </p>
          )}
          <ProfileInfoForm />
          {/* เส้นคั่น: มือถือแนวนอน / จอใหญ่แนวตั้ง */}
          <div aria-hidden="true" className="h-px bg-line lg:h-auto lg:w-px" />
          <PasswordForm />
        </div>
      </div>
    </div>
  )
}
