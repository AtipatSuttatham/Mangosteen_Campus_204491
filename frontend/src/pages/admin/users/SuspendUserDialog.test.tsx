/**
 * test ของปุ่ม "ระงับ" (ยืนยันก่อน) / "เปิดใช้งาน" (ทำทันที) และแถบข้อความหลังทำรายการ (ขั้น 2.6)
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
  suspendAdminUser: vi.fn(),
  activateAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
}))
const fetchAdminUsers = vi.mocked(adminUsersApi.fetchAdminUsers)
const suspendAdminUser = vi.mocked(adminUsersApi.suspendAdminUser)
const activateAdminUser = vi.mocked(adminUsersApi.activateAdminUser)
const updateAdminUser = vi.mocked(adminUsersApi.updateAdminUser)

/** บัญชีสมมติ: ใช้งานได้ / ถูกระงับ / ตัวเอง */
const ACTIVE = makeUser(7, { first_name: 'กันต์พงษ์', last_name: 'วิไลรัตน์' })
const SUSPENDED = makeUser(8, { first_name: 'วิชัย', last_name: 'ทองมา', is_active: false })
const SELF = makeUser(ADMIN.id, { first_name: ADMIN.first_name, last_name: ADMIN.last_name, role: 'admin' })

beforeEach(() => {
  vi.clearAllMocks()
  fetchAdminUsers.mockResolvedValue(page([ACTIVE, SUSPENDED, SELF]))
})

/** เปิดหน้า /users แล้วรอตาราง */
async function openPage() {
  const rendered = renderUsersPage()
  const table = await screen.findByRole('table')
  return { ...rendered, table }
}

describe('ปุ่มเปลี่ยนสถานะในรายชื่อ', () => {
  it('บัญชีที่ใช้งานได้มี "ระงับ" (สีแดง) ; ที่ถูกระงับมี "เปิดใช้งาน" ; บัญชีตัวเองไม่มีทั้งคู่', async () => {
    const { table } = await openPage()

    const suspend = within(table).getByRole('button', { name: 'ระงับ กันต์พงษ์ วิไลรัตน์' })
    expect(suspend.className).toContain('text-bad')
    expect(within(table).getByRole('button', { name: 'เปิดใช้งาน วิชัย ทองมา' })).toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: /^(ระงับ|เปิดใช้งาน) สุดา/ })).not.toBeInTheDocument()
  })
})

describe('ระงับบัญชี (ยืนยันก่อน)', () => {
  it('กด "ระงับ" → หน้าต่างยืนยันบอกชื่อและผลที่จะเกิด โฟกัส "ยกเลิก" ก่อน ; ยกเลิก = ไม่ระงับ', async () => {
    const { user, table } = await openPage()

    await user.click(within(table).getByRole('button', { name: 'ระงับ กันต์พงษ์ วิไลรัตน์' }))

    const dialog = screen.getByRole('alertdialog', { name: 'ระงับบัญชี กันต์พงษ์ วิไลรัตน์?' })
    expect(dialog).toHaveAccessibleDescription(/ผู้ใช้จะออกจากระบบทันที/)
    expect(within(dialog).getByRole('button', { name: 'ยกเลิก' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(suspendAdminUser).not.toHaveBeenCalled()
  })

  it('ยืนยัน → ระงับ, ปิดหน้าต่าง, แถบเขียว "ระงับบัญชี … แล้ว" และรายชื่อโหลดใหม่', async () => {
    suspendAdminUser.mockResolvedValue({ ...ACTIVE, is_active: false })
    const { user, table } = await openPage()

    await user.click(within(table).getByRole('button', { name: 'ระงับ กันต์พงษ์ วิไลรัตน์' }))
    await user.click(screen.getByRole('button', { name: 'ระงับบัญชี' }))

    expect(await screen.findByRole('status')).toHaveTextContent('ระงับบัญชี กันต์พงษ์ วิไลรัตน์ แล้ว')
    expect(suspendAdminUser).toHaveBeenCalledWith(7)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(fetchAdminUsers).toHaveBeenCalledTimes(2))
  })

  it('ไม่สำเร็จ (last_active_admin) → ข้อความในหน้าต่าง หน้าต่างยังเปิดอยู่', async () => {
    suspendAdminUser.mockRejectedValue(new ApiError(409, 'last_active_admin'))
    const { user, table } = await openPage()

    await user.click(within(table).getByRole('button', { name: 'ระงับ กันต์พงษ์ วิไลรัตน์' }))
    await user.click(screen.getByRole('button', { name: 'ระงับบัญชี' }))

    const dialog = screen.getByRole('alertdialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'ระบบต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน',
    )
    expect(within(dialog).getByRole('button', { name: 'ระงับบัญชี' })).toBeEnabled()
  })
})

describe('เปิดใช้งาน (ทำทันที)', () => {
  it('กด "เปิดใช้งาน" → เรียก backend ทันทีโดยไม่ถาม แล้วแถบเขียว "เปิดใช้งานบัญชี … แล้ว"', async () => {
    activateAdminUser.mockResolvedValue({ ...SUSPENDED, is_active: true })
    const { user, table } = await openPage()

    await user.click(within(table).getByRole('button', { name: 'เปิดใช้งาน วิชัย ทองมา' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('เปิดใช้งานบัญชี วิชัย ทองมา แล้ว')
    expect(activateAdminUser).toHaveBeenCalledWith(8)
  })

  it('ไม่สำเร็จ → แถบแดงบอกสาเหตุเป็นภาษาไทย', async () => {
    activateAdminUser.mockRejectedValue(new ApiError(0, 'network_error'))
    const { user, table } = await openPage()

    await user.click(within(table).getByRole('button', { name: 'เปิดใช้งาน วิชัย ทองมา' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /เปิดใช้งานบัญชี วิชัย ทองมา ไม่สำเร็จ: ติดต่อเซิร์ฟเวอร์ไม่ได้/,
    )
  })
})

describe('แถบข้อความหลังแก้ไข', () => {
  it('บันทึกการแก้ไขสำเร็จ → แถบเขียว "บันทึกข้อมูลของ … แล้ว"', async () => {
    updateAdminUser.mockResolvedValue({ ...ACTIVE, last_name: 'วิไล' })
    const { user, table } = await openPage()

    await user.click(within(table).getByRole('button', { name: 'แก้ไข กันต์พงษ์ วิไลรัตน์' }))
    await user.clear(screen.getByLabelText('นามสกุล'))
    await user.type(screen.getByLabelText('นามสกุล'), 'วิไล')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(await screen.findByRole('status')).toHaveTextContent('บันทึกข้อมูลของ กันต์พงษ์ วิไล แล้ว')
  })
})
