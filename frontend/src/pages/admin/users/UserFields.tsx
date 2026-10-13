/**
 * ช่องกรอกข้อมูลผู้ใช้ที่หน้าต่าง "เพิ่มผู้ใช้" และ "แก้ไขข้อมูลผู้ใช้" ใช้ร่วมกัน (ขั้น 2.6)
 * หน้าตาตาม board "เพิ่มผู้ใช้" (จอใหญ่) / "เพิ่มผู้ใช้ (มือถือ)" / "แก้ไขบัญชีตัวเอง — บทบาทล็อก"
 *
 *   ชื่อ [      ]  นามสกุล [      ]
 *   อีเมล [                       ]
 *   รหัสนักศึกษา/พนักงาน [          ]   ผู้ใช้เข้าสู่ระบบด้วยรหัสนี้หรืออีเมลก็ได้
 *   บทบาท  (●) ผู้เรียน  ( ) ผู้สอน  ( ) ผู้ดูแลระบบ      ← มือถือ: การ์ดตัวเลือกพร้อมคำอธิบาย
 *          หรือ [ผู้ดูแลระบบ          🔒]                  ← แก้บัญชีตัวเอง: บทบาทล็อก
 *
 * ช่องรหัสผ่านชั่วคราวไม่อยู่ที่นี่ — มีเฉพาะหน้าต่างเพิ่มผู้ใช้ (CreateUserDialog)
 */
import type { RefObject } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Role } from '../../../api/auth'
import { TextField } from '../../../components/ui'
import { FormGroup } from './FormGroup'
import { IdCardIcon, LockIcon, ShieldIcon } from './icons'
import { fieldMessage, type UserFormValues } from './userForm'

/** ตัวเลือกบทบาท เรียงตาม board: ผู้เรียน → ผู้สอน → ผู้ดูแลระบบ */
const ROLE_OPTIONS = [
  { value: 'student', hint: 'userForm.roleStudentHint' },
  { value: 'teacher', hint: 'userForm.roleTeacherHint' },
  { value: 'admin', hint: 'userForm.roleAdminHint' },
] as const

type UserFieldsProps = {
  register: UseFormRegister<UserFormValues>
  errors: FieldErrors<UserFormValues>
  /** แก้บัญชีตัวเอง: บทบาทนี้ล็อกไว้ เปลี่ยนไม่ได้ (การตัดสินใจก้อน 2 "กันล็อกตัวเอง") */
  lockedRole?: Role
  /** ที่เก็บช่อง "ชื่อ" — หน้าต่างโฟกัสช่องนี้เมื่อเปิด */
  firstFieldRef?: RefObject<HTMLInputElement | null>
}

export function UserFields({ register, errors, lockedRole, firstFieldRef }: UserFieldsProps) {
  const { t } = useTranslation()
  // ช่อง "ชื่อ": ส่ง ref ให้ทั้ง React Hook Form และหน้าต่าง (ไว้โฟกัส)
  const firstName = register('first_name', { required: true })
  const firstNameRef = (element: HTMLInputElement | null) => {
    firstName.ref(element)
    if (firstFieldRef) firstFieldRef.current = element
  }

  return (
    <>
      <FormGroup title={t('userForm.groupInfo')} icon={<IdCardIcon />}>
        {/* ชื่อ-นามสกุลคู่กัน (มือถือแคบมากค่อยเรียงลง — เหมือนหน้าข้อมูลส่วนตัว) */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 lg:grid-cols-2">
          <TextField
            label={t('userForm.firstName')}
            autoComplete="off"
            error={fieldMessage(errors, 'first_name')}
            {...firstName}
            ref={firstNameRef}
          />
          <TextField
            label={t('userForm.lastName')}
            autoComplete="off"
            error={fieldMessage(errors, 'last_name')}
            {...register('last_name', { required: true })}
          />
        </div>
        <TextField
          label={t('userForm.email')}
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          error={fieldMessage(errors, 'email')}
          {...register('email', { required: true })}
        />
        <TextField
          label={t('userForm.studentId')}
          autoComplete="off"
          spellCheck={false}
          hint={t('userForm.studentIdHint')}
          error={fieldMessage(errors, 'student_or_staff_id')}
          {...register('student_or_staff_id')}
        />
      </FormGroup>

      {lockedRole ? (
        // บัญชีตัวเอง: แสดงบทบาทในกล่องเทาพร้อมแม่กุญแจ + คำอธิบาย (ตาม board "แก้ไขบัญชีตัวเอง")
        <FormGroup title={t('userForm.groupRole')} icon={<ShieldIcon />}>
          <div className="flex flex-col gap-1.5">
            <span id="locked-role-label" className="text-[15px] font-semibold text-ink max-lg:sr-only">
              {t('userForm.role')}
            </span>
            <div
              aria-labelledby="locked-role-label"
              aria-describedby="locked-role-hint"
              className="flex h-[46px] items-center justify-between rounded-control border border-line bg-canvas px-3.5 text-[15px] font-semibold"
            >
              {t(`roles.${lockedRole}`)}
              <span className="flex text-ink-muted">
                <LockIcon />
              </span>
            </div>
            <p id="locked-role-hint" className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
              {t('userForm.roleLockedHint')}
            </p>
          </div>
        </FormGroup>
      ) : (
        <FormGroup as="fieldset" title={t('userForm.groupRole')} icon={<ShieldIcon />}>
          {/* จอใหญ่: legend เป็นป้าย "บทบาท" ที่มองเห็น ; มือถือ: หัวกล่องบอกแล้ว จึงซ่อนไว้ให้โปรแกรมอ่านหน้าจอ */}
          <legend className="p-0 text-[15px] font-semibold text-ink max-lg:sr-only lg:mb-2">
            {t('userForm.role')}
          </legend>
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={
                  // มือถือ: การ์ดตัวเลือกพร้อมคำอธิบาย ; จอใหญ่: ปุ่มตัวเลือกเตี้ย 44px (ตาม .ropt / .opt ใน canvas)
                  'flex cursor-pointer items-start gap-3 rounded-[10px] border border-line-strong bg-surface px-3.5 py-3 ' +
                  'has-checked:border-brand has-checked:bg-canvas has-checked:shadow-[inset_0_0_0_1px_var(--color-brand)] ' +
                  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ' +
                  'lg:h-11 lg:items-center lg:gap-2 lg:rounded-control lg:py-0 lg:text-[15px] ' +
                  'lg:has-checked:font-semibold lg:has-checked:shadow-none'
                }
              >
                <input
                  type="radio"
                  value={option.value}
                  aria-describedby={`role-hint-${option.value}`}
                  className="m-0 mt-[3px] size-[18px] shrink-0 accent-brand focus:outline-none lg:mt-0 lg:size-[17px]"
                  {...register('role')}
                />
                <span>
                  <span className="block text-[15px] font-semibold lg:font-[inherit]">
                    {t(`roles.${option.value}`)}
                  </span>
                  <span
                    id={`role-hint-${option.value}`}
                    className="block text-[13.5px] leading-[1.5] text-ink-muted lg:hidden"
                  >
                    {t(option.hint)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </FormGroup>
      )}
    </>
  )
}
