/**
 * test ของหน้าต่าง "เพิ่มผู้ใช้" และหน้า "สร้างบัญชีแล้ว" (ขั้น 2.6)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง)
 */
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as adminUsersApi from '../../../api/adminUsers'
import { ApiError } from '../../../api/client'
import { makeUser, page, renderUsersPage } from './testUtils'

vi.mock('../../../api/adminUsers', async (importOriginal) => ({
  ...(await importOriginal<typeof adminUsersApi>()),
  fetchAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
}))
const fetchAdminUsers = vi.mocked(adminUsersApi.fetchAdminUsers)
const createAdminUser = vi.mocked(adminUsersApi.createAdminUser)

/** บัญชีที่ backend ตอบกลับหลังสร้าง (ข้อมูลสมมติ) */
const CREATED = makeUser(50, {
  first_name: 'ธนพล',
  last_name: 'ใจดี',
  email: 's670510118@example.com',
  student_or_staff_id: '670510118',
})

beforeEach(() => {
  fetchAdminUsers.mockReset()
  createAdminUser.mockReset()
  fetchAdminUsers.mockResolvedValue(page([makeUser(2)]))
})

/** เปิดหน้า /users แล้วกด "เพิ่มผู้ใช้" — คืนหน้าต่างที่เปิด */
async function openCreateDialog() {
  const rendered = renderUsersPage()
  await screen.findByRole('table')
  await rendered.user.click(screen.getByRole('button', { name: 'เพิ่มผู้ใช้' }))
  return { ...rendered, dialog: screen.getByRole('dialog', { name: 'เพิ่มผู้ใช้' }) }
}

/** กรอกช่องบังคับของฟอร์ม */
async function fillForm(user: Awaited<ReturnType<typeof openCreateDialog>>['user']) {
  await user.type(screen.getByLabelText('ชื่อ'), 'ธนพล')
  await user.type(screen.getByLabelText('นามสกุล'), 'ใจดี')
  await user.type(screen.getByLabelText('อีเมล'), 's670510118@example.com')
  await user.type(screen.getByLabelText('รหัสนักศึกษา/พนักงาน'), '670510118')
}

const passwordInput = () => screen.getByLabelText<HTMLInputElement>('รหัสผ่านชั่วคราว')

