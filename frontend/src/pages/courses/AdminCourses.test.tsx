/**
 * test ของหน้าผู้ดูแลระบบ (ขั้น 3.8): จัดการรายวิชา + สร้างแทนผู้สอน + หน้ารายวิชา (แถบส้ม / เปิดคืน / เปลี่ยนผู้สอน)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import * as coursesApi from '../../api/courses'
import type { Course, TeacherOption } from '../../api/courses'
import * as authContext from '../../auth/AuthContext'
import { CourseRoute, MyCoursesRoute } from './CourseRoutes'
import SettingsTab from './SettingsTab'
import { makeCourse } from './testUtils'

vi.mock('../../api/courses', async (importOriginal) => ({
  ...(await importOriginal<typeof coursesApi>()),
  fetchAdminCourses: vi.fn(),
  fetchAdminTerms: vi.fn(),
  fetchAdminTeachers: vi.fn(),
  fetchCourse: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  runCourseAction: vi.fn(),
}))
vi.mock('../../auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof authContext>()),
  useAuth: vi.fn(),
}))
const fetchAdminCourses = vi.mocked(coursesApi.fetchAdminCourses)
const fetchAdminTerms = vi.mocked(coursesApi.fetchAdminTerms)
const fetchAdminTeachers = vi.mocked(coursesApi.fetchAdminTeachers)
const fetchCourse = vi.mocked(coursesApi.fetchCourse)
const createCourse = vi.mocked(coursesApi.createCourse)
const updateCourse = vi.mocked(coursesApi.updateCourse)
const runCourseAction = vi.mocked(coursesApi.runCourseAction)
const useAuth = vi.mocked(authContext.useAuth)

function teacher(id: number, first: string, overrides: Partial<TeacherOption> = {}): TeacherOption {
  return {
    id,
    first_name: first,
    last_name: 'ทดลอง',
    student_or_staff_id: `T${id}`,
    is_active: true,
    assignable: true,
    course_count: 1,
    ...overrides,
  }
}

/** ผู้สอนตัวอย่าง: กมล (สอนอยู่), วรวุฒิ (ยังไม่มีวิชา), ปรียา (ถูกระงับ มีวิชา) */
const TEACHERS: TeacherOption[] = [
  teacher(7, 'กมล'),
  teacher(9, 'วรวุฒิ', { course_count: 0 }),
  teacher(11, 'ปรียา', { is_active: false, assignable: false }),
]

function page(results: Course[], count = results.length) {
  return { count, next: null, previous: null, results }
}

