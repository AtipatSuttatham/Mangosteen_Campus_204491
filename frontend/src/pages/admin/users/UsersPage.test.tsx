/**
 * test ของหน้าจัดการบัญชีผู้ใช้ /users (ขั้น 2.5): รายชื่อ, ป้าย "คุณ", ค้นหา/กรอง (เก็บในที่อยู่),
 * แบ่งหน้า, กำลังโหลด / ไม่พบ / ผิดพลาด
 * ใช้ "สมอง" ปลอม (AuthContext) และแทนที่ fetchAdminUsers ด้วยตัวปลอม (ไม่เรียก backend จริง)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as adminUsersApi from '../../../api/adminUsers'
import type { AdminUser, Paginated } from '../../../api/adminUsers'
import type { User } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { AuthContext, type AuthContextValue } from '../../../auth/AuthContext'
import UsersPage from './UsersPage'

vi.mock('../../../api/adminUsers', async (importOriginal) => ({
  ...(await importOriginal<typeof adminUsersApi>()),
  fetchAdminUsers: vi.fn(),
}))
const fetchAdminUsers = vi.mocked(adminUsersApi.fetchAdminUsers)

/** ผู้ดูแลระบบที่เข้าสู่ระบบอยู่ (ข้อมูลสมมติ) */
const ADMIN: User = {
  id: 1,
  email: 'admin@example.com',
  student_or_staff_id: 'A0001',
  role: 'admin',
  first_name: 'สุดา',
  last_name: 'แก้วมณี',
  avatar_url: null,
}

/** สร้างบัญชีสมมติ */
function makeUser(id: number, overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    email: `user${id}@example.com`,
    student_or_staff_id: `6900000${id}`,
    role: 'student',
    first_name: `ชื่อ${id}`,
    last_name: `นามสกุล${id}`,
    is_active: true,
    avatar_url: null,
    date_joined: '2026-10-12T03:00:00Z',
    last_login: null,
    ...overrides,
  }
}

/** คำตอบแบบแบ่งหน้า */
function page(results: AdminUser[], count = results.length): Paginated<AdminUser> {
  return { count, next: null, previous: null, results }
}

/** แสดงที่อยู่ปัจจุบัน (ใช้ตรวจว่าตัวกรองถูกเก็บในที่อยู่) */
function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

/** วาดหน้ารายชื่อผู้ใช้ที่ที่อยู่ที่กำหนด */
function renderPage(path = '/users') {
  const auth: AuthContextValue = {
    status: 'authenticated',
    user: ADMIN,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    acceptSession: vi.fn(),
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/users"
              element={
                <>
                  <UsersPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup() }
}

/** ค่าที่ต้องมี (เช่น แถวของตาราง) — ไม่มี = test ล้มทันทีพร้อมข้อความ */
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('ไม่พบสิ่งที่คาดว่าจะมี')
  return value
}

const location = () => screen.getByTestId('location').textContent
const table = () => screen.getByRole('table')
const lastFilters = () => fetchAdminUsers.mock.lastCall?.[0]

beforeEach(() => {
  fetchAdminUsers.mockReset()
})

