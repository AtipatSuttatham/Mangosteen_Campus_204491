/**
 * test ของปุ่ม "รีเซ็ตรหัสผ่าน" ในรายชื่อ และหน้าต่างรีเซ็ตรหัสผ่าน + หน้า "รีเซ็ตรหัสผ่านแล้ว" (ขั้น 2.6)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง)
 */
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as adminUsersApi from '../../../api/adminUsers'
import { ApiError } from '../../../api/client'
import { ADMIN, makeUser, page, renderUsersPage } from './testUtils'

vi.mock('../../../api/adminUsers', async (importOriginal) => ({
  ...(await importOriginal<typeof adminUsersApi>()),
  fetchAdminUsers: vi.fn(),
  resetAdminUserPassword: vi.fn(),
}))
const fetchAdminUsers = vi.mocked(adminUsersApi.fetchAdminUsers)
const resetAdminUserPassword = vi.mocked(adminUsersApi.resetAdminUserPassword)

/** ผู้เรียนสมมติในรายชื่อ */
const STUDENT = makeUser(7, {
  first_name: 'กันต์พงษ์',
  last_name: 'วิไลรัตน์',
  email: 's660510221@example.com',
  student_or_staff_id: '660510221',
})
/** แถวของผู้ดูแลระบบที่เข้าสู่ระบบอยู่ */
const SELF = makeUser(ADMIN.id, { first_name: ADMIN.first_name, last_name: ADMIN.last_name, role: 'admin' })

beforeEach(() => {
  fetchAdminUsers.mockReset()
  resetAdminUserPassword.mockReset()
  fetchAdminUsers.mockResolvedValue(page([STUDENT, SELF]))
})

/** เปิดหน้า /users แล้วกด "รีเซ็ตรหัสผ่าน" ของผู้เรียนสมมติ */
async function openReset() {
  const rendered = renderUsersPage()
  const table = await screen.findByRole('table')
  await rendered.user.click(
    within(table).getByRole('button', { name: 'รีเซ็ตรหัสผ่าน กันต์พงษ์ วิไลรัตน์' }),
  )
  return { ...rendered, dialog: screen.getByRole('dialog', { name: 'รีเซ็ตรหัสผ่าน' }) }
}

const passwordInput = () => screen.getByLabelText<HTMLInputElement>('รหัสผ่านชั่วคราวใหม่')

describe('ปุ่ม "รีเซ็ตรหัสผ่าน" ในรายชื่อ', () => {
  it('มีในแถวของคนอื่น แต่ไม่มีในแถวของตัวเอง (ใช้หน้าข้อมูลส่วนตัวแทน)', async () => {
    renderUsersPage()
    const table = await screen.findByRole('table')

    expect(within(table).getByRole('button', { name: 'รีเซ็ตรหัสผ่าน กันต์พงษ์ วิไลรัตน์' })).toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: 'รีเซ็ตรหัสผ่าน สุดา แก้วมณี' })).not.toBeInTheDocument()
  })
})

describe('หน้าต่างรีเซ็ตรหัสผ่าน', () => {
  it('บอกชื่อ (รหัส) + คำเตือนว่าผู้ใช้จะออกจากระบบทุกอุปกรณ์ + มีรหัสสุ่มให้แล้ว (โฟกัสช่องรหัส)', async () => {
    const { dialog } = await openReset()

    expect(within(dialog).getByText('กันต์พงษ์ วิไลรัตน์ (660510221)')).toBeInTheDocument()
    expect(within(dialog).getByText(/ผู้ใช้จะออกจากระบบทุกอุปกรณ์ทันที/)).toBeInTheDocument()
    expect(passwordInput().value).toMatch(/^[a-kmnp-zA-HJ-NP-Z2-9]{12}$/)
    expect(passwordInput()).toHaveFocus()
  })

  it('รีเซ็ตสำเร็จ → หน้า "รีเซ็ตรหัสผ่านแล้ว" พร้อมรหัสใหม่ ; "เสร็จ" ปิดหน้าต่าง', async () => {
    resetAdminUserPassword.mockResolvedValue(undefined)
    const { user } = await openReset()
    const password = passwordInput().value

    await user.click(screen.getByRole('button', { name: 'รีเซ็ตรหัสผ่าน' }))

    const done = await screen.findByRole('dialog', { name: 'รีเซ็ตรหัสผ่านแล้ว' })
    expect(resetAdminUserPassword).toHaveBeenCalledWith(7, password)
    expect(within(done).getByText('กันต์พงษ์ วิไลรัตน์ ออกจากระบบทุกอุปกรณ์แล้ว')).toBeInTheDocument()
    expect(within(done).getByText(password)).toBeInTheDocument()
    expect(within(done).getByRole('button', { name: 'คัดลอกรหัสผ่าน' })).toHaveFocus()

    await user.click(within(done).getByRole('button', { name: 'เสร็จ' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('รหัสไม่ผ่านกฎ (backend ตอบที่ช่อง new_password) → ข้อความใต้ช่องรหัส', async () => {
    resetAdminUserPassword.mockRejectedValue(
      new ApiError(400, 'validation_error', { new_password: ['password_too_common'] }),
    )
    const { user } = await openReset()

    await user.clear(passwordInput())
    await user.type(passwordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: 'รีเซ็ตรหัสผ่าน' }))

    expect(await screen.findByText('รหัสผ่านนี้เดาง่ายเกินไป เลือกรหัสอื่น')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'รีเซ็ตรหัสผ่าน' })).toBeInTheDocument()
  })

  it('ลบรหัสจนว่าง → "กรุณากรอกข้อมูลช่องนี้" และไม่ส่งไป backend', async () => {
    const { user } = await openReset()

    await user.clear(passwordInput())
    await user.click(screen.getByRole('button', { name: 'รีเซ็ตรหัสผ่าน' }))

    expect(await screen.findByText('กรุณากรอกข้อมูลช่องนี้')).toBeInTheDocument()
    expect(resetAdminUserPassword).not.toHaveBeenCalled()
  })
})
