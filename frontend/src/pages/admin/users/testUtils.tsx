/**
 * ตัวช่วยของ test หน้าจัดการบัญชีผู้ใช้ (ขั้น 2.6) — ข้อมูลสมมติ + วาดหน้า /users พร้อม "สมอง" ปลอม
 * ใช้เฉพาะใน test (ไฟล์ *.test.tsx) — ไม่ถูกรวมในหน้าเว็บจริง
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { AdminUser, Paginated } from '../../../api/adminUsers'
import type { User } from '../../../api/auth'
import { AuthContext, type AuthContextValue } from '../../../auth/AuthContext'
import UsersPage from './UsersPage'

/** ผู้ดูแลระบบที่เข้าสู่ระบบอยู่ (ข้อมูลสมมติ) */
export const ADMIN: User = {
  id: 1,
  email: 'admin@example.com',
  student_or_staff_id: 'A0001',
  role: 'admin',
  first_name: 'สุดา',
  last_name: 'แก้วมณี',
  avatar_url: null,
}

/** สร้างบัญชีสมมติ */
export function makeUser(id: number, overrides: Partial<AdminUser> = {}): AdminUser {
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
export function page(results: AdminUser[], count = results.length): Paginated<AdminUser> {
  return { count, next: null, previous: null, results }
}

/** วาดหน้า /users ; คืนตัวจำลองการกด/พิมพ์ และ updateUser ปลอม (ตรวจการอัปเดตชื่อทั่วหน้าจอ) */
export function renderUsersPage() {
  const updateUser = vi.fn()
  const auth: AuthContextValue = {
    status: 'authenticated',
    user: ADMIN,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser,
    acceptSession: vi.fn(),
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/users']}>
          <UsersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), updateUser }
}
