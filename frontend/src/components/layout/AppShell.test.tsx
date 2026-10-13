/**
 * test ของโครงหน้าจอหลัก (AppShell): เมนูตามบทบาท, เมนูหน้าปัจจุบัน, ออกจากระบบ, เมนูลิ้นชักบนมือถือ
 * ใช้ "สมอง" ปลอม (AuthContext) แทนของจริง และหน้าลูกแบบง่ายแทนหน้าจริง
 */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { Role, User } from '../../api/auth'
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext'
import AppShell from './AppShell'
import { navItemsFor } from './navigation'

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

/** ผู้ดูแลระบบตัวอย่าง (ข้อมูลสมมติ) */
const ADMIN: User = {
  ...STUDENT,
  id: 1,
  email: 'admin@example.com',
  student_or_staff_id: null,
  role: 'admin',
}

/** วาดโครงหน้าจอที่ที่อยู่ที่กำหนด — หน้าลูกเป็นหัวข้อง่าย ๆ ให้รู้ว่าอยู่หน้าไหน */
function renderShell(path = '/', logout = vi.fn(), currentUser: User = STUDENT) {
  const value: AuthContextValue = {
    status: 'authenticated',
    user: currentUser,
    sessionExpired: false,
    login: vi.fn(),
    logout,
    updateUser: vi.fn(),
    acceptSession: vi.fn(),
  }
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<h1>หน้าแรกทดสอบ</h1>} />
            <Route path="/profile" element={<h1>หน้าข้อมูลส่วนตัวทดสอบ</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { logout, user: userEvent.setup() }
}

/** sidebar ของจอใหญ่ (กลุ่มเมนูชื่อ "เมนูหลัก" ที่อยู่นอกเมนูลิ้นชัก) */
const sidebarNav = () => screen.getByRole('navigation', { name: 'เมนูหลัก' })
const menuButton = () => screen.getByRole('button', { name: 'เปิดเมนู' })

