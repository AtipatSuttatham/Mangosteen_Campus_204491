/**
 * test ของหน้าข้อมูลส่วนตัว (ขั้น 1.8): แถบบัตร + เมนูรูป, ฟอร์มข้อมูลทั่วไป, ฟอร์มเปลี่ยนรหัสผ่าน
 * ใช้ "สมอง" ปลอม (AuthContext) และแทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง)
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../../api/auth'
import type { User } from '../../api/auth'
import { ApiError } from '../../api/client'
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext'
import ProfilePage from './ProfilePage'

vi.mock('../../api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof authApi>()),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

/** ผู้ใช้ตัวอย่าง (ข้อมูลสมมติ) */
const STUDENT: User = {
  id: 3,
  email: 'student@example.com',
  student_or_staff_id: '690000001',
  role: 'student',
  first_name: 'สมใจ',
  last_name: 'รักเรียน',
  avatar_url: null,
}

const REQUIRED = 'กรุณากรอกข้อมูลช่องนี้'

/** วาดหน้าข้อมูลส่วนตัวด้วยผู้ใช้ที่กำหนด */
function renderProfile(user: User = STUDENT) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    user,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    acceptSession: vi.fn(),
  }
  render(
    <AuthContext.Provider value={auth}>
      <ProfilePage />
    </AuthContext.Provider>,
  )
  // applyAccept: false → ส่งไฟล์ผิดชนิดเข้าช่องเลือกไฟล์ได้ (จำลองเบราว์เซอร์ที่ไม่กรองให้)
  return { auth, user: userEvent.setup({ applyAccept: false }) }
}

/** ไฟล์รูปสมมติ */
const imageFile = (type = 'image/png', size = 1000, name = 'me.png') =>
  new File([new Uint8Array(size)], name, { type })

beforeEach(() => {
  vi.mocked(authApi.updateProfile).mockReset()
  vi.mocked(authApi.changePassword).mockReset()
  vi.mocked(authApi.uploadAvatar).mockReset()
  vi.mocked(authApi.deleteAvatar).mockReset()
})

// ---------------------------------------------------------------- แถบบัตร + รูปประจำตัว

