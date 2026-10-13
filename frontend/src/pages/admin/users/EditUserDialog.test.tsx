/**
 * test ของปุ่ม "แก้ไข" ในรายชื่อ และหน้าต่าง "แก้ไขข้อมูลผู้ใช้" (ขั้น 2.6)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง)
 */
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as adminUsersApi from '../../../api/adminUsers'
import { ApiError } from '../../../api/client'
import { ADMIN, makeUser, page, renderUsersPage } from './testUtils'

vi.mock('../../../api/adminUsers', async (importOriginal) => ({
  ...(await importOriginal<typeof adminUsersApi>()),
  fetchAdminUsers: vi.fn(),
  updateAdminUser: vi.fn(),
}))
const fetchAdminUsers = vi.mocked(adminUsersApi.fetchAdminUsers)
const updateAdminUser = vi.mocked(adminUsersApi.updateAdminUser)

/** ผู้เรียนสมมติในรายชื่อ */
const STUDENT = makeUser(7, {
  first_name: 'กันต์พงษ์',
  last_name: 'วิไลรัตน์',
  email: 's660510221@example.com',
  student_or_staff_id: '660510221',
})
/** แถวของผู้ดูแลระบบที่เข้าสู่ระบบอยู่ */
const SELF = makeUser(ADMIN.id, {
  first_name: ADMIN.first_name,
  last_name: ADMIN.last_name,
  email: ADMIN.email,
  student_or_staff_id: ADMIN.student_or_staff_id,
  role: 'admin',
})

beforeEach(() => {
  fetchAdminUsers.mockReset()
  updateAdminUser.mockReset()
  fetchAdminUsers.mockResolvedValue(page([STUDENT, SELF]))
})

/** เปิดหน้า /users แล้วกด "แก้ไข" ของบัญชีที่ระบุ (ปุ่มในตาราง) */
async function openEdit(name: string) {
  const rendered = renderUsersPage()
  const table = await screen.findByRole('table')
  await rendered.user.click(within(table).getByRole('button', { name: `แก้ไข ${name}` }))
  return { ...rendered, dialog: screen.getByRole('dialog', { name: 'แก้ไขข้อมูลผู้ใช้' }) }
}

describe('ปุ่ม "แก้ไข" ในรายชื่อ', () => {
  it('ทุกแถวและทุกการ์ดมีปุ่ม "แก้ไข" ที่บอกชื่อผู้ใช้ให้โปรแกรมอ่านหน้าจอ', async () => {
    renderUsersPage()
    const table = await screen.findByRole('table')
    const cards = screen.getByRole('list', { name: 'รายชื่อผู้ใช้' })

    for (const scope of [table, cards]) {
      expect(within(scope).getByRole('button', { name: 'แก้ไข กันต์พงษ์ วิไลรัตน์' })).toBeInTheDocument()
      expect(within(scope).getByRole('button', { name: 'แก้ไข สุดา แก้วมณี' })).toBeInTheDocument()
    }
  })
})

