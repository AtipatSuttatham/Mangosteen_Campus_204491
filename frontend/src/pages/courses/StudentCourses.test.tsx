/**
 * test ของหน้าฝั่งผู้เรียน (ขั้น 3.7): รายวิชาของฉัน + เข้าร่วมด้วยรหัส + หน้ารายวิชา + สลับหน้าตามบทบาท
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import * as coursesApi from '../../api/courses'
import type { StudentCourse } from '../../api/courses'
import * as authContext from '../../auth/AuthContext'
import { CourseRoute, MyCoursesRoute } from './CourseRoutes'

vi.mock('../../api/courses', async (importOriginal) => ({
  ...(await importOriginal<typeof coursesApi>()),
  fetchMyCourses: vi.fn(),
  fetchMyStudentCourses: vi.fn(),
  fetchStudentCourse: vi.fn(),
  fetchCourse: vi.fn(),
  joinCourse: vi.fn(),
}))
vi.mock('../../auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof authContext>()),
  useAuth: vi.fn(),
}))
const fetchMyStudentCourses = vi.mocked(coursesApi.fetchMyStudentCourses)
const fetchStudentCourse = vi.mocked(coursesApi.fetchStudentCourse)
const fetchMyCourses = vi.mocked(coursesApi.fetchMyCourses)
const joinCourse = vi.mocked(coursesApi.joinCourse)
const useAuth = vi.mocked(authContext.useAuth)

function makeStudentCourse(overrides: Partial<StudentCourse> = {}): StudentCourse {
  return {
    id: 5,
    academic_year: 2569,
    semester: 1,
    code: '204111',
    name: 'Python พื้นฐาน',
    description: '',
    teacher: { id: 7, first_name: 'กมล', last_name: 'ศรีวงศ์', is_active: true },
    is_closed: false,
    ...overrides,
  }
}

/** ตั้งผู้ใช้ที่เข้าสู่ระบบอยู่ (เฉพาะช่องที่หน้าใช้) */
function signInAs(role: 'student' | 'teacher') {
  useAuth.mockReturnValue({ user: { role } } as ReturnType<typeof authContext.useAuth>)
}

/** วาดหน้าในแผนที่หน้าแบบเดียวกับ router.tsx */
function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/courses', element: <MyCoursesRoute /> },
      {
        path: '/courses/:courseId',
        element: <CourseRoute />,
        children: [
          { index: true, element: <p>แท็บผู้เรียนของผู้สอน</p> },
          { path: 'settings', element: <p>แท็บตั้งค่าของผู้สอน</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), router }
}

const joinButton = () => screen.getByRole('button', { name: 'เข้าร่วมรายวิชาด้วยรหัส' })

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  signInAs('student')
})