describe('ProfilePage — แถบบัตรประจำตัว', () => {
  it('แสดงหัวข้อ ชื่อ บทบาท รหัส และตัวอักษรย่อ', () => {
    renderProfile()

    expect(screen.getByRole('heading', { level: 1, name: 'ข้อมูลส่วนตัว' })).toBeInTheDocument()
    expect(screen.getByText('สมใจ รักเรียน')).toBeInTheDocument()
    expect(screen.getByText('ผู้เรียน')).toBeInTheDocument()
    expect(screen.getByText('รหัสนักศึกษา 690000001')).toBeInTheDocument()
    expect(screen.getAllByText('สร').length).toBeGreaterThan(0)
  })

  it('ปุ่มกล้อง → เมนู "เลือกรูปใหม่" + คำแนะนำ ; ยังไม่มีรูป → ไม่มี "ลบรูป" ; โฟกัสรายการแรก', async () => {
    const { user } = renderProfile()

    await user.click(screen.getByRole('button', { name: 'เปลี่ยนหรือลบรูปประจำตัว' }))

    const menu = screen.getByRole('menu', { name: 'รูปประจำตัว' })
    expect(within(menu).getByRole('menuitem', { name: 'เลือกรูปใหม่' })).toHaveFocus()
    expect(within(menu).queryByRole('menuitem', { name: 'ลบรูป' })).not.toBeInTheDocument()
    expect(within(menu).getByText('JPG, PNG หรือ WebP ไม่เกิน 2 MB')).toBeInTheDocument()
  })

  it('มีรูปแล้ว → มี "ลบรูป" ; ลูกศรลงเลื่อนไปรายการถัดไป ; Esc ปิดแล้วโฟกัสกลับปุ่มกล้อง', async () => {
    const { user } = renderProfile({ ...STUDENT, avatar_url: '/media/avatars/a.webp' })
    const camera = screen.getByRole('button', { name: 'เปลี่ยนหรือลบรูปประจำตัว' })
    await user.click(camera)

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'ลบรูป' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(camera).toHaveFocus()
  })

  it('เลือกรูปที่ใช้ได้ → อัปโหลด แล้วใช้ข้อมูลผู้ใช้ชุดใหม่ (รูปเปลี่ยนทั่วหน้าจอ)', async () => {
    const updated = { ...STUDENT, avatar_url: '/media/avatars/new.webp' }
    vi.mocked(authApi.uploadAvatar).mockResolvedValue(updated)
    const { auth, user } = renderProfile()
    const file = imageFile()

    await user.upload(screen.getByTestId('avatar-file-input'), file)

    expect(authApi.uploadAvatar).toHaveBeenCalledWith(file)
    expect(auth.updateUser).toHaveBeenCalledWith(updated)
    expect(await screen.findByText('เปลี่ยนรูปประจำตัวแล้ว')).toBeInTheDocument()
  })

  it.each([
    ['ไฟล์ไม่ใช่รูปที่รับ', imageFile('application/pdf', 1000, 'a.pdf'), 'ใช้ได้เฉพาะไฟล์รูป JPG, PNG หรือ WebP'],
    [
      'ไฟล์ใหญ่เกิน 2 MB',
      imageFile('image/jpeg', 2 * 1024 * 1024 + 1, 'big.jpg'),
      'รูปมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่มีขนาดไม่เกิน 2 MB',
    ],
  ])('%s → ข้อความ error ทันที และไม่อัปโหลด', async (_case, file, message) => {
    const { user } = renderProfile()

    await user.upload(screen.getByTestId('avatar-file-input'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(authApi.uploadAvatar).not.toHaveBeenCalled()
  })

  it('backend ปฏิเสธรูป → ข้อความจากรหัส error', async () => {
    vi.mocked(authApi.uploadAvatar).mockRejectedValue(new ApiError(400, 'avatar_invalid_type'))
    const { auth, user } = renderProfile()

    await user.upload(screen.getByTestId('avatar-file-input'), imageFile('image/jpeg'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ใช้ได้เฉพาะไฟล์รูป JPG, PNG หรือ WebP',
    )
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('"ลบรูป" → ลบทันที (ไม่ถามยืนยัน) แล้วใช้ข้อมูลผู้ใช้ชุดใหม่', async () => {
    vi.mocked(authApi.deleteAvatar).mockResolvedValue(STUDENT)
    const { auth, user } = renderProfile({ ...STUDENT, avatar_url: '/media/avatars/a.webp' })
    await user.click(screen.getByRole('button', { name: 'เปลี่ยนหรือลบรูปประจำตัว' }))

    await user.click(screen.getByRole('menuitem', { name: 'ลบรูป' }))

    expect(authApi.deleteAvatar).toHaveBeenCalledTimes(1)
    expect(auth.updateUser).toHaveBeenCalledWith(STUDENT)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------- ข้อมูลทั่วไป

describe('ProfilePage — ข้อมูลทั่วไป', () => {
  const form = () => screen.getByRole('form', { name: 'ข้อมูลทั่วไป' })

  it('ช่องมีข้อมูลปัจจุบันอยู่แล้ว', () => {
    renderProfile()

    expect(within(form()).getByLabelText('ชื่อ')).toHaveValue('สมใจ')
    expect(within(form()).getByLabelText('นามสกุล')).toHaveValue('รักเรียน')
    expect(within(form()).getByLabelText('อีเมล')).toHaveValue('student@example.com')
  })

  it('ลบชื่อจนว่าง → "กรุณากรอกข้อมูลช่องนี้" และไม่ส่งไป backend', async () => {
    const { user } = renderProfile()

    await user.clear(within(form()).getByLabelText('ชื่อ'))
    await user.click(within(form()).getByRole('button', { name: 'บันทึกข้อมูล' }))

    expect(await within(form()).findByText(REQUIRED)).toBeInTheDocument()
    expect(authApi.updateProfile).not.toHaveBeenCalled()
  })

  it('บันทึกสำเร็จ → ใช้ข้อมูลชุดใหม่ + ป้าย "บันทึกแล้ว" ; พิมพ์แก้ต่อ → ป้ายหายไป', async () => {
    const updated = { ...STUDENT, first_name: 'สมหญิง' }
    vi.mocked(authApi.updateProfile).mockResolvedValue(updated)
    const { auth, user } = renderProfile()
    const firstName = within(form()).getByLabelText('ชื่อ')

    await user.clear(firstName)
    await user.type(firstName, 'สมหญิง')
    await user.click(within(form()).getByRole('button', { name: 'บันทึกข้อมูล' }))

    expect(authApi.updateProfile).toHaveBeenCalledWith({
      first_name: 'สมหญิง',
      last_name: 'รักเรียน',
      email: 'student@example.com',
    })
    expect(auth.updateUser).toHaveBeenCalledWith(updated)
    expect(await within(form()).findByText('บันทึกแล้ว')).toBeInTheDocument()

    await user.type(firstName, 'x')
    expect(within(form()).queryByText('บันทึกแล้ว')).not.toBeInTheDocument()
  })

  it('อีเมลซ้ำ (backend) → ข้อความใต้ช่องอีเมล', async () => {
    vi.mocked(authApi.updateProfile).mockRejectedValue(
      new ApiError(400, 'validation_error', { email: ['unique'] }),
    )
    const { user } = renderProfile()

    await user.click(within(form()).getByRole('button', { name: 'บันทึกข้อมูล' }))

    const email = within(form()).getByLabelText('อีเมล')
    expect(await within(form()).findByText('ข้อมูลนี้มีอยู่แล้วในระบบ')).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
  })

  it('ติดต่อเซิร์ฟเวอร์ไม่ได้ → ข้อความรวมใต้ปุ่ม', async () => {
    vi.mocked(authApi.updateProfile).mockRejectedValue(new ApiError(0, 'network_error'))
    const { user } = renderProfile()

    await user.click(within(form()).getByRole('button', { name: 'บันทึกข้อมูล' }))

    expect(await within(form()).findByRole('alert')).toHaveTextContent(
      'ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ',
    )
  })
})

// ---------------------------------------------------------------- เปลี่ยนรหัสผ่าน

describe('ProfilePage — เปลี่ยนรหัสผ่าน', () => {
  const form = () => screen.getByRole('form', { name: 'เปลี่ยนรหัสผ่าน' })
  const field = (label: string) => within(form()).getByLabelText(label)

  /** กรอก 3 ช่องแล้วกดเปลี่ยนรหัสผ่าน */
  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    current: string,
    next: string,
    confirm: string,
  ) {
    if (current) await user.type(field('รหัสผ่านปัจจุบัน'), current)
    if (next) await user.type(field('รหัสผ่านใหม่'), next)
    if (confirm) await user.type(field('ยืนยันรหัสผ่านใหม่'), confirm)
    await user.click(within(form()).getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }))
  }

  it('แสดงคำเตือนเรื่องอุปกรณ์อื่น และคำแนะนำใต้ช่องรหัสผ่านใหม่', () => {
    renderProfile()

    expect(form()).toHaveAccessibleDescription('เปลี่ยนแล้ว อุปกรณ์อื่นจะออกจากระบบทั้งหมด')
    expect(field('รหัสผ่านใหม่')).toHaveAccessibleDescription(
      'อย่างน้อย 8 ตัว ไม่ใช่ตัวเลขล้วนหรือรหัสที่เดาง่าย',
    )
  })

  it('ไม่กรอก → ข้อความใต้ทั้ง 3 ช่อง และไม่ส่งไป backend', async () => {
    const { user } = renderProfile()

    await fill(user, '', '', '')

    expect(await within(form()).findAllByText(REQUIRED)).toHaveLength(3)
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('ยืนยันรหัสไม่ตรง → "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" และไม่ส่งไป backend', async () => {
    const { user } = renderProfile()

    await fill(user, 'old-pass', 'new-pass-123', 'new-pass-999')

    expect(await within(form()).findByText('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน')).toBeInTheDocument()
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('สำเร็จ → ใช้บัตรชุดใหม่ + ล้างทุกช่อง + ป้าย "เปลี่ยนรหัสผ่านแล้ว"', async () => {
    const result = { access: 'new-access', user: STUDENT }
    vi.mocked(authApi.changePassword).mockResolvedValue(result)
    const { auth, user } = renderProfile()

    await fill(user, 'old-pass', ' new pass 123 ', ' new pass 123 ')

    // รหัสผ่านไม่ตัดช่องว่าง (เหมือนตอนเข้าสู่ระบบ)
    expect(authApi.changePassword).toHaveBeenCalledWith('old-pass', ' new pass 123 ')
    expect(auth.acceptSession).toHaveBeenCalledWith(result)
    expect(await within(form()).findByText('เปลี่ยนรหัสผ่านแล้ว')).toBeInTheDocument()
    expect(field('รหัสผ่านปัจจุบัน')).toHaveValue('')
    expect(field('รหัสผ่านใหม่')).toHaveValue('')
    expect(field('ยืนยันรหัสผ่านใหม่')).toHaveValue('')
  })

  it('backend ปฏิเสธ → รหัสเดิมผิด + รหัสใหม่ไม่ผ่านหลายกฎ แสดงใต้ช่องที่ถูกต้อง', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(
      new ApiError(400, 'validation_error', {
        current_password: ['password_incorrect'],
        new_password: ['password_too_common', 'password_entirely_numeric'],
      }),
    )
    const { auth, user } = renderProfile()

    await fill(user, 'wrong', '12345678', '12345678')

    expect(await within(form()).findByText('รหัสผ่านปัจจุบันไม่ถูกต้อง')).toBeInTheDocument()
    // ข้อความแทนที่คำแนะนำ และบอกทุกกฎที่ไม่ผ่าน
    expect(field('รหัสผ่านใหม่')).toHaveAccessibleDescription(
      'รหัสผ่านนี้เดาง่ายเกินไป เลือกรหัสอื่น รหัสผ่านต้องไม่เป็นตัวเลขล้วน',
    )
    expect(auth.acceptSession).not.toHaveBeenCalled()
  })
})
