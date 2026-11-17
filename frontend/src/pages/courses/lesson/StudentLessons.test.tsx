/**
 * test ของส่วน "บทเรียน" ในหน้ารายวิชาของผู้เรียน (ขั้น 4.7 ก)
 * พับ / เปิดหน่วย (ขข2) + หน่วยว่าง (กฝ1) + โหลดไม่สำเร็จ + ขอลิงก์ใหม่ผ่านแคชจริงของหน้า (ขง1)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม ; ข้อมูลสมมติทั้งหมด
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import * as contentApi from '../../../api/content'
import type { StudentContent, StudentModule } from '../../../api/content'
import * as coursesApi from '../../../api/courses'
import StudentCoursePage from '../StudentCoursePage'
import { makeContent } from '../content/testData'
import { LINK_FRESH_MS } from './useFreshLinks'

vi.mock('../../../api/courses', async (importOriginal) => ({
  ...(await importOriginal<typeof coursesApi>()),
  fetchStudentCourse: vi.fn(),
}))
vi.mock('../../../api/content', async (importOriginal) => ({
  ...(await importOriginal<typeof contentApi>()),
  fetchStudentModules: vi.fn(),
}))
const fetchStudentCourse = vi.mocked(coursesApi.fetchStudentCourse)
const fetchStudentModules = vi.mocked(contentApi.fetchStudentModules)

const pdf = (link: string): StudentContent =>
  makeContent(11, {
    content_type: 'file',
    title: 'สไลด์บทที่ 3',
    file_name: 'slides.pdf',
    file_size: 2048,
    mime_type: 'application/pdf',
    file_link: `/media/${link}.pdf`,
    download_link: `/media/${link}.pdf?dl`,
  })

function modules(link = 'old'): StudentModule[] {
  return [
    {
      id: 1,
      title: 'ก้าวแรกกับ Python',
      description: 'เริ่มจาก **print**\n\n# ติดตั้ง',
      contents: [makeContent(10, { title: 'สรุปก่อนเรียน', body: 'สวัสดี Python' }), pdf(link)],
    },
    { id: 2, title: 'ฟังก์ชัน', description: '', contents: [] },
  ]
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/courses/:courseId', element: <StudentCoursePage /> }], {
    initialEntries: ['/courses/5'],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

const moduleButton = (name: RegExp) => screen.getByRole('button', { name })

beforeEach(() => {
  vi.resetAllMocks()
  fetchStudentCourse.mockResolvedValue({
    id: 5,
    academic_year: 2569,
    semester: 1,
    code: '204111',
    name: 'Python พื้นฐาน',
    description: '',
    teacher: { id: 7, first_name: 'กมล', last_name: 'ศรีวงศ์', is_active: true },
    is_closed: false,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('บทเรียนของผู้เรียน', () => {
  it('หัวข้อ + จำนวนหน่วย ; ทุกหน่วยพับตอนเข้าหน้า (ขข2) ; หน่วยว่างบอก "ยังไม่มีเนื้อหา" (กฝ1)', async () => {
    fetchStudentModules.mockResolvedValue(modules())
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'บทเรียน' })).toBeInTheDocument()
    expect(screen.getByText('2 หน่วย')).toBeInTheDocument()
    const first = moduleButton(/ก้าวแรกกับ Python/)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(first).toHaveTextContent('2 รายการ')
    expect(moduleButton(/ฟังก์ชัน/)).toHaveTextContent('ยังไม่มีเนื้อหา')
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
    expect(fetchStudentModules).toHaveBeenCalledWith(5)
  })

  it('เปิดหน่วย: คำอธิบาย + เนื้อหาเรียงต่อกัน ; เปิดได้หลายหน่วยพร้อมกัน ; กดซ้ำพับ', async () => {
    fetchStudentModules.mockResolvedValue(modules())
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: /ก้าวแรกกับ Python/ }))
    const first = moduleButton(/ก้าวแรกกับ Python/)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    const body = document.getElementById(first.getAttribute('aria-controls')!)!
    expect(within(body).getByText('print').tagName).toBe('STRONG')
    expect(
      within(body)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['ติดตั้ง', 'สรุปก่อนเรียน', 'สไลด์บทที่ 3'])
    // หัวหน่วยอยู่ใน h3 (ลำดับหัวข้อ h1 → h2 บทเรียน → h3 หน่วย → h4 เนื้อหา)
    expect(screen.getByRole('heading', { level: 3, name: /ก้าวแรกกับ Python/ })).toBeInTheDocument()
    // หัวข้อในคำอธิบายหน่วยอยู่ใต้ชื่อหน่วย → h4 (แก้หลังตรวจขั้น 4.7 ก)
    expect(within(body).getByRole('heading', { name: 'ติดตั้ง' }).tagName).toBe('H4')

    await user.click(moduleButton(/ฟังก์ชัน/))
    expect(moduleButton(/ฟังก์ชัน/)).toHaveAttribute('aria-expanded', 'true')
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('ยังไม่มีเนื้อหาในหน่วยนี้')).toBeInTheDocument()

    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('สรุปก่อนเรียน')).not.toBeInTheDocument()
  })

  it('ยังไม่มีหน่วยที่เผยแพร่ → กล่อง "ยังไม่มีเนื้อหาในรายวิชานี้" เดิม', async () => {
    fetchStudentModules.mockResolvedValue([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'ยังไม่มีเนื้อหาในรายวิชานี้' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'บทเรียน' })).not.toBeInTheDocument()
  })

  it('โหลดไม่สำเร็จ → ข้อความ + ลองใหม่', async () => {
    fetchStudentModules.mockRejectedValueOnce(new ApiError(500, 'server_error'))
    fetchStudentModules.mockResolvedValueOnce(modules())
    const user = renderPage()

    expect(await screen.findByText('โหลดบทเรียนไม่สำเร็จ')).toBeInTheDocument()
    // บอกเหตุผลแบบเดียวกับหน้าโหลดวิชาไม่สำเร็จ (แก้หลังตรวจขั้น 4.7 ก)
    expect(screen.getByRole('alert')).toHaveTextContent('ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง')
    await user.click(screen.getByRole('button', { name: 'ลองใหม่' }))
    expect(await screen.findByRole('heading', { name: 'บทเรียน' })).toBeInTheDocument()
  })
})

describe('ลิงก์หมดอายุผ่านแคชของหน้า (ขง1)', () => {
  it('ข้อมูลเก่ากว่า 50 นาที: กดดาวน์โหลด → โหลดรายการใหม่ 1 ครั้ง แล้วดาวน์โหลดด้วยลิงก์ใหม่', async () => {
    const clicked: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute('href') ?? '')
    })
    fetchStudentModules.mockResolvedValueOnce(modules('old')).mockResolvedValueOnce(modules('new'))
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: /ก้าวแรกกับ Python/ }))

    // เวลาผ่านไป 51 นาทีหลังได้ข้อมูล
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + LINK_FRESH_MS + 60_000)
    await user.click(screen.getByRole('link', { name: 'ดาวน์โหลด slides.pdf' }))

    await waitFor(() => expect(clicked).toEqual(['/media/new.pdf?dl']))
    expect(fetchStudentModules).toHaveBeenCalledTimes(2)
  })

  it('กดหลายปุ่มพร้อมกันระหว่างรอ → ขอรายการใหม่ครั้งเดียว', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    let resolveSecond: (value: StudentModule[]) => void = () => undefined
    fetchStudentModules
      .mockResolvedValueOnce(modules('old'))
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)))
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: /ก้าวแรกกับ Python/ }))

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + LINK_FRESH_MS + 60_000)
    await user.click(screen.getByRole('link', { name: 'ดาวน์โหลด slides.pdf' }))
    await user.click(screen.getByRole('link', { name: 'เปิด slides.pdf ในแท็บใหม่' }))
    resolveSecond(modules('new'))

    await waitFor(() => expect(tab.location.href).toBe('/media/new.pdf'))
    expect(fetchStudentModules).toHaveBeenCalledTimes(2)
  })
})
