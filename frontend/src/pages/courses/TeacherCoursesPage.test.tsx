/**
 * test ของหน้า "รายวิชาของฉัน" ของผู้สอน และหน้าต่างสร้างรายวิชา (ขั้น 3.5)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import * as coursesApi from '../../api/courses'
import type { Course } from '../../api/courses'
import { currentTerm } from '../../lib/terms'
import TeacherCoursesPage from './TeacherCoursesPage'

vi.mock('../../api/courses', async (importOriginal) => ({
  ...(await importOriginal<typeof coursesApi>()),
  fetchMyCourses: vi.fn(),
  createCourse: vi.fn(),
}))
const fetchMyCourses = vi.mocked(coursesApi.fetchMyCourses)
const createCourse = vi.mocked(coursesApi.createCourse)

/** สร้างรายวิชาสมมติ */
function makeCourse(id: number, overrides: Partial<Course> = {}): Course {
  return {
    id,
    academic_year: 2569,
    semester: 1,
    code: '204111',
    name: 'Python พื้นฐาน',
    description: '',
    teacher: { id: 7, first_name: 'กมล', last_name: 'ศรีวงศ์', is_active: true },
    is_closed: false,
    is_published: true,
    join_code_enabled: true,
    join_code: 'K7Q2XM9A',
    student_count: 42,
    can_delete: false,
    closed_at: null,
    closed_by: null,
    created_at: '2026-06-01T03:00:00Z',
    ...overrides,
  }
}

/** รายวิชาตัวอย่างตาม board: 2569/1 มี 3 วิชา, 2568/2 มี 1 วิชา (ปิดแล้ว) */
const COURSES: Course[] = [
  makeCourse(1),
  makeCourse(2, { code: '204212', name: 'โครงสร้างข้อมูล', student_count: 31, join_code_enabled: false }),
  makeCourse(3, {
    code: '204331',
    name: 'วิศวกรรมซอฟต์แวร์',
    is_published: false,
    student_count: 0,
    join_code_enabled: false,
    join_code: null,
    can_delete: true,
  }),
  makeCourse(4, { academic_year: 2568, semester: 2, is_closed: true, student_count: 38 }),
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeacherCoursesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

const termButton = (name: RegExp) => screen.getByRole('button', { name })

beforeEach(() => {
  window.localStorage.clear()
  fetchMyCourses.mockReset()
  createCourse.mockReset()
  fetchMyCourses.mockResolvedValue(COURSES)
})

describe('รายการรายวิชา', () => {
  it('จัดกลุ่มตามภาค: ภาคล่าสุดเปิด ภาคเก่าพับ พร้อมจำนวนรายวิชา', async () => {
    renderPage()

    const latest = await screen.findByRole('button', { name: /ปีการศึกษา 2569 ภาคเรียนที่ 1/ })
    const older = termButton(/ปีการศึกษา 2568 ภาคเรียนที่ 2/)
    expect(latest).toHaveAttribute('aria-expanded', 'true')
    expect(latest).toHaveTextContent('3 รายวิชา')
    expect(older).toHaveAttribute('aria-expanded', 'false')
    expect(older).toHaveTextContent('1 รายวิชา')
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Python พื้นฐาน',
      'โครงสร้างข้อมูล',
      'วิศวกรรมซอฟต์แวร์',
    ])
  })

  it('แต่ละแถวแสดงป้ายรหัสวิชา จำนวนผู้เรียน และรหัสเข้าร่วม / ปิดการใช้รหัส', async () => {
    renderPage()
    const rows = await screen.findAllByRole('listitem')

    expect(within(rows[0]!).getByText('204111')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('42 ผู้เรียน')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('รหัสเข้าร่วม K7Q2XM9A')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('ปิดการใช้รหัสเข้าร่วม')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('ยังไม่มีผู้เรียน')).toBeInTheDocument()
  })

  it('ป้ายสถานะเฉพาะวิชาที่ยังไม่เผยแพร่ / ปิดแล้ว (วิชาที่เผยแพร่แล้วไม่มีป้าย)', async () => {
    const user = renderPage()
    const rows = await screen.findAllByRole('listitem')

    expect(within(rows[0]!).queryByText('ยังไม่เผยแพร่')).not.toBeInTheDocument()
    // ป้ายมี 2 ชุด (มือถือ / จอใหญ่ — CSS แสดงทีละชุด)
    expect(within(rows[2]!).getAllByText('ยังไม่เผยแพร่')).toHaveLength(2)

    await user.click(termButton(/ปีการศึกษา 2568/))
    const closedRow = screen.getAllByRole('listitem')[3]!
    expect(within(closedRow).getAllByText('ปิดรายวิชาแล้ว')).toHaveLength(2)
    expect(within(closedRow).getByText('ผู้เรียนดูข้อมูลย้อนหลังได้อย่างเดียว')).toBeInTheDocument()
  })

  it('พับ/เปิดแล้วจำค่าไว้ — เปิดหน้าใหม่ยังเป็นแบบเดิม', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: /ปีการศึกษา 2569/ }))
    await user.click(termButton(/ปีการศึกษา 2568/))

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    document.body.innerHTML = ''
    renderPage()

    expect(await screen.findByRole('button', { name: /ปีการศึกษา 2569/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(termButton(/ปีการศึกษา 2568/)).toHaveAttribute('aria-expanded', 'true')
  })

  it('ยังไม่มีรายวิชา → ข้อความชวนสร้าง + ปุ่มสร้างรายวิชา', async () => {
    fetchMyCourses.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('ยังไม่มีรายวิชา')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'สร้างรายวิชา' })).toHaveLength(2)
  })

  it('โหลดไม่สำเร็จ → บอกสาเหตุ + ปุ่มลองอีกครั้ง', async () => {
    fetchMyCourses.mockRejectedValueOnce(new ApiError(0, 'network_error'))
    const user = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('โหลดรายวิชาไม่สำเร็จ')
    await user.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }))

    expect(await screen.findByText('Python พื้นฐาน')).toBeInTheDocument()
  })
})