describe('AppShell — sidebar', () => {
  it('แสดงเมนู ภาพรวม, ชื่อ + บทบาทผู้ใช้, ลิงก์ข้อมูลส่วนตัว และปุ่มออกจากระบบ', () => {
    renderShell('/')

    expect(screen.getByRole('heading', { name: 'หน้าแรกทดสอบ' })).toBeInTheDocument()
    expect(within(sidebarNav()).getByRole('link', { name: 'ภาพรวม' })).toBeInTheDocument()
    expect(screen.getByText('สมใจ รักเรียน')).toBeInTheDocument()
    expect(screen.getByText('ผู้เรียน')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ออกจากระบบ' })).toBeInTheDocument()
  })

  it('เมนูของหน้าปัจจุบันถูกทำเครื่องหมาย (aria-current) — หน้าแรก', () => {
    renderShell('/')

    expect(within(sidebarNav()).getByRole('link', { name: 'ภาพรวม' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('อยู่หน้าข้อมูลส่วนตัว → เมนู ภาพรวม ไม่ถูกทำเครื่องหมาย', () => {
    renderShell('/profile')

    expect(screen.getByRole('heading', { name: 'หน้าข้อมูลส่วนตัวทดสอบ' })).toBeInTheDocument()
    expect(within(sidebarNav()).getByRole('link', { name: 'ภาพรวม' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('กดออกจากระบบ → เรียก logout()', async () => {
    const { logout, user } = renderShell('/')

    await user.click(screen.getByRole('button', { name: 'ออกจากระบบ' }))

    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('มีลิงก์ "ข้ามไปเนื้อหาหลัก" ชี้ไปที่พื้นที่เนื้อหา', () => {
    renderShell('/')

    expect(screen.getByRole('link', { name: 'ข้ามไปเนื้อหาหลัก' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})

describe('AppShell — เมนูลิ้นชักบนมือถือ', () => {
  it('กด ☰ → เมนูเปิด, โฟกัสที่ปุ่มปิด, เนื้อหาด้านหลังกดไม่ได้ และหน้าเลื่อนไม่ได้', async () => {
    const { user } = renderShell('/')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(menuButton())

    const drawer = screen.getByRole('dialog', { name: 'เมนูหลัก' })
    expect(within(drawer).getByRole('button', { name: 'ปิดเมนู' })).toHaveFocus()
    expect(within(drawer).getByRole('link', { name: 'ภาพรวม' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'ออกจากระบบ' })).toBeInTheDocument()
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('กด Esc → เมนูปิด, โฟกัสกลับที่ปุ่ม ☰ และหน้าเลื่อนได้ตามเดิม', async () => {
    const { user } = renderShell('/')
    await user.click(menuButton())

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(menuButton()).toHaveFocus()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('main')).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('')
  })

  it('กดปุ่มปิด (✕) → เมนูปิด', async () => {
    const { user } = renderShell('/')
    await user.click(menuButton())

    await user.click(screen.getByRole('button', { name: 'ปิดเมนู' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('แตะพื้นที่มืดด้านหลัง → เมนูปิด', async () => {
    const { user } = renderShell('/')
    await user.click(menuButton())

    await user.click(screen.getByTestId('drawer-backdrop'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('เลือกลิงก์ในเมนู → ไปหน้านั้นและเมนูปิดเอง', async () => {
    const { user } = renderShell('/')
    await user.click(menuButton())

    await user.click(
      within(screen.getByRole('dialog')).getByRole('link', { name: 'ข้อมูลส่วนตัว' }),
    )

    expect(screen.getByRole('heading', { name: 'หน้าข้อมูลส่วนตัวทดสอบ' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ปุ่ม Tab วนอยู่ในเมนู: ตัวสุดท้าย → ตัวแรก และ Shift+Tab ตัวแรก → ตัวสุดท้าย', async () => {
    const { user } = renderShell('/')
    await user.click(menuButton())
    const drawer = screen.getByRole('dialog')
    const closeButton = within(drawer).getByRole('button', { name: 'ปิดเมนู' })
    const logoutButton = within(drawer).getByRole('button', { name: 'ออกจากระบบ' })

    await user.tab({ shift: true })
    expect(logoutButton).toHaveFocus()

    await user.tab()
    expect(closeButton).toHaveFocus()
  })
})

describe('AppShell — ขยายจอระหว่างเปิดเมนู', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('จอกว้างถึงขนาดจอใหญ่ (≥ 1024px) → เมนูลิ้นชักปิดเอง และหน้าเลื่อนได้ตามเดิม', async () => {
    // จำลองตัวตรวจขนาดจอของเบราว์เซอร์ (jsdom ไม่มี matchMedia) แล้วเก็บตัวรับการเปลี่ยนไว้เรียกเอง
    let notifyChange: ((event: { matches: boolean }) => void) | undefined
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: (_type: string, handler: typeof notifyChange) => {
          notifyChange = handler
        },
        removeEventListener: vi.fn(),
      })),
    )
    const { user } = renderShell('/')
    await user.click(menuButton())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    act(() => notifyChange?.({ matches: true }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('navItemsFor', () => {
  it.each<Role>(['teacher', 'student'])('%s เห็นเมนู ภาพรวม เท่านั้น', (role) => {
    expect(navItemsFor(role).map((item) => item.to)).toEqual(['/'])
  })

  it('ผู้ดูแลระบบเห็น ภาพรวม + จัดการผู้ใช้ (ขั้น 2.5)', () => {
    expect(navItemsFor('admin').map((item) => item.to)).toEqual(['/', '/users'])
  })
})

describe('AppShell — เมนูตามบทบาท', () => {
  it('ผู้เรียนไม่เห็นเมนู จัดการผู้ใช้', () => {
    renderShell('/')

    expect(
      within(sidebarNav()).queryByRole('link', { name: 'จัดการผู้ใช้' }),
    ).not.toBeInTheDocument()
  })

  it('ผู้ดูแลระบบเห็นเมนู จัดการผู้ใช้ ชี้ไป /users', () => {
    renderShell('/', vi.fn(), ADMIN)

    expect(within(sidebarNav()).getByRole('link', { name: 'จัดการผู้ใช้' })).toHaveAttribute(
      'href',
      '/users',
    )
  })
})