describe('UsersPage — รายชื่อ', () => {
  it('แสดงหัวข้อ จำนวนทั้งหมด และข้อมูลแต่ละแถวในตาราง', async () => {
    fetchAdminUsers.mockResolvedValue(
      page(
        [
          makeUser(2, { first_name: 'ธนพล', last_name: 'ใจดี', email: 's670510118@example.com' }),
          makeUser(3, { role: 'teacher', student_or_staff_id: 'T1024' }),
        ],
        248,
      ),
    )
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'จัดการบัญชีผู้ใช้' })).toBeInTheDocument()
    const rows = within(await screen.findByRole('table')).getAllByRole('row')
    expect(screen.getByText('ทั้งหมด 248 บัญชี')).toBeInTheDocument()
    // แถวหัวตาราง + 2 แถวข้อมูล
    expect(rows).toHaveLength(3)
    expect(within(must(rows[0])).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'ชื่อและอีเมล',
      'รหัสนักศึกษา/พนักงาน',
      'บทบาท',
      'สถานะ',
      // คอลัมน์ปุ่ม (ขั้น 2.6) — หัวคอลัมน์ซ่อนไว้ให้โปรแกรมอ่านหน้าจอ
      'การดำเนินการ',
    ])
    expect(rows[1]).toHaveTextContent('ธนพล ใจดี')
    expect(rows[1]).toHaveTextContent('s670510118@example.com')
    expect(rows[1]).toHaveTextContent('ผู้เรียน')
    expect(rows[1]).toHaveTextContent('ใช้งานได้')
    expect(rows[2]).toHaveTextContent('T1024')
    expect(rows[2]).toHaveTextContent('ผู้สอน')
    // ปุ่ม "นำเข้าจาก CSV" (ขั้น 2.7) เป็นลิงก์ไปหน้านำเข้า
    expect(screen.getByRole('link', { name: 'นำเข้าจาก CSV' })).toHaveAttribute('href', '/users/import')
  })

  it('ขอหน้าแรกโดยไม่มีตัวกรอง', async () => {
    fetchAdminUsers.mockResolvedValue(page([makeUser(2)]))
    renderPage()

    await screen.findByRole('table')
    expect(lastFilters()).toEqual({ search: '', role: undefined, status: undefined, page: 1 })
  })

  it('บัญชีของตัวเองมีป้าย "คุณ" ; บัญชีที่ถูกระงับมีป้าย "ระงับการใช้งาน"', async () => {
    fetchAdminUsers.mockResolvedValue(
      page([
        makeUser(ADMIN.id, { first_name: 'สุดา', last_name: 'แก้วมณี', role: 'admin' }),
        makeUser(5, { first_name: 'วิชัย', last_name: 'ทองมา', is_active: false }),
      ]),
    )
    renderPage()

    const rows = within(await screen.findByRole('table')).getAllByRole('row')
    expect(within(must(rows[1])).getByText('คุณ')).toBeInTheDocument()
    expect(within(must(rows[2])).queryByText('คุณ')).toBeNull()
    expect(rows[2]).toHaveTextContent('ระงับการใช้งาน')
  })

  it('บัญชีที่ไม่มีรหัส → ขีด และข้อความ "ไม่มีรหัส" สำหรับโปรแกรมอ่านหน้าจอ', async () => {
    fetchAdminUsers.mockResolvedValue(page([makeUser(2, { student_or_staff_id: null })]))
    renderPage()

    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]
    expect(within(must(row)).getByText('ไม่มีรหัส')).toBeInTheDocument()
  })
})

describe('UsersPage — การ์ดบนมือถือ', () => {
  it('1 คน = 1 การ์ด: ชื่อ + ป้าย "คุณ", อีเมล, สถานะ, บทบาท และ "รหัส …" (ไม่มีรหัส = ไม่แสดง)', async () => {
    fetchAdminUsers.mockResolvedValue(
      page([
        makeUser(ADMIN.id, { first_name: 'สุดา', last_name: 'แก้วมณี', role: 'admin' }),
        makeUser(5, {
          first_name: 'วิชัย',
          last_name: 'ทองมา',
          student_or_staff_id: null,
          is_active: false,
        }),
      ]),
    )
    renderPage()

    const list = await screen.findByRole('list', { name: 'รายชื่อผู้ใช้' })
    const [self, suspended] = within(list).getAllByRole('listitem')
    expect(within(must(self)).getByText('คุณ')).toBeInTheDocument()
    expect(self).toHaveTextContent('ผู้ดูแลระบบ')
    expect(self).toHaveTextContent('รหัส 69000001')
    expect(self).toHaveTextContent('user1@example.com')
    expect(suspended).toHaveTextContent('ระงับการใช้งาน')
    // ไม่มีบรรทัด "รหัส …" (ปุ่ม "รีเซ็ตรหัสผ่าน" ก็มีคำว่า "รหัส" จึงตรวจเฉพาะ "รหัส" ตามด้วยตัวเลข)
    expect(suspended).not.toHaveTextContent(/รหัส \d/)
  })
})

