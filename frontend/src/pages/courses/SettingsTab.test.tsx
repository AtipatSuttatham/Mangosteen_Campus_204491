/**
 * test ของแท็บตั้งค่า /courses/:courseId/settings (ขั้น 3.6)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import * as coursesApi from '../../api/courses'
import SettingsTab from './SettingsTab'
import { makeCourse, renderCoursePage } from './testUtils'

vi.mock('../../api/courses', async (importOriginal) => ({
  ...(await importOriginal<typeof coursesApi>()),
  fetchCourse: vi.fn(),
  updateCourse: vi.fn(),
  runCourseAction: vi.fn(),
  deleteCourse: vi.fn(),
}))
const fetchCourse = vi.mocked(coursesApi.fetchCourse)
const updateCourse = vi.mocked(coursesApi.updateCourse)
const runCourseAction = vi.mocked(coursesApi.runCourseAction)
const deleteCourse = vi.mocked(coursesApi.deleteCourse)

const renderPage = (path: string) => renderCoursePage(path, <SettingsTab />)

beforeEach(() => {
  vi.resetAllMocks()
  fetchCourse.mockResolvedValue(makeCourse())
})

describe('แท็บตั้งค่า', () => {
  it('แก้ข้อมูล → ส่งเฉพาะช่องที่เปลี่ยน ; ป้าย "บันทึกแล้ว" ขึ้นข้างปุ่ม และหายเมื่อแก้อีก', async () => {
    updateCourse.mockResolvedValue(makeCourse({ name: 'Python ขั้นสูง' }))
    const { user } = renderPage('/courses/5/settings')
    const name = await screen.findByLabelText('ชื่อรายวิชา')

    await user.clear(name)
    await user.type(name, ' Python ขั้นสูง ')
    const save = screen.getByRole('button', { name: 'บันทึก' })
    await user.click(save)

    // ขั้น 3.6 รอบ 3 แบบ ท1: ป้ายอยู่ในแถวเดียวกับปุ่มบันทึก (ไม่ใช่แถบด้านบนหน้า)
    const saved = await screen.findByText('บันทึกข้อมูลรายวิชาแล้ว')
    expect(save.parentElement).toContainElement(saved)
    expect(updateCourse).toHaveBeenCalledWith(5, { name: 'Python ขั้นสูง' })
    expect(await screen.findByRole('heading', { name: 'Python ขั้นสูง' })).toBeInTheDocument()

    await user.type(name, 'x')
    expect(screen.queryByText('บันทึกข้อมูลรายวิชาแล้ว')).not.toBeInTheDocument()
  })

  it('ต่างแค่ช่องว่างท้ายชื่อ → ไม่เรียก API และปุ่มกลับเป็นกดไม่ได้', async () => {
    const { user } = renderPage('/courses/5/settings')
    const name = await screen.findByLabelText('ชื่อรายวิชา')

    await user.type(name, '  ')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    await waitFor(() => expect(name).toHaveValue('Python พื้นฐาน'))
    expect(screen.getByRole('button', { name: 'บันทึก' })).toBeDisabled()
    expect(updateCourse).not.toHaveBeenCalled()
  })

  it('ยังไม่แก้อะไร → ปุ่มบันทึกกดไม่ได้', async () => {
    renderPage('/courses/5/settings')

    expect(await screen.findByRole('button', { name: 'บันทึก' })).toBeDisabled()
  })

  it('รหัสวิชาซ้ำ → ข้อความใต้ช่อง', async () => {
    updateCourse.mockRejectedValue(new ApiError(400, 'validation_error', { code: ['course_code_duplicate'] }))
    const { user } = renderPage('/courses/5/settings')
    const code = await screen.findByLabelText('รหัสวิชา')

    await user.clear(code)
    await user.type(code, '204212')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(await screen.findByText('รหัสวิชานี้มีอยู่แล้วในภาคเรียนนี้')).toBeInTheDocument()
  })

  it('เผยแพร่ทำทันที ไม่ถามยืนยัน', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false }))
    runCourseAction.mockResolvedValue(makeCourse())
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'เผยแพร่รายวิชา' }))

    expect(runCourseAction).toHaveBeenCalledWith(5, 'publish')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // ผลขึ้นในส่วน "การเผยแพร่" ที่เพิ่งกด
    const section = screen.getByRole('heading', { name: 'การเผยแพร่' }).closest('section') as HTMLElement
    expect(await within(section).findByText('เผยแพร่รายวิชาแล้ว')).toBeInTheDocument()
  })

  it('ทำรายการไม่สำเร็จ → ข้อความแดงในส่วนที่กด (ขั้น 3.6 รอบ 3)', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false }))
    runCourseAction.mockRejectedValue(new ApiError(409, 'course_closed'))
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'เผยแพร่รายวิชา' }))

    const section = screen.getByRole('heading', { name: 'การเผยแพร่' }).closest('section') as HTMLElement
    expect(await within(section).findByRole('alert')).toHaveTextContent('ทำรายการไม่สำเร็จ')
  })

  it('ยกเลิกเผยแพร่ต้องยืนยัน (ง1)', async () => {
    runCourseAction.mockResolvedValue(makeCourse({ is_published: false }))
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'ยกเลิกการเผยแพร่' }))
    expect(runCourseAction).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิกการเผยแพร่' }))

    expect(runCourseAction).toHaveBeenCalledWith(5, 'unpublish')
    expect(await screen.findByText('ยกเลิกการเผยแพร่แล้ว')).toBeInTheDocument()
  })

  it('สร้างรหัสใหม่ต้องยืนยัน (ค1) และบอกรหัสเดิม', async () => {
    runCourseAction.mockResolvedValue(makeCourse({ join_code: 'ABCD2345' }))
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'สร้างรหัสใหม่' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('รหัสเดิม K7Q2XM9A จะใช้ไม่ได้ทันที')
    await user.click(within(dialog).getByRole('button', { name: 'สร้างรหัสใหม่' }))

    expect(runCourseAction).toHaveBeenCalledWith(5, 'join-code/regenerate')
    expect(await screen.findByText('สร้างรหัสเข้าร่วมใหม่แล้ว')).toBeInTheDocument()
    expect(screen.getAllByText('ABCD2345').length).toBeGreaterThan(0)
  })

  it('สวิตช์รหัสเข้าร่วมทำทันที', async () => {
    runCourseAction.mockResolvedValue(makeCourse({ join_code_enabled: false }))
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('switch', { name: 'เปิดให้ผู้เรียนเข้าร่วมด้วยรหัส' }))

    expect(runCourseAction).toHaveBeenCalledWith(5, 'join-code/disable')
    expect(await screen.findByText('เปิดแล้วระบบสร้างรหัส 8 ตัวให้ทันที')).toBeInTheDocument()
  })

  it('ปิดรายวิชาต้องยืนยัน → ดูได้อย่างเดียว พร้อมข้อความปิดเมื่อ โดย', async () => {
    runCourseAction.mockResolvedValue(
      makeCourse({
        is_closed: true,
        closed_at: '2026-10-01T03:00:00Z',
        closed_by: 'กมล ศรีวงศ์',
        description: '',
      }),
    )
    // ส่วนปิดรายวิชาหายไปหลังปิด → เลื่อนหน้าขึ้นไปให้เห็นแถบและกล่อง "ปิดรายวิชาแล้ว"
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'ปิดรายวิชา' }))
    const dialog = screen.getByRole('alertdialog', { name: 'ปิดรายวิชา Python พื้นฐาน?' })
    expect(dialog).toHaveTextContent('ผู้เรียน 2 คนดูเนื้อหาและคะแนนย้อนหลังได้อย่างเดียว')
    await user.click(within(dialog).getByRole('button', { name: 'ปิดรายวิชา' }))

    expect(await screen.findByText(/ปิดเมื่อ .* โดย กมล ศรีวงศ์/)).toBeInTheDocument()
    expect(screen.getByLabelText('ชื่อรายวิชา')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'บันทึก' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    // ช่องคำอธิบายที่ว่างไม่มีข้อความตัวอย่าง (ดูเหมือนยังกรอกได้) — ขั้น 3.6 รอบ 3
    expect(screen.getByLabelText('คำอธิบายรายวิชา')).not.toHaveAttribute('placeholder')
    scrollTo.mockRestore()
  })

  it('ลบได้ → ยืนยันแล้วกลับหน้ารายวิชาของฉันพร้อมข้อความ', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false, can_delete: true }))
    deleteCourse.mockResolvedValue(undefined)
    const { user, router } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'ลบรายวิชา' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ลบรายวิชา' }))

    expect(await screen.findByText('หน้ารายวิชาของฉัน')).toBeInTheDocument()
    expect(deleteCourse).toHaveBeenCalledWith(5)
    expect(router.state.location.state).toEqual({ notice: 'ลบรายวิชา 204111 Python พื้นฐาน แล้ว' })
  })

  it('ลบไม่ได้แล้ว (มีผู้เรียนเข้าร่วมพอดี) → ข้อความในหน้าต่าง และโหลดข้อมูลใหม่', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false, can_delete: true }))
    deleteCourse.mockRejectedValue(new ApiError(409, 'course_not_deletable'))
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'ลบรายวิชา' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ลบรายวิชา' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ลบรายวิชานี้ไม่ได้')
    await waitFor(() => expect(fetchCourse).toHaveBeenCalledTimes(2))
  })

  // ---- กติกากลางของปุ่ม (settings/useSettingsActions.ts — รอบปรับโครงสร้างหลังขั้น 3.8) ----

  it('ระหว่างรอผลของปุ่มหนึ่ง ปุ่มของส่วนอื่นกดไม่ได้ (ล็อกร่วมกัน)', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false }))
    let finish: (course: coursesApi.Course) => void = () => {}
    runCourseAction.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'เผยแพร่รายวิชา' }))

    // ยังรอผลเผยแพร่ → สวิตช์ในส่วนรหัสเข้าร่วมกดไม่ได้
    expect(screen.getByRole('switch', { name: 'เปิดให้ผู้เรียนเข้าร่วมด้วยรหัส' })).toBeDisabled()
    finish(makeCourse())
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'เปิดให้ผู้เรียนเข้าร่วมด้วยรหัส' })).toBeEnabled(),
    )
  })

  it('ผลมีได้ทีละป้าย: กดปุ่มส่วนอื่น → ป้ายของส่วนเดิมหาย', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false }))
    runCourseAction.mockResolvedValue(makeCourse())
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'เผยแพร่รายวิชา' }))
    expect(await screen.findByText('เผยแพร่รายวิชาแล้ว')).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'เปิดให้ผู้เรียนเข้าร่วมด้วยรหัส' }))

    await waitFor(() => expect(runCourseAction).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('เผยแพร่รายวิชาแล้ว')).not.toBeInTheDocument()
  })

  it('ลบไม่สำเร็จเพราะวิชาเพิ่งถูกเผยแพร่ → หน้าต่างยังเป็นหน้าต่างลบ (ไม่กลายเป็นหน้าต่างปิดรายวิชา)', async () => {
    fetchCourse
      .mockResolvedValueOnce(makeCourse({ is_published: false, can_delete: true }))
      .mockResolvedValue(makeCourse({ is_published: true, can_delete: false }))
    deleteCourse.mockRejectedValue(new ApiError(409, 'course_not_deletable'))
    const { user } = renderPage('/courses/5/settings')

    await user.click(await screen.findByRole('button', { name: 'ลบรายวิชา' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ลบรายวิชา' }))

    // ข้อมูลใหม่มาแล้ว (การ์ดแดงเปลี่ยนเป็นปุ่มปิดรายวิชา) แต่หน้าต่างที่เปิดอยู่ยังเป็นหน้าต่างลบพร้อมข้อความ
    expect(await screen.findByRole('button', { name: 'ปิดรายวิชา' })).toBeInTheDocument()
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('ลบรายวิชา Python พื้นฐาน?')).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('ลบรายวิชานี้ไม่ได้')
  })

  it('วิชายังไม่เผยแพร่และลบไม่ได้ → ไม่มีปุ่มลบและปุ่มปิด', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false, can_delete: false }))
    renderPage('/courses/5/settings')

    await screen.findByRole('button', { name: 'เผยแพร่รายวิชา' })
    expect(screen.queryByRole('button', { name: 'ลบรายวิชา' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ปิดรายวิชา' })).not.toBeInTheDocument()
  })
})
