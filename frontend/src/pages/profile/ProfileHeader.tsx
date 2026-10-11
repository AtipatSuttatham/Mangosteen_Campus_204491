/**
 * แถบบัตรประจำตัวด้านบนของหน้าข้อมูลส่วนตัว — ตาม board "ข้อมูลส่วนตัว" (จอใหญ่) + "(มือถือ)" ใน canvas
 *
 *   จอใหญ่ (≥ 1024px)                              มือถือ
 *   ┌──────────────────────────────────┐          ┌────────────────────┐
 *   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ 136px    │▓ (สร)📷          ◌ ▓│
 *   │▓         สมใจ รักเรียน        ◌  ▓│          │▓ สมใจ รักเรียน       ▓│
 *   │▓  (สร)   ผู้เรียน  รหัสนักศึกษา…    ▓│          │▓ ผู้เรียน  รหัส…       ▓│
 *   └──(128px)📷────────────────────────┘          └────────────────────┘
 *        └ รูปยื่นลงไปทับการ์ดด้านล่าง
 *
 * ปุ่มกล้อง → เมนู "เลือกรูปใหม่" / "ลบรูป" (มีเมื่อมีรูปแล้ว) + คำแนะนำชนิด/ขนาดไฟล์
 *   - ใช้แป้นพิมพ์ได้: เปิดแล้วโฟกัสตัวแรก, ลูกศรขึ้น/ลง/Home/End เลื่อน, Esc ปิดแล้วโฟกัสกลับปุ่มกล้อง
 *   - คลิกนอกเมนู / กด Tab ออก → ปิด
 * เลือกรูป → ตรวจชนิด/ขนาดในหน้าเว็บก่อน → อัปโหลด (ระหว่างนั้นรูปจางลง กดซ้ำไม่ได้) → รูปเปลี่ยนทั่วหน้าจอ
 * ลบรูป → ลบทันที ไม่ถามยืนยัน (ผู้ใช้เลือกแบบ ก ขั้น 1.8 — อัปโหลดใหม่ได้ทุกเมื่อ)
 * error ของรูปส่งให้หน้าหลัก (onAvatarError) แสดงในการ์ดด้านล่าง
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { deleteAvatar, uploadAvatar } from '../../api/auth'
import { ApiError } from '../../api/client'
import { errorMessage } from '../../api/errors'
import { useAuth } from '../../auth/AuthContext'
import { CalyxPattern } from '../../components/brand/CalyxPattern'
import { Avatar } from '../../components/ui'
import { AVATAR_ACCEPT, checkAvatarFile } from './avatarFile'
import { CameraIcon, TrashIcon, UploadIcon } from './icons'

/** focus ring สีเขียว (เหมือนปุ่มทั้งระบบ) */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

type ProfileHeaderProps = {
  /** แจ้งข้อความ error ของรูป (undefined = ล้างข้อความเดิม) */
  onAvatarError: (message: string | undefined) => void
}