describe('รายวิชาของฉัน (ผู้เรียน)', () => {
  it('แสดงวิชาแยกตามภาคเรียน ชื่อผู้สอน และป้ายวิชาที่ปิดแล้ว ; มีวิชาแล้วส่วนเข้าร่วมพับอยู่', async () => {
    fetchMyStudentCourses.mockResolvedValue([
      makeStudentCourse(),
      makeStudentCourse({ id: 6, code: '204100', name: 'วิชาเก่า', academic_year: 2568, semester: 2, is_closed: true }),
    ])
    const { user } = renderAt('/courses')

    const link = await screen.findByRole('link', { name: /Python พื้นฐาน/ })
    expect(link).toHaveAttribute('href', '/courses/5')
    expect(link).toHaveTextContent('ผู้สอน กมล ศรีวงศ์')
    expect(joinButton()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('รหัสเข้าร่วม')).not.toBeInTheDocument()
    // ภาคเก่าพับอยู่ (ค่าเริ่มต้น) — เปิดแล้วเห็นป้ายปิดรายวิชา
    await user.click(screen.getByRole('button', { name: /ปีการศึกษา 2568 ภาคเรียนที่ 2/ }))
    expect(screen.getByRole('link', { name: /วิชาเก่า/ })).toHaveTextContent('ปิดรายวิชาแล้ว')
    expect(fetchMyCourses).not.toHaveBeenCalled()
  })

  it('ยังไม่มีวิชา → ส่วนเข้าร่วมเปิดอยู่ + ข้อความชวนกรอกรหัส', async () => {
    fetchMyStudentCourses.mockResolvedValue([])
    renderAt('/courses')

    expect(await screen.findByText('ยังไม่มีรายวิชา')).toBeInTheDocument()
    expect(joinButton()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('รหัสเข้าร่วม')).toBeInTheDocument()
  })

  it('ช่องรหัส: แปลงเป็นตัวใหญ่ ตัดช่องว่าง / ขีด ไม่เกิน 8 ตัว ; ปุ่มกดได้เมื่อครบ 8 ตัว', async () => {
    fetchMyStudentCourses.mockResolvedValue([])
    const { user } = renderAt('/courses')
    const input = await screen.findByLabelText('รหัสเข้าร่วม')
    const submit = screen.getByRole('button', { name: 'เข้าร่วมรายวิชา' })

    await user.type(input, 'k7q 2x')
    expect(input).toHaveValue('K7Q2X')
    expect(submit).toBeDisabled()
    await user.type(input, 'm-9a-extra')
    expect(input).toHaveValue('K7Q2XM9A')
    expect(submit).toBeEnabled()
  })

  it('เข้าร่วมสำเร็จ → แถบเขียว วิชาใหม่โผล่ในรายการ และพับส่วนเข้าร่วม (ฟ1)', async () => {
    const course = makeStudentCourse({ id: 8, code: '204212', name: 'โครงสร้างข้อมูล' })
    fetchMyStudentCourses.mockResolvedValueOnce([]).mockResolvedValue([course])
    joinCourse.mockResolvedValue({ course, joined: true })
    const { user } = renderAt('/courses')

    await user.type(await screen.findByLabelText('รหัสเข้าร่วม'), 'k7q2xm9a')
    await user.click(screen.getByRole('button', { name: 'เข้าร่วมรายวิชา' }))

    expect(joinCourse).toHaveBeenCalledWith('K7Q2XM9A')
    expect(await screen.findByRole('status')).toHaveTextContent('เข้าร่วมรายวิชา 204212 โครงสร้างข้อมูล แล้ว')
    expect(await screen.findByRole('link', { name: /โครงสร้างข้อมูล/ })).toBeInTheDocument()
    expect(joinButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('อยู่ในรายวิชานั้นอยู่แล้ว → แถบเทา "อยู่แล้ว" ไม่ใช่ "เข้าร่วมแล้ว" (ภ1)', async () => {
    const course = makeStudentCourse()
    fetchMyStudentCourses.mockResolvedValue([course])
    joinCourse.mockResolvedValue({ course, joined: false })
    const { user } = renderAt('/courses')

    await user.click(await screen.findByRole('button', { name: 'เข้าร่วมรายวิชาด้วยรหัส' }))
    await user.type(screen.getByLabelText('รหัสเข้าร่วม'), 'K7Q2XM9A')
    await user.click(screen.getByRole('button', { name: 'เข้าร่วมรายวิชา' }))

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('คุณอยู่ในรายวิชา 204111 Python พื้นฐาน อยู่แล้ว')
    expect(notice.className).toContain('bg-mute-soft')
  })

  it('รหัสใช้ไม่ได้ → ข้อความเดียวใต้ช่อง ช่องขอบแดง และส่วนเข้าร่วมเปิดค้าง', async () => {
    fetchMyStudentCourses.mockResolvedValue([makeStudentCourse()])
    joinCourse.mockRejectedValue(new ApiError(400, 'join_code_invalid'))
    const { user } = renderAt('/courses')

    await user.click(await screen.findByRole('button', { name: 'เข้าร่วมรายวิชาด้วยรหัส' }))
    const input = screen.getByLabelText('รหัสเข้าร่วม')
    await user.type(input, 'K7Q2XM9B')
    await user.click(screen.getByRole('button', { name: 'เข้าร่วมรายวิชา' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ใช้รหัสนี้เข้าร่วมไม่ได้ ตรวจรหัสกับผู้สอนอีกครั้ง')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(joinButton()).toHaveAttribute('aria-expanded', 'true')
    // พิมพ์แก้ → ข้อความผิดหาย
    await user.type(input, '{Backspace}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ลองบ่อยเกินไป → ข้อความ throttled', async () => {
    fetchMyStudentCourses.mockResolvedValue([])
    joinCourse.mockRejectedValue(new ApiError(429, 'throttled'))
    const { user } = renderAt('/courses')

    await user.type(await screen.findByLabelText('รหัสเข้าร่วม'), 'K7Q2XM9A')
    await user.click(screen.getByRole('button', { name: 'เข้าร่วมรายวิชา' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ส่งคำขอบ่อยเกินไป')
  })

  it('จำค่าที่ผู้ใช้เปิดส่วนเข้าร่วมไว้ในเบราว์เซอร์', async () => {
    fetchMyStudentCourses.mockResolvedValue([makeStudentCourse()])
    const { user } = renderAt('/courses')

    await user.click(await screen.findByRole('button', { name: 'เข้าร่วมรายวิชาด้วยรหัส' }))

    expect(localStorage.getItem('mangosteen:student-courses:join-open')).toBe('true')
  })
})

describe('หน้ารายวิชา (ผู้เรียน)', () => {
  it('หัวรายวิชา + เกี่ยวกับรายวิชาแบบ Markdown + กล่องยังไม่มีเนื้อหา', async () => {
    fetchStudentCourse.mockResolvedValue(makeStudentCourse({ description: 'ปูพื้นฐาน **Python**\n\n- ตัวแปร\n- ฟังก์ชัน' }))
    renderAt('/courses/5')

    expect(await screen.findByRole('heading', { level: 1, name: 'Python พื้นฐาน' })).toBeInTheDocument()
    expect(screen.getByText('ผู้สอน กมล ศรีวงศ์')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'เกี่ยวกับรายวิชา' })).toBeInTheDocument()
    expect(screen.getByText('Python').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'ยังไม่มีเนื้อหาในรายวิชานี้' })).toBeInTheDocument()
    // ผู้เรียนไม่มีแท็บของผู้สอน
    expect(screen.queryByText('แท็บผู้เรียนของผู้สอน')).not.toBeInTheDocument()
    expect(fetchStudentCourse).toHaveBeenCalledWith(5)
  })

  it('ไม่มีคำอธิบาย → ไม่แสดงส่วนเกี่ยวกับรายวิชา ; วิชาที่ปิดแล้วมีป้ายและข้อความดูย้อนหลัง', async () => {
    fetchStudentCourse.mockResolvedValue(makeStudentCourse({ description: '  ', is_closed: true }))
    renderAt('/courses/5')

    await screen.findByRole('heading', { level: 1, name: 'Python พื้นฐาน' })
    expect(screen.queryByRole('heading', { name: 'เกี่ยวกับรายวิชา' })).not.toBeInTheDocument()
    expect(screen.getByText('ปิดรายวิชาแล้ว')).toBeInTheDocument()
    expect(screen.getByText('รายวิชานี้ปิดแล้ว ดูข้อมูลย้อนหลังได้อย่างเดียว')).toBeInTheDocument()
  })

  it('ไม่ได้เรียนวิชานี้ (404) → ไม่พบรายวิชา', async () => {
    fetchStudentCourse.mockRejectedValue(new ApiError(404, 'not_found'))
    renderAt('/courses/99')

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบรายวิชา')
  })

  it('เปิดแท็บตั้งค่าของผู้สอน → ไม่พบรายวิชา และไม่เรียก API', async () => {
    renderAt('/courses/5/settings')

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบรายวิชา')
    expect(screen.queryByText('แท็บตั้งค่าของผู้สอน')).not.toBeInTheDocument()
    expect(fetchStudentCourse).not.toHaveBeenCalled()
  })
})

describe('สลับหน้าตามบทบาท', () => {
  it('ผู้สอนยังได้หน้ารายวิชาของผู้สอนที่ /courses', async () => {
    signInAs('teacher')
    fetchMyCourses.mockResolvedValue([])
    renderAt('/courses')

    expect(await screen.findByRole('button', { name: /สร้างรายวิชา/ })).toBeInTheDocument()
    expect(fetchMyStudentCourses).not.toHaveBeenCalled()
    await waitFor(() => expect(fetchMyCourses).toHaveBeenCalled())
    expect(within(document.body).queryByText('เข้าร่วมรายวิชาด้วยรหัส')).not.toBeInTheDocument()
  })
})
