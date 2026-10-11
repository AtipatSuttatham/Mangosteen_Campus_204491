/**
 * หน้าแรกหลังเข้าสู่ระบบ / — แบบชั่วคราว ใช้จนถึงก้อน 10 (แล้วแทนด้วยหน้าภาพรวมจริงของแต่ละบทบาท)
 * หน้าตาตาม board "หน้าแรกหลังเข้าสู่ระบบ (ชั่วคราว)" + "โครงหน้าจอบนมือถือ (เมนูปิด)" ใน design canvas
 * แสดงภายในโครงหน้าจอ (AppShell) — sidebar / แถบมือถือ / ลายจาง อยู่ที่โครง ไม่ใช่ที่หน้านี้
 *
 *   สวัสดี สมใจ
 *   วันอาทิตย์ที่ 11 ตุลาคม 2569   ผู้เรียน   รหัสนักศึกษา 690000001
 *   ─────────────────────────────────────────
 *
 *   ยังไม่มีงานที่ต้องทำ                ← ข้อความแยกตามบทบาท (ผู้ใช้เลือกแบบ ก ขั้น 1.6)
 *   เมื่อผู้สอนเพิ่มคุณเข้ารายวิชา ...
 *   [ดูข้อมูลส่วนตัว]
 *
 * บรรทัดข้อมูล: บทบาทแสดงเฉพาะจอใหญ่ (board มือถือตัดออก) ; ไม่มีรหัส (เช่น ผู้ดูแลระบบ) → ไม่แสดงรหัส
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { buttonClassName } from '../components/ui'
import { formatLongDate } from '../lib/datetime'

export default function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user) return null

  // ป้ายรหัส: ผู้เรียน = รหัสนักศึกษา ; ผู้สอน/ผู้ดูแลระบบ = รหัสพนักงาน
  const idLabel = user.student_or_staff_id
    ? t(user.role === 'student' ? 'account.studentId' : 'account.staffId', {
        id: user.student_or_staff_id,
      })
    : null

  return (
    <>
      {/* หัวหน้า: คำทักทาย + บรรทัดข้อมูล แล้วเส้นคั่น */}
      <div className="max-w-[640px] border-b border-line pb-5 lg:pb-7">
        <h1 className="m-0 font-display text-[32px] leading-[1.3] font-semibold lg:text-[40px]">
          {t('home.greeting', { name: user.first_name })}
        </h1>
        <p className="m-0 mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[14.5px] text-ink-muted lg:mt-2 lg:gap-x-5 lg:gap-y-1 lg:text-[15px]">
          <span>{formatLongDate(new Date())}</span>
          <span className="hidden lg:inline">{t(`roles.${user.role}`)}</span>
          {idLabel && <span>{idLabel}</span>}
        </p>
      </div>

      {/* ยังไม่มีข้อมูล: ข้อความตามบทบาท + ทางไปหน้าข้อมูลส่วนตัว */}
      <section
        aria-labelledby="home-empty-title"
        className="mt-12 flex max-w-[300px] flex-col gap-2 lg:mt-[120px] lg:max-w-[440px] lg:gap-2.5"
      >
        <h2
          id="home-empty-title"
          className="m-0 font-display text-[22px] leading-[1.4] font-semibold lg:text-[26px]"
        >
          {t(`home.empty.${user.role}.title`)}
        </h2>
        <p className="m-0 text-[15px] leading-[1.75] text-ink-muted lg:text-base">
          {t(`home.empty.${user.role}.body`)}
        </p>
        <div className="mt-2 lg:mt-2.5">
          <Link to="/profile" className={buttonClassName('secondary')}>
            {t('home.viewProfile')}
          </Link>
        </div>
      </section>
    </>
  )
}