describe('หน้าต่างแก้ไขข้อมูลผู้ใช้', () => {
  it('มีข้อมูลเดิมในช่อง, บรรทัดรองเป็นชื่อ (รหัส), โฟกัสช่องชื่อ และปุ่มบันทึกกดไม่ได้จนกว่าจะแก้', async () => {
    const { dialog } = await openEdit('กันต์พงษ์ วิไลรัตน์')

    expect(within(dialog).getByText('กันต์พงษ์ วิไลรัตน์ (660510221)')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('ชื่อ')).toHaveValue('กันต์พงษ์')
    expect(within(dialog).getByLabelText('ชื่อ')).toHaveFocus()
    expect(within(dialog).getByLabelText('อีเมล')).toHaveValue('s660510221@example.com')
    expect(within(dialog).getByRole('radio', { name: /ผู้เรียน/ })).toBeChecked()
    expect(within(dialog).queryByLabelText('รหัสผ่านชั่วคราว')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'บันทึก' })).toBeDisabled()
  })

  it('ส่งเฉพาะช่องที่เปลี่ยน แล้วปิดหน้าต่าง + โหลดรายชื่อใหม่', async () => {
    updateAdminUser.mockResolvedValue({ ...STUDENT, first_name: 'กันต์', role: 'teacher' })
    const { user, dialog } = await openEdit('กันต์พงษ์ วิไลรัตน์')

    await user.clear(within(dialog).getByLabelText('ชื่อ'))
    await user.type(within(dialog).getByLabelText('ชื่อ'), 'กันต์')
    await user.click(within(dialog).getByRole('radio', { name: /ผู้สอน/ }))
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateAdminUser).toHaveBeenCalledWith(7, { first_name: 'กันต์', role: 'teacher' })
    await waitFor(() => expect(fetchAdminUsers).toHaveBeenCalledTimes(2))
  })

  it('แก้แค่ช่องว่างหัวท้าย = ไม่มีอะไรเปลี่ยนจริง → ปิดหน้าต่างโดยไม่เรียก backend', async () => {
    const { user, dialog } = await openEdit('กันต์พงษ์ วิไลรัตน์')

    await user.type(within(dialog).getByLabelText('นามสกุล'), '  ')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(updateAdminUser).not.toHaveBeenCalled()
  })

  it('backend ปฏิเสธ (อีเมลซ้ำ) → ข้อความใต้ช่อง ; หน้าต่างยังเปิดอยู่', async () => {
    updateAdminUser.mockRejectedValue(new ApiError(400, 'validation_error', { email: ['unique'] }))
    const { user, dialog } = await openEdit('กันต์พงษ์ วิไลรัตน์')

    await user.clear(within(dialog).getByLabelText('อีเมล'))
    await user.type(within(dialog).getByLabelText('อีเมล'), 'admin@example.com')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))

    expect(await within(dialog).findByText('ข้อมูลนี้มีอยู่แล้วในระบบ')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('ลดบทบาทผู้ดูแลระบบคนสุดท้าย (last_active_admin) → ข้อความรวมเหนือปุ่ม', async () => {
    fetchAdminUsers.mockResolvedValue(page([makeUser(9, { role: 'admin', first_name: 'อรุณี', last_name: 'ผู้ดูแล' }), SELF]))
    updateAdminUser.mockRejectedValue(new ApiError(409, 'last_active_admin'))
    const { user, dialog } = await openEdit('อรุณี ผู้ดูแล')

    await user.click(within(dialog).getByRole('radio', { name: /ผู้สอน/ }))
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/ผู้ดูแลระบบ/)
  })
})

describe('หน้าต่างแก้ไข — บัญชีตัวเอง (บทบาทล็อก)', () => {
  it('บรรทัดรอง "(บัญชีของคุณ)", ไม่มีตัวเลือกบทบาท แต่มีบทบาทที่ล็อกพร้อมคำอธิบาย', async () => {
    const { dialog } = await openEdit('สุดา แก้วมณี')

    expect(within(dialog).getByText('สุดา แก้วมณี (บัญชีของคุณ)')).toBeInTheDocument()
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(dialog).getByText('ผู้ดูแลระบบ')).toBeInTheDocument()
    expect(
      within(dialog).getByText('บทบาทของบัญชีตัวเองเปลี่ยนไม่ได้ ให้ผู้ดูแลระบบคนอื่นเปลี่ยนให้'),
    ).toBeInTheDocument()
  })

  it('บันทึกชื่อตัวเอง → ไม่ส่งบทบาท และชื่อทั่วหน้าจอเปลี่ยนตาม (updateUser)', async () => {
    updateAdminUser.mockResolvedValue({ ...SELF, first_name: 'สุดารัตน์' })
    const { user, dialog, updateUser } = await openEdit('สุดา แก้วมณี')

    await user.clear(within(dialog).getByLabelText('ชื่อ'))
    await user.type(within(dialog).getByLabelText('ชื่อ'), 'สุดารัตน์')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledOnce())
    expect(updateAdminUser).toHaveBeenCalledWith(ADMIN.id, { first_name: 'สุดารัตน์' })
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'สุดารัตน์', role: 'admin' }))
  })
})