describe('หน้าต่างสร้างรายวิชา', () => {
  async function openDialog() {
    const user = renderPage()
    await screen.findByText('Python พื้นฐาน')
    await user.click(screen.getByRole('button', { name: 'สร้างรายวิชา' }))
    return { user, dialog: screen.getByRole('dialog', { name: 'สร้างรายวิชา' }) }
  }

  it('เปิดแล้วโฟกัสช่องปีการศึกษา และปี / ภาคเริ่มที่ภาคเรียนปัจจุบัน', async () => {
    const { dialog } = await openDialog()
    const term = currentTerm()

    const year = within(dialog).getByLabelText('ปีการศึกษา')
    expect(year).toHaveFocus()
    expect(year).toHaveValue(String(term.academic_year))
    expect(within(dialog).getByLabelText('ภาคเรียน')).toHaveValue(String(term.semester))
  })

  it('สร้างสำเร็จ → ส่งข้อมูลที่ตัดช่องว่างแล้ว, ปิดหน้าต่าง, แถบเขียว, โหลดรายการใหม่', async () => {
    const { user, dialog } = await openDialog()
    createCourse.mockResolvedValue(makeCourse(9, { code: '204999', name: 'ปัญญาประดิษฐ์' }))
    await user.clear(within(dialog).getByLabelText('ปีการศึกษา'))
    await user.type(within(dialog).getByLabelText('ปีการศึกษา'), '2570')
    await user.selectOptions(within(dialog).getByLabelText('ภาคเรียน'), '2')
    await user.type(within(dialog).getByLabelText('รหัสวิชา'), ' 204999 ')
    await user.type(within(dialog).getByLabelText('ชื่อรายวิชา'), 'ปัญญาประดิษฐ์')

    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))

    expect(createCourse).toHaveBeenCalledWith({
      academic_year: 2570,
      semester: 2,
      code: '204999',
      name: 'ปัญญาประดิษฐ์',
      description: '',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('สร้างรายวิชา 204999 ปัญญาประดิษฐ์ แล้ว')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(fetchMyCourses).toHaveBeenCalledTimes(2))
  })

  it('รหัสวิชาซ้ำในภาค → ข้อความใต้ช่องรหัสวิชา และหน้าต่างยังเปิดอยู่', async () => {
    const { user, dialog } = await openDialog()
    createCourse.mockRejectedValue(
      new ApiError(400, 'validation_error', { code: ['course_code_duplicate'] }),
    )
    await user.type(within(dialog).getByLabelText('รหัสวิชา'), '204212')
    await user.type(within(dialog).getByLabelText('ชื่อรายวิชา'), 'โครงสร้างข้อมูล')

    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))

    const codeField = within(dialog).getByLabelText('รหัสวิชา')
    expect(await within(dialog).findByText('รหัสวิชานี้มีอยู่แล้วในภาคเรียนนี้')).toBeInTheDocument()
    expect(codeField).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('ไม่กรอกรหัส / ชื่อ (หรือมีแต่ช่องว่าง) → แจ้งใต้ช่อง และไม่เรียก API', async () => {
    const { user, dialog } = await openDialog()
    await user.type(within(dialog).getByLabelText('ชื่อรายวิชา'), '   ')

    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))

    expect(await within(dialog).findAllByText('กรุณากรอกข้อมูลช่องนี้')).toHaveLength(2)
    expect(createCourse).not.toHaveBeenCalled()
  })

  it('ติดต่อเซิร์ฟเวอร์ไม่ได้ → ข้อความรวมเหนือปุ่ม', async () => {
    const { user, dialog } = await openDialog()
    createCourse.mockRejectedValue(new ApiError(0, 'network_error'))
    await user.type(within(dialog).getByLabelText('รหัสวิชา'), '204999')
    await user.type(within(dialog).getByLabelText('ชื่อรายวิชา'), 'ทดลอง')

    await user.click(within(dialog).getByRole('button', { name: 'สร้างรายวิชา' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('ติดต่อเซิร์ฟเวอร์ไม่ได้')
  })

  it('ยกเลิก → ปิดหน้าต่างโดยไม่สร้าง', async () => {
    const { user, dialog } = await openDialog()

    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(createCourse).not.toHaveBeenCalled()
  })
})