function signInAs(role: 'admin' | 'teacher') {
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
          { index: true, element: <p>แท็บผู้เรียน</p> },
          { path: 'settings', element: <SettingsTab /> },
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

beforeEach(() => {
  vi.resetAllMocks()
  signInAs('admin')
  fetchAdminTerms.mockResolvedValue([
    { academic_year: 2569, semester: 1 },
    { academic_year: 2568, semester: 2 },
  ])
  fetchAdminTeachers.mockResolvedValue(TEACHERS)
  fetchAdminCourses.mockResolvedValue(page([]))
})

describe('หน้าจัดการรายวิชา', () => {
  it('แสดงรายวิชาทั้งระบบ: ภาค ผู้สอน จำนวนผู้เรียน สถานะ และทั้งแถวลิงก์ไปหน้ารายวิชา', async () => {
    fetchAdminCourses.mockResolvedValue(
      page(
        [
          makeCourse({ id: 5, student_count: 42 }),
          makeCourse({
            id: 6,
            code: '204252',
            name: 'การวิเคราะห์อัลกอริทึม',
            teacher: { id: 11, first_name: 'ปรียา', last_name: 'ทดลอง', is_active: false },
          }),
          makeCourse({ id: 8, academic_year: 2568, semester: 2, is_closed: true }),
        ],
        36,
      ),
    )
    renderAt('/courses')

    expect(await screen.findByRole('heading', { name: 'จัดการรายวิชา' })).toBeInTheDocument()
    expect(await screen.findByText('ทั้งหมด 36 รายวิชา')).toBeInTheDocument()
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    const [first, second, third] = rows as [HTMLElement, HTMLElement, HTMLElement]
    expect(within(first).getByText('2569 ภาค 1')).toBeInTheDocument()
    expect(within(first).getByText('42')).toBeInTheDocument()
    expect(within(first).getByText('เผยแพร่แล้ว')).toBeInTheDocument()
    // ผู้สอนถูกระงับ → ข้อความแดงใต้ชื่อ
    expect(within(second).getByText('บัญชีผู้สอนถูกระงับ')).toBeInTheDocument()
    expect(within(third).getByText('ปิดรายวิชาแล้ว')).toBeInTheDocument()
    // ลิงก์มีชื่อเต็มให้โปรแกรมอ่านหน้าจอ
    expect(
      within(first).getByRole('link', { name: 'จัดการรายวิชา 204111 Python พื้นฐาน (2569 ภาค 1)' }),
    ).toHaveAttribute('href', '/courses/5')
    expect(fetchAdminCourses).toHaveBeenCalledWith({ search: '', page: 1 })
  })

  it('ตัวกรองภาค / ผู้สอน / สถานะ → ขอรายการใหม่ ; ตัวเลือกผู้สอนเฉพาะคนที่มีวิชา', async () => {
    const { user, router } = renderAt('/courses')
    const term = await screen.findByLabelText('ภาคเรียน')
    await screen.findByRole('option', { name: '2568 ภาคเรียนที่ 2' })
    await screen.findByRole('option', { name: 'กมล ทดลอง (T7)' })

    // วรวุฒิไม่มีวิชา → ไม่อยู่ในตัวกรอง ; ปรียาถูกระงับแต่มีวิชา → อยู่
    const teacherFilter = screen.getByLabelText('ผู้สอน')
    expect(within(teacherFilter).queryByRole('option', { name: /วรวุฒิ/ })).not.toBeInTheDocument()
    // ใส่รหัสพนักงานต่อท้าย — ผู้สอนชื่อซ้ำกันแยกได้
    expect(within(teacherFilter).getByRole('option', { name: 'ปรียา ทดลอง (T11)' })).toBeInTheDocument()

    await user.selectOptions(term, '2568-2')
    await user.selectOptions(teacherFilter, '11')
    await user.selectOptions(screen.getByLabelText('สถานะ'), 'closed')

    await waitFor(() =>
      expect(fetchAdminCourses).toHaveBeenLastCalledWith({
        search: '',
        term: '2568-2',
        teacher: 11,
        status: 'closed',
        page: 1,
      }),
    )
    expect(router.state.location.search).toBe('?term=2568-2&teacher=11&status=closed')
  })

  it('ลำดับช่องในโค้ด (= ลำดับปุ่ม Tab) ตรงกับลำดับบนจอ: ค้นหา ภาคเรียน ผู้สอน สถานะ ; ไม่มีการย้ายตำแหน่งด้วย CSS', async () => {
    renderAt('/courses')
    await screen.findByLabelText('ภาคเรียน')
    const fields = [...screen.getByRole('search').querySelectorAll<HTMLElement>('input, select')]
    expect(fields.map((field) => document.querySelector(`label[for="${field.id}"]`)?.textContent)).toEqual([
      'ค้นหารายวิชา',
      'ภาคเรียน',
      'ผู้สอน',
      'สถานะ',
    ])
    // ทุกชิ้นในแถบตัวกรอง (รวมกล่องที่ห่อ select) ต้องไม่มีคลาส order-* ที่ย้ายตำแหน่งบนจอให้ต่างจากลำดับ Tab
    const search = screen.getByRole('search')
    ;[search, ...search.querySelectorAll<HTMLElement>('*')].forEach((element) =>
      expect(element.getAttribute('class') ?? '').not.toMatch(/(^|[\s:])order-/),
    )
  })

  it('เปิดหน้าซ้ำภายใน 5 นาที → ใช้รายชื่อผู้สอน / ภาคเรียนที่โหลดไว้ ไม่ขอใหม่', async () => {
    fetchCourse.mockResolvedValue(makeCourse())
    const { router } = renderAt('/courses')
    await screen.findByRole('option', { name: 'กมล ทดลอง (T7)' })
    // ไปหน้าตั้งค่าของวิชา (ใช้รายชื่อผู้สอนเหมือนกัน) แล้วกลับมา
    await router.navigate('/courses/5/settings')
    await within(await screen.findByLabelText('ผู้สอนที่รับผิดชอบ')).findByRole('option', {
      name: 'วรวุฒิ ทดลอง (T9)',
    })
    await router.navigate('/courses')
    await screen.findByRole('option', { name: 'กมล ทดลอง (T7)' })
    expect(fetchAdminTeachers).toHaveBeenCalledTimes(1)
    expect(fetchAdminTerms).toHaveBeenCalledTimes(1)
  })

  it('กรองแล้วไม่พบ → "พบ 0 รายวิชา" + ปุ่มล้างตัวกรอง', async () => {
    const { user, router } = renderAt('/courses?status=draft')

    expect(await screen.findByText('ไม่พบรายวิชาที่ตรงกับการค้นหา')).toBeInTheDocument()
    expect(screen.getByText('พบ 0 รายวิชา')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }))

    expect(router.state.location.search).toBe('')
  })

  it('ค่าแปลกในที่อยู่ไม่ถูกส่งไป backend', async () => {
    renderAt('/courses?term=abc&teacher=x&status=boss&page=0')

    await screen.findByText('ยังไม่มีรายวิชาในระบบ')
    expect(fetchAdminCourses).toHaveBeenCalledWith({ search: '', page: 1 })
  })

  it('ขอหน้าที่ไม่มี (404) → กลับหน้า 1', async () => {
    fetchAdminCourses.mockImplementation(async (filters) => {
      if (filters.page === 3) throw new ApiError(404, 'not_found')
      return page([makeCourse()])
    })
    const { router } = renderAt('/courses?page=3')

    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('สร้างรายวิชาแทนผู้สอน', () => {
  it('ส่งฟอร์มเปล่า → ข้อความทุกช่อง และโฟกัสไปช่องผู้สอน (ช่องแรกบนจอ)', async () => {
    const { user } = renderAt('/courses')

    await user.click(await screen.findByRole('button', { name: 'สร้างรายวิชา' }))
    const dialog = screen.getByRole('dialog')
    const picker = within(dialog).getByLabelText('ผู้สอน')
    await within(picker).findByRole('option', { name: 'กมล ทดลอง (T7)' })
    await user.click(within(dialog).getByLabelText('รหัสวิชา'))
    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))

    await waitFor(() => expect(within(dialog).getAllByText('กรุณากรอกข้อมูลช่องนี้')).toHaveLength(3))
    expect(picker).toHaveFocus()
  })

  it('ต้องเลือกผู้สอน ; ตัวเลือกเฉพาะบัญชีที่ใช้งานได้ ; สร้างแล้วพาไปหน้ารายวิชา', async () => {
    createCourse.mockResolvedValue(
      makeCourse({ id: 21, teacher: { id: 9, first_name: 'วรวุฒิ', last_name: 'ทดลอง', is_active: true } }),
    )
    fetchCourse.mockResolvedValue(makeCourse({ id: 21 }))
    const { user, router } = renderAt('/courses')

    await user.click(await screen.findByRole('button', { name: 'สร้างรายวิชา' }))
    const dialog = screen.getByRole('dialog')
    const picker = within(dialog).getByLabelText('ผู้สอน')
    await within(picker).findByRole('option', { name: 'วรวุฒิ ทดลอง (T9)' })
    // ปรียาถูกระงับ → เลือกไม่ได้
    expect(within(picker).queryByRole('option', { name: /ปรียา/ })).not.toBeInTheDocument()
    expect(picker).toHaveFocus()

    await user.type(within(dialog).getByLabelText('รหัสวิชา'), '204212')
    await user.type(within(dialog).getByLabelText('ชื่อรายวิชา'), 'โครงสร้างข้อมูล')
    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))
    // ยังไม่เลือกผู้สอน → ข้อความใต้ช่อง ไม่ส่ง
    expect(within(dialog).getByText('กรุณากรอกข้อมูลช่องนี้')).toBeInTheDocument()
    expect(picker).toHaveFocus()
    expect(createCourse).not.toHaveBeenCalled()
    // หัวเล็กของหน้าต่างบอกว่ามาจากหน้าจัดการรายวิชา
    expect(within(dialog).getByText('จัดการรายวิชา')).toBeInTheDocument()

    await user.selectOptions(picker, '9')
    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/courses/21'))
    expect(createCourse).toHaveBeenCalledWith(
      expect.objectContaining({ code: '204212', name: 'โครงสร้างข้อมูล', teacher: 9 }),
    )
  })

  it('ผู้สอนที่เลือกถูกระงับระหว่างกรอก → ข้อความใต้ช่องผู้สอน (ไม่ขึ้นข้อความรวมซ้ำ)', async () => {
    createCourse.mockRejectedValue(
      new ApiError(400, 'validation_error', { teacher: ['teacher_not_assignable'] }),
    )
    const { user } = renderAt('/courses')

    await user.click(await screen.findByRole('button', { name: 'สร้างรายวิชา' }))
    const dialog = screen.getByRole('dialog')
    const picker = within(dialog).getByLabelText('ผู้สอน')
    await within(picker).findByRole('option', { name: 'กมล ทดลอง (T7)' })
    await user.selectOptions(picker, '7')
    await user.type(within(dialog).getByLabelText('รหัสวิชา'), '204212')
    await user.type(within(dialog).getByLabelText('ชื่อรายวิชา'), 'โครงสร้างข้อมูล')
    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))

    expect(await within(dialog).findByText('เลือกได้เฉพาะบัญชีผู้สอนที่ใช้งานได้')).toHaveClass('text-danger')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('หน้ารายวิชาของผู้ดูแลระบบ', () => {
  it('มีแถบส้ม "กำลังจัดการแทน" + ปุ่มกลับ "จัดการรายวิชา" ; ผู้สอนไม่เห็นแถบ', async () => {
    fetchCourse.mockResolvedValue(makeCourse())
    renderAt('/courses/5')

    expect(await screen.findByText(/คุณกำลังจัดการรายวิชานี้แทนผู้สอน/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'จัดการรายวิชา' })).toHaveAttribute('href', '/courses')
  })

  it('ผู้สอนเปิดหน้าเดียวกัน → ไม่มีแถบส้ม ไม่มีส่วนผู้สอน และไม่เรียกรายชื่อผู้สอน', async () => {
    signInAs('teacher')
    fetchCourse.mockResolvedValue(makeCourse())
    renderAt('/courses/5/settings')

    expect(await screen.findByLabelText('ชื่อรายวิชา')).toBeInTheDocument()
    expect(screen.queryByText(/คุณกำลังจัดการรายวิชานี้แทนผู้สอน/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เปลี่ยนผู้สอน' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'รายวิชาของฉัน' })).toBeInTheDocument()
    expect(fetchAdminTeachers).not.toHaveBeenCalled()
  })

  it('วิชาที่ปิดแล้ว → ส่วนสถานะ "ปิดเมื่อ … โดย …" ; เปิดคืนทันทีแล้วขึ้นแถบเขียวด้านบน', async () => {
    const closed = makeCourse({
      is_closed: true,
      closed_at: '2026-04-28T09:05:00Z',
      closed_by: 'กมล ศรีวงศ์',
    })
    fetchCourse.mockResolvedValue(closed)
    runCourseAction.mockResolvedValue(makeCourse())
    const { user } = renderAt('/courses/5/settings')

    expect(await screen.findByRole('heading', { name: 'สถานะรายวิชา' })).toBeInTheDocument()
    expect(screen.getByText('ปิดเมื่อ 28 เม.ย. 2569 16:05 โดย กมล ศรีวงศ์')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'เปิดรายวิชาคืน' }))

    expect(runCourseAction).toHaveBeenCalledWith(5, 'reopen')
    expect(await screen.findByText('เปิดรายวิชาคืนแล้ว')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'สถานะรายวิชา' })).not.toBeInTheDocument()
    // เปิดคืนแล้วกลับมามีส่วนการเผยแพร่
    expect(screen.getByRole('heading', { name: 'การเผยแพร่' })).toBeInTheDocument()
  })

  it('เปลี่ยนผู้สอน: ปุ่มกดได้เมื่อเลือกคนใหม่ → ยืนยัน → ผลขึ้นในส่วนผู้สอน', async () => {
    fetchCourse.mockResolvedValue(makeCourse())
    updateCourse.mockResolvedValue(
      makeCourse({ teacher: { id: 9, first_name: 'วรวุฒิ', last_name: 'ทดลอง', is_active: true } }),
    )
    const { user } = renderAt('/courses/5/settings')
    const picker = await screen.findByLabelText('ผู้สอนที่รับผิดชอบ')
    await within(picker).findByRole('option', { name: 'วรวุฒิ ทดลอง (T9)' })
    const change = screen.getByRole('button', { name: 'เปลี่ยนผู้สอน' })

    expect(picker).toHaveValue('7')
    expect(change).toBeDisabled()
    await user.selectOptions(picker, '9')
    await user.click(change)

    const dialog = screen.getByRole('alertdialog', { name: 'เปลี่ยนผู้สอนเป็น วรวุฒิ ทดลอง?' })
    expect(within(dialog).getByText('ผู้สอนเดิม กมล ศรีวงศ์ จะไม่เห็นรายวิชานี้อีก')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'เปลี่ยนผู้สอน' }))

    expect(updateCourse).toHaveBeenCalledWith(5, { teacher: 9 })
    expect(await screen.findByText('เปลี่ยนผู้สอนเป็น วรวุฒิ ทดลอง แล้ว')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เปลี่ยนผู้สอน' })).toBeDisabled()
  })

  it('เลือกผู้สอนค้างไว้แล้วไปตั้งค่าของวิชาอื่นโดยตรง → ช่องกลับเป็นผู้สอนของวิชาใหม่ ปุ่มกดไม่ได้', async () => {
    // ทั้ง 2 วิชาสอนโดยกมล (7) — ค่าที่ค้าง (วรวุฒิ) จึงต่างจากผู้สอนของวิชาใหม่ และปุ่มจะกดได้ถ้าค่าค้าง
    fetchCourse.mockImplementation((id) =>
      Promise.resolve(
        id === 6 ? makeCourse({ id: 6, code: '204252', name: 'โครงสร้างข้อมูล' }) : makeCourse(),
      ),
    )
    // เคยเปิดวิชา 6 มาก่อน → ข้อมูลอยู่ในแคช กลับไปแล้วไม่มีช่วง "กำลังโหลด" ที่ถอดแท็บออก
    const { user, router } = renderAt('/courses/6/settings')
    await screen.findByRole('heading', { name: 'โครงสร้างข้อมูล', level: 1 })
    await router.navigate('/courses/5/settings')
    await screen.findByRole('heading', { name: 'Python พื้นฐาน', level: 1 })
    const picker = await screen.findByLabelText('ผู้สอนที่รับผิดชอบ')
    await within(picker).findByRole('option', { name: 'วรวุฒิ ทดลอง (T9)' })
    await user.selectOptions(picker, '9')
    expect(screen.getByRole('button', { name: 'เปลี่ยนผู้สอน' })).toBeEnabled()

    // ย้อนกลับไปวิชา 6 ตรง ๆ (ปุ่มย้อนกลับของเบราว์เซอร์ / พิมพ์ที่อยู่)
    await router.navigate(-1)
    await screen.findByRole('heading', { name: 'โครงสร้างข้อมูล', level: 1 })
    expect(screen.getByLabelText('ผู้สอนที่รับผิดชอบ')).toHaveValue('7')
    expect(screen.getByRole('button', { name: 'เปลี่ยนผู้สอน' })).toBeDisabled()
  })

  it('ผู้สอนปัจจุบันถูกระงับ → ช่องบอกว่าเป็นใครพร้อม "(บัญชีถูกระงับ)" แต่เลือกกลับไม่ได้', async () => {
    fetchCourse.mockResolvedValue(
      makeCourse({ teacher: { id: 11, first_name: 'ปรียา', last_name: 'ทดลอง', is_active: false } }),
    )
    renderAt('/courses/5/settings')
    const picker = await screen.findByLabelText('ผู้สอนที่รับผิดชอบ')

    const current = await within(picker).findByRole('option', { name: 'ปรียา ทดลอง (T11) (บัญชีถูกระงับ)' })
    expect(current).toBeDisabled()
    expect(picker).toHaveValue('11')
  })

  it('เปลี่ยนไม่สำเร็จเพราะผู้สอนใหม่ถูกระงับไปแล้ว → ข้อความในหน้าต่าง', async () => {
    fetchCourse.mockResolvedValue(makeCourse())
    updateCourse.mockRejectedValue(
      new ApiError(400, 'validation_error', { teacher: ['teacher_not_assignable'] }),
    )
    const { user } = renderAt('/courses/5/settings')
    const picker = await screen.findByLabelText('ผู้สอนที่รับผิดชอบ')
    await within(picker).findByRole('option', { name: 'วรวุฒิ ทดลอง (T9)' })

    await user.selectOptions(picker, '9')
    await user.click(screen.getByRole('button', { name: 'เปลี่ยนผู้สอน' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'เปลี่ยนผู้สอน' }))

    expect(await within(dialog).findByText('เลือกได้เฉพาะบัญชีผู้สอนที่ใช้งานได้')).toBeInTheDocument()
  })
})