describe('UsersPage — ค้นหา / กรอง', () => {
  it('พิมพ์ค้นหา → รอหยุดพิมพ์แล้วค้นครั้งเดียว + เก็บคำค้นในที่อยู่ + จำนวนเปลี่ยนเป็น "พบ"', async () => {
    fetchAdminUsers.mockResolvedValue(page([makeUser(2)], 248))
    const { user } = renderPage()
    await screen.findByText('ทั้งหมด 248 บัญชี')
    fetchAdminUsers.mockResolvedValue(page([makeUser(2)], 1))

    await user.type(screen.getByRole('searchbox', { name: 'ค้นหาผู้ใช้' }), 'สมชาย')

    await waitFor(() => expect(lastFilters()?.search).toBe('สมชาย'))
    // ไม่ยิงคำขอทุกตัวอักษร: ครั้งแรก (เปิดหน้า) + ครั้งเดียวหลังหยุดพิมพ์
    expect(fetchAdminUsers).toHaveBeenCalledTimes(2)
    expect(location()).toBe('/users?search=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2')
    expect(await screen.findByText('พบ 1 บัญชี')).toBeInTheDocument()
  })

  it('เลือกบทบาท / สถานะ → กรองทันที และกลับไปหน้า 1', async () => {
    fetchAdminUsers.mockResolvedValue(page([makeUser(2)], 45))
    const { user } = renderPage('/users?page=2')
    await screen.findByRole('table')

    await user.selectOptions(screen.getByRole('combobox', { name: 'บทบาท' }), 'teacher')
    await waitFor(() =>
      expect(lastFilters()).toEqual({ search: '', role: 'teacher', status: undefined, page: 1 }),
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'สถานะ' }), 'suspended')
    await waitFor(() => expect(lastFilters()?.status).toBe('suspended'))
    expect(location()).toBe('/users?role=teacher&status=suspended')
  })

  it('เปิดจากลิงก์ที่มีตัวกรอง → ช่องต่าง ๆ แสดงตามที่อยู่ ; ค่าที่ไม่รู้จักถูกมองว่าไม่กรอง', async () => {
    fetchAdminUsers.mockResolvedValue(page([makeUser(2)], 45))
    renderPage('/users?search=ใจดี&role=boss&status=active&page=2')

    await screen.findByRole('table')
    expect(lastFilters()).toEqual({ search: 'ใจดี', role: undefined, status: 'active', page: 2 })
    expect(screen.getByRole('searchbox', { name: 'ค้นหาผู้ใช้' })).toHaveValue('ใจดี')
    expect(screen.getByRole('combobox', { name: 'บทบาท' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'สถานะ' })).toHaveValue('active')
  })

  it('ไม่พบผลลัพธ์ → ข้อความ + ปุ่ม "ล้างตัวกรอง" ที่ล้างทุกตัวกรอง', async () => {
    fetchAdminUsers.mockResolvedValue(page([], 0))
    const { user } = renderPage('/users?search=ไม่มีคนนี้&role=teacher')

    expect(await screen.findByText('ไม่พบผู้ใช้ที่ตรงกับการค้นหา')).toBeInTheDocument()
    expect(screen.getByText('พบ 0 บัญชี')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'แบ่งหน้า' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }))

    expect(location()).toBe('/users')
    expect(screen.getByRole('searchbox', { name: 'ค้นหาผู้ใช้' })).toHaveValue('')
  })
})

describe('UsersPage — แบ่งหน้า', () => {
  it('45 บัญชี → 3 หน้า ; กดถัดไปขอหน้า 2 และข้อความสรุปเปลี่ยนตาม', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => makeUser(index + 2))
    fetchAdminUsers.mockResolvedValue(page(firstPage, 45))
    const { user } = renderPage()

    const nav = await screen.findByRole('navigation', { name: 'แบ่งหน้า' })
    expect(nav).toHaveTextContent('แสดง 1–20 จาก 45 บัญชี')
    expect(nav).toHaveTextContent('หน้า 1 จาก 3')
    expect(within(nav).getByRole('button', { name: 'ก่อนหน้า' })).toBeDisabled()

    fetchAdminUsers.mockResolvedValue(page(firstPage, 45))
    await user.click(within(nav).getByRole('button', { name: 'ถัดไป' }))

    await waitFor(() => expect(lastFilters()?.page).toBe(2))
    expect(location()).toBe('/users?page=2')
    expect(await screen.findByText('แสดง 21–40 จาก 45 บัญชี')).toBeInTheDocument()
  })

  it('ขอหน้าที่ไม่มีอยู่ (404) → กลับไปหน้า 1 เอง', async () => {
    fetchAdminUsers.mockImplementation(async (filters) => {
      if (filters.page === 9) throw new ApiError(404, 'not_found')
      return page([makeUser(2)], 1)
    })
    renderPage('/users?page=9')

    await waitFor(() => expect(location()).toBe('/users'))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('UsersPage — กำลังโหลด / ผิดพลาด', () => {
  it('ระหว่างโหลดครั้งแรก → "กำลังโหลดรายชื่อ…"', () => {
    fetchAdminUsers.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText('กำลังโหลดรายชื่อ…')).toHaveAttribute('role', 'status')
  })

  it('โหลดไม่สำเร็จ → บอกสาเหตุเป็นภาษาไทย + ปุ่มลองอีกครั้งที่โหลดใหม่ได้', async () => {
    fetchAdminUsers.mockRejectedValueOnce(new ApiError(0, 'network_error'))
    const { user } = renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('โหลดรายชื่อผู้ใช้ไม่สำเร็จ')
    expect(alert).toHaveTextContent('ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ')

    fetchAdminUsers.mockResolvedValue(page([makeUser(2)]))
    await user.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(table()).toHaveTextContent('ชื่อ2 นามสกุล2')
  })
})