export function ProfileHeader({ onAvatarError }: ProfileHeaderProps) {
  const { t } = useTranslation()
  const { user, updateUser } = useAuth()
  const menuId = useId()
  // เมนูของปุ่มกล้องเปิดอยู่ไหม
  const [menuOpen, setMenuOpen] = useState(false)
  // กำลังอัปโหลด/ลบรูปอยู่ (กดซ้ำไม่ได้)
  const [busy, setBusy] = useState(false)
  // ข้อความสำหรับโปรแกรมอ่านหน้าจอ (หน้าจอเห็นรูปเปลี่ยนเอง)
  const [announcement, setAnnouncement] = useState('')
  const blockRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // เปิดเมนูแล้วโฟกัสรายการแรก ; คลิกนอกเมนูแล้วปิด
  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!blockRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [menuOpen])

  if (!user) return null

  /** ปิดเมนูแล้วคืนโฟกัสให้ปุ่มกล้อง */
  function closeMenu() {
    setMenuOpen(false)
    cameraRef.current?.focus()
  }

  /** แป้นพิมพ์ในเมนู: ลูกศร/Home/End เลื่อนรายการ, Esc ปิด, Tab ออกจากเมนู = ปิด */
  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const moveTo = (next: number) => {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowDown') moveTo(index + 1)
    else if (event.key === 'ArrowUp') moveTo(index - 1)
    else if (event.key === 'Home') moveTo(0)
    else if (event.key === 'End') moveTo(items.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
    } else if (event.key === 'Tab') setMenuOpen(false)
  }

  /** "เลือกรูปใหม่" → เปิดหน้าต่างเลือกไฟล์ของเครื่อง */
  function chooseFile() {
    closeMenu()
    fileRef.current?.click()
  }

  /** ทำงานกับรูป (อัปโหลด/ลบ) พร้อมสถานะ "กำลังทำ" และข้อความ error */
  async function run(action: () => Promise<void>) {
    onAvatarError(undefined)
    setBusy(true)
    try {
      await action()
    } catch (caught) {
      setAnnouncement('')
      // แสดงข้อความจากรหัส error เท่านั้น — ห้ามแสดง detail ของ backend
      onAvatarError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  /** ผู้ใช้เลือกไฟล์แล้ว → ตรวจในหน้าเว็บ → อัปโหลด */
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // ล้างค่า → เลือกไฟล์เดิมซ้ำได้อีก (เช่น หลังแก้ไฟล์แล้วเลือกใหม่)
    event.target.value = ''
    if (!file) return
    const problem = checkAvatarFile(file)
    if (problem) {
      onAvatarError(errorMessage(problem))
      return
    }
    await run(async () => {
      setAnnouncement(t('profile.avatarUploading'))
      updateUser(await uploadAvatar(file))
      setAnnouncement(t('profile.avatarUpdated'))
    })
  }

  /** "ลบรูป" → ลบทันที (ไม่ถามยืนยัน — การตัดสินใจขั้น 1.8) */
  async function removeAvatar() {
    closeMenu()
    await run(async () => {
      updateUser(await deleteAvatar())
      setAnnouncement(t('profile.avatarRemoved'))
    })
  }

  const idLabel = user.student_or_staff_id
    ? t(user.role === 'student' ? 'account.studentId' : 'account.staffId', {
        id: user.student_or_staff_id,
      })
    : null

  return (
    <div className="relative flex flex-col gap-3.5 rounded-t-card bg-brand px-5 pt-[22px] pb-5 lg:block lg:h-[136px] lg:p-0">
      {/* ลายกลีบเลี้ยงสีเขียวเส้นบาง (ตัดขอบตามมุมโค้งของแถบ — รูปประจำตัวยื่นออกนอกแถบได้) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-card"
      >
        <CalyxPattern
          size={300}
          strokeWidth={0.35}
          className="absolute -top-[120px] -right-[110px] text-accent opacity-[0.24] lg:hidden"
        />
        <CalyxPattern
          size={420}
          strokeWidth={0.35}
          className="absolute -top-[150px] -right-[90px] hidden text-accent opacity-[0.24] lg:block"
        />
      </div>

      {/* รูปประจำตัว + ปุ่มกล้อง + เมนู : มือถือ 88px อยู่ในแถบ / จอใหญ่ 128px ยื่นลงไปทับการ์ด */}
      <div
        ref={blockRef}
        className="relative size-[88px] shrink-0 lg:absolute lg:top-16 lg:left-11 lg:z-10 lg:size-32"
      >
        <div aria-busy={busy} className={busy ? 'opacity-60' : undefined}>
          {/* วาด 2 ขนาด แล้วซ่อนตามจอ (ตัวรูปเป็นการตกแต่ง aria-hidden — อ่านซ้ำไม่ได้) */}
          <div className="lg:hidden">
            <Avatar user={user} size={88} variant="ring" />
          </div>
          <div className="hidden lg:block">
            <Avatar user={user} size={128} variant="ring" />
          </div>
        </div>

        <button
          ref={cameraRef}
          type="button"
          aria-label={t('profile.avatarButton')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          disabled={busy}
          onClick={() => setMenuOpen((open) => !open)}
          className={
            'absolute right-[-2px] bottom-0.5 flex size-9 cursor-pointer items-center justify-center rounded-full ' +
            'border border-line-strong bg-surface p-0 text-brand disabled:cursor-wait lg:size-10 ' +
            FOCUS
          }
        >
          <CameraIcon />
        </button>

        {menuOpen && (
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label={t('profile.avatarMenu')}
            onKeyDown={handleMenuKeyDown}
            className={
              'absolute top-[calc(100%+8px)] left-0 z-20 flex w-[250px] flex-col rounded-card border border-line ' +
              'bg-surface p-1.5 shadow-[0_8px_24px_rgba(63,22,54,0.14)] lg:left-[106px]'
            }
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={chooseFile}
              className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2 text-left text-[14.5px] font-semibold text-brand ${FOCUS}`}
            >
              <UploadIcon />
              {t('profile.chooseAvatar')}
            </button>
            {/* ลบรูป: มีเฉพาะเมื่อมีรูปอยู่แล้ว */}
            {user.avatar_url && (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => void removeAvatar()}
                className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2 text-left text-[14.5px] font-semibold text-bad ${FOCUS}`}
              >
                <TrashIcon />
                {t('profile.removeAvatar')}
              </button>
            )}
            <p className="m-0 mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[13px] text-ink-muted">
              {t('profile.avatarHint')}
            </p>
          </div>
        )}

        {/* ช่องเลือกไฟล์ของเครื่อง (ซ่อน — เปิดผ่านเมนู "เลือกรูปใหม่") */}
        <input
          ref={fileRef}
          type="file"
          accept={AVATAR_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          data-testid="avatar-file-input"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      {/* ชื่อ + บทบาท + รหัส */}
      <div className="relative min-w-0 lg:absolute lg:right-8 lg:bottom-[22px] lg:left-[196px]">
        <p className="m-0 font-display text-2xl leading-[1.3] font-semibold text-white lg:text-[30px]">
          {user.first_name} {user.last_name}
        </p>
        <p className="m-0 flex flex-wrap gap-x-[18px] gap-y-1 text-[14.5px] text-on-brand-muted">
          <span>{t(`roles.${user.role}`)}</span>
          {idLabel && <span>{idLabel}</span>}
        </p>
      </div>

      {/* ข้อความสำหรับโปรแกรมอ่านหน้าจอ: กำลังอัปโหลด / เปลี่ยนรูปแล้ว / ลบรูปแล้ว */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
