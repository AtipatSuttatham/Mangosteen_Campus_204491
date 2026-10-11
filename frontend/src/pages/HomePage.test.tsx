/**
 * test ของหน้าแรกชั่วคราว (HomePage): คำทักทาย, วันที่, ป้ายรหัสตามบทบาท, ข้อความ "ยังไม่มี…" ตามบทบาท
 */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { User } from '../api/auth'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import HomePage from './HomePage'

/** ผู้ใช้ตัวอย่างแต่ละบทบาท (ข้อมูลสมมติ ตรงกับบัญชีทดลองของ seed_dev_users) */
const BASE = { avatar_url: null, last_name: 'ทดลองระบบ' }
const STUDENT: User = {
  ...BASE,
  id: 3,
  email: 'student@example.com',
  student_or_staff_id: '690000001',
  role: 'student',
  first_name: 'สมใจ',
}
const TEACHER: User = {
  ...BASE,
  id: 2,
  email: 'teacher@example.com',
  student_or_staff_id: 'T00001',
  role: 'teacher',
  first_name: 'ผู้สอน',
}
const ADMIN: User = {
  ...BASE,
  id: 1,
  email: 'admin@example.com',
  student_or_staff_id: null,
  role: 'admin',
  first_name: 'ผู้ดูแล',
}

function renderHome(user: User) {
  const value: AuthContextValue = {
    status: 'authenticated',
    user,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
  }
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('HomePage', () => {
  // ตรึงเวลาของเครื่อง (เฉพาะวันที่) ให้วันที่บนหน้าจอคงที่: 11 ต.ค. 2026 10:00 เวลาไทย
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T03:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ผู้เรียน: คำทักทาย, วันที่วันนี้, บทบาท, รหัสนักศึกษา และข้อความตาม wireframe', () => {
    renderHome(STUDENT)

    expect(screen.getByRole('heading', { level: 1, name: 'สวัสดี สมใจ' })).toBeInTheDocument()
    expect(screen.getByText('วันอาทิตย์ที่ 11 ตุลาคม 2569')).toBeInTheDocument()
    expect(screen.getByText('ผู้เรียน')).toBeInTheDocument()
    expect(screen.getByText('รหัสนักศึกษา 690000001')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'ยังไม่มีงานที่ต้องทำ' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'เมื่อผู้สอนเพิ่มคุณเข้ารายวิชา งานที่ต้องส่ง แบบทดสอบ และคะแนนของคุณจะแสดงที่หน้านี้',
      ),
    ).toBeInTheDocument()
  })

  it('ปุ่ม "ดูข้อมูลส่วนตัว" เป็นลิงก์ไปหน้าข้อมูลส่วนตัว', () => {
    renderHome(STUDENT)

    expect(screen.getByRole('link', { name: 'ดูข้อมูลส่วนตัว' })).toHaveAttribute('href', '/profile')
  })

  it('ผู้สอน: รหัสพนักงาน และข้อความของผู้สอน', () => {
    renderHome(TEACHER)

    expect(screen.getByText('รหัสพนักงาน T00001')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'ยังไม่มีรายวิชา' })).toBeInTheDocument()
  })

  it('ผู้ดูแลระบบที่ไม่มีรหัส: ไม่แสดงบรรทัดรหัส และแสดงข้อความของผู้ดูแลระบบ', () => {
    renderHome(ADMIN)

    expect(screen.getByText('ผู้ดูแลระบบ')).toBeInTheDocument()
    expect(screen.queryByText(/^รหัส/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'ยังไม่มีเครื่องมือจัดการ' }),
    ).toBeInTheDocument()
  })
})
