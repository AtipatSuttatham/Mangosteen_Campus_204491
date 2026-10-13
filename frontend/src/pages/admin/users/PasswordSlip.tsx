/**
 * "ใบข้อมูลเข้าสู่ระบบ" ของหน้า "สร้างบัญชีแล้ว" / "รีเซ็ตรหัสผ่านแล้ว" (ผู้ใช้เลือกข้อ 1.ข ขั้น 2.6)
 * หน้าตาตาม board "สร้างบัญชีแล้ว" / "สร้างบัญชีแล้ว (มือถือ)" / "รีเซ็ตรหัสผ่านแล้ว"
 *
 *   ┌───────────────────────────────────────────┐
 *   │ เข้าสู่ระบบด้วย                              │
 *   │ s670510118@example.com                    │
 *   │ หรือรหัส 670510118                         │
 *   │ ───────────────────────────────────────── │
 *   │ รหัสผ่านชั่วคราว                             │
 *   │ hT7kPq4wNx9e              [⧉ คัดลอกรหัสผ่าน] │  ← รหัสตัวใหญ่ = จุดเด่นของหน้า ; มือถือปุ่มเต็มแถวใต้รหัส
 *   └───────────────────────────────────────────┘
 *   ⚠ ปิดหน้าต่างนี้แล้วจะดูรหัสนี้อีกไม่ได้ คัดลอกไปแจ้งผู้ใช้ก่อน
 *
 * รหัสผ่านที่แสดงคือรหัสที่ผู้ดูแลระบบเพิ่งกรอก/สุ่มในฟอร์ม (backend ไม่ส่งรหัสกลับ) —
 * อยู่ในหน่วยความจำของหน้าต่างนี้เท่านั้น ปิดหน้าต่างแล้วหายไป
 */
import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from './CopyButton'
import { CheckIcon, WarnIcon } from './icons'

type PasswordSlipProps = {
  email: string
  /** รหัสนักศึกษา/พนักงาน (ไม่มี = ไม่แสดงบรรทัด "หรือรหัส") */
  studentId: string | null
  /** ป้ายของแถวรหัสผ่าน เช่น "รหัสผ่านชั่วคราว" / "รหัสผ่านใหม่" */
  passwordLabel: string
  password: string
  /** ปุ่มคัดลอก (หน้าต่างโฟกัสที่ปุ่มนี้เมื่อเปลี่ยนมาหน้านี้) */
  copyRef?: Ref<HTMLButtonElement>
}

/** ใบข้อมูลเข้าสู่ระบบ + กล่องเตือน */
export function PasswordSlip({ email, studentId, passwordLabel, password, copyRef }: PasswordSlipProps) {
  const { t } = useTranslation()
  return (
    <>
      {/* ใบข้อมูล: มือถือพื้นขาว (เด่นจากพื้นหน้าต่าง) ; จอใหญ่พื้นม่วงอ่อน (เด่นจากหน้าต่างสีขาว) */}
      <dl className="m-0 rounded-xl border border-line bg-surface px-[18px] py-1 lg:bg-canvas">
        <div className="flex flex-col gap-0.5 py-3">
          <dt className="text-[13.5px] text-ink-muted">{t('userForm.loginWith')}</dt>
          <dd className="m-0 text-[15px] font-medium [overflow-wrap:anywhere]">
            {email}
            {studentId && (
              <span className="block text-sm font-normal text-ink-muted">
                {t('userForm.orId', { id: studentId })}
              </span>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-line py-3">
          <dt className="text-[13.5px] text-ink-muted">{passwordLabel}</dt>
          <dd className="m-0 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            {/* ตัวเลขเท่ากันทุกตัว + เว้นระยะตัวอักษร → อ่านออกเสียง/พิมพ์ตามง่าย */}
            <span className="text-[22px] font-semibold tracking-[0.08em] text-ink tabular-nums">
              {password}
            </span>
            <CopyButton ref={copyRef} text={password} label={t('userForm.copyPassword')} />
          </dd>
        </div>
      </dl>
      <div className="flex items-start gap-2.5 rounded-[10px] bg-warn-soft px-3.5 py-3 text-sm leading-[1.55] text-warn">
        <span className="mt-0.5">
          <WarnIcon />
        </span>
        <p className="m-0">
          {/* มือถือขึ้นบรรทัดใหม่ระหว่าง 2 ประโยค ; จอใหญ่อยู่บรรทัดเดียว */}
          <span className="block lg:inline">{t('userForm.doneWarningClosed')}</span>{' '}
          <span className="block lg:inline">{t('userForm.doneWarningCopy')}</span>
        </p>
      </div>
    </>
  )
}

/** วงกลมเขียว ✓ หน้าหัวข้อ "สร้างบัญชีแล้ว" / "รีเซ็ตรหัสผ่านแล้ว" (จอใหญ่) */
export function DoneMark() {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
      <CheckIcon size={22} />
    </span>
  )
}