describe('หน้าต่างเพิ่มผู้ใช้ — ฟอร์ม', () => {
  it('ปุ่ม "เพิ่มผู้ใช้" เปิดหน้าต่าง: โฟกัสช่องชื่อ, บทบาทเริ่มที่ผู้เรียน, มีรหัสสุ่ม 12 ตัวที่มองเห็นได้', async () => {
    const { dialog } = await openCreateDialog()

    expect(within(dialog).getByLabelText('ชื่อ')).toHaveFocus()
    expect(within(dialog).getByRole('radio', { name: /ผู้เรียน/ })).toBeChecked()
    expect(passwordInput().value).toMatch(/^[a-kmnp-zA-HJ-NP-Z2-9]{12}$/)
    expect(passwordInput()).toHaveAttribute('type', 'text')
  })

  it('"สุ่มรหัส" เปลี่ยนรหัสในช่อง', async () => {
    const { user } = await openCreateDialog()
    const before = passwordInput().value

    await user.click(screen.getByRole('button', { name: 'สุ่มรหัส' }))

    expect(passwordInput().value).not.toBe(before)
    expect(passwordInput().value).toHaveLength(12)
  })

  it('"คัดลอก" คัดลอกรหัสในช่อง แล้วปุ่มเปลี่ยนเป็น "คัดลอกแล้ว"', async () => {
    const { user } = await openCreateDialog()

    await user.click(screen.getByRole('button', { name: 'คัดลอก' }))

    await expect(navigator.clipboard.readText()).resolves.toBe(passwordInput().value)
    expect(screen.getByRole('button', { name: 'คัดลอกแล้ว' })).toBeInTheDocument()
  })

  it('ช่องบังคับว่าง → "กรุณากรอกข้อมูลช่องนี้" และไม่ส่งไป backend', async () => {
    const { user } = await openCreateDialog()

    await user.click(screen.getByRole('button', { name: 'สร้างบัญชี' }))

    expect(await screen.findAllByText('กรุณากรอกข้อมูลช่องนี้')).toHaveLength(3)
    expect(createAdminUser).not.toHaveBeenCalled()
  })

  it('backend ปฏิเสธรายช่อง → ข้อความใต้ช่องนั้น (อีเมลซ้ำ / รหัสผ่านไม่ผ่านกฎ)', async () => {
    createAdminUser.mockRejectedValue(
      new ApiError(400, 'validation_error', {
        email: ['unique'],
        password: ['password_too_similar'],
      }),
    )
    const { user } = await openCreateDialog()
    await fillForm(user)

    await user.click(screen.getByRole('button', { name: 'สร้างบัญชี' }))

    expect(await screen.findByText('ข้อมูลนี้มีอยู่แล้วในระบบ')).toBeInTheDocument()
    expect(screen.getByText('รหัสผ่านคล้ายกับชื่อหรืออีเมลมากเกินไป')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'เพิ่มผู้ใช้' })).toBeInTheDocument()
  })

  it('ติดต่อเซิร์ฟเวอร์ไม่ได้ → ข้อความรวมเหนือปุ่ม', async () => {
    createAdminUser.mockRejectedValue(new ApiError(0, 'network_error'))
    const { user } = await openCreateDialog()
    await fillForm(user)

    await user.click(screen.getByRole('button', { name: 'สร้างบัญชี' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ติดต่อเซิร์ฟเวอร์ไม่ได้')
  })

  it('"ยกเลิก" ปิดหน้าต่างโดยไม่บันทึก', async () => {
    const { user } = await openCreateDialog()

    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(createAdminUser).not.toHaveBeenCalled()
  })
})

describe('หน้าต่างเพิ่มผู้ใช้ — สร้างบัญชีแล้ว (ข้อ 1.ข)', () => {
  /** กรอกฟอร์ม เลือกผู้สอน แล้วกดสร้างจนเห็นหน้า "สร้างบัญชีแล้ว" — คืนรหัสที่ตั้งไว้ */
  async function createAccount() {
    createAdminUser.mockResolvedValue(CREATED)
    const opened = await openCreateDialog()
    await fillForm(opened.user)
    await opened.user.click(screen.getByRole('radio', { name: /ผู้สอน/ }))
    const password = passwordInput().value
    await opened.user.click(screen.getByRole('button', { name: 'สร้างบัญชี' }))
    const dialog = await screen.findByRole('dialog', { name: 'สร้างบัญชีแล้ว' })
    return { ...opened, dialog, password }
  }

  it('ส่งข้อมูลที่กรอกไป backend แล้วแสดงข้อมูลเข้าสู่ระบบ + รหัสที่ตั้ง (โฟกัสปุ่มคัดลอก)', async () => {
    const { dialog, password } = await createAccount()

    expect(createAdminUser).toHaveBeenCalledWith({
      first_name: 'ธนพล',
      last_name: 'ใจดี',
      email: 's670510118@example.com',
      student_or_staff_id: '670510118',
      role: 'teacher',
      password,
    })
    expect(within(dialog).getByText('s670510118@example.com')).toBeInTheDocument()
    expect(within(dialog).getByText('หรือรหัส 670510118')).toBeInTheDocument()
    expect(within(dialog).getByText(password)).toBeInTheDocument()
    expect(within(dialog).getByText('ปิดหน้าต่างนี้แล้วจะดูรหัสนี้อีกไม่ได้')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'คัดลอกรหัสผ่าน' })).toHaveFocus()
  })

  it('รายชื่อด้านหลังโหลดใหม่หลังสร้างสำเร็จ', async () => {
    await createAccount()

    await waitFor(() => expect(fetchAdminUsers).toHaveBeenCalledTimes(2))
  })

  it('"คัดลอกรหัสผ่าน" คัดลอกรหัสที่ตั้งไว้', async () => {
    const { user, password } = await createAccount()

    await user.click(screen.getByRole('button', { name: 'คัดลอกรหัสผ่าน' }))

    await expect(navigator.clipboard.readText()).resolves.toBe(password)
  })

  it('"เพิ่มอีกคน" → ฟอร์มเปล่า + รหัสสุ่มใหม่ และโฟกัสช่องชื่อ', async () => {
    const { user, password } = await createAccount()

    await user.click(screen.getByRole('button', { name: 'เพิ่มอีกคน' }))

    expect(screen.getByRole('dialog', { name: 'เพิ่มผู้ใช้' })).toBeInTheDocument()
    expect(screen.getByLabelText('ชื่อ')).toHaveValue('')
    expect(screen.getByLabelText('ชื่อ')).toHaveFocus()
    expect(screen.getByRole('radio', { name: /ผู้เรียน/ })).toBeChecked()
    expect(passwordInput().value).not.toBe(password)
  })

  it('"เสร็จ" ปิดหน้าต่าง', async () => {
    const { user } = await createAccount()

    await user.click(screen.getByRole('button', { name: 'เสร็จ' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
