/**
 * test ของหน้ารายวิชา /courses/:courseId (ขั้น 3.6): หัวรายวิชา, แท็บผู้เรียน, หน้าต่างเพิ่มผู้เรียน
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import * as coursesApi from '../../api/courses'
import * as enrollmentsApi from '../../api/enrollments'
import type { PreviewRow } from '../../api/enrollments'
import {
  emptyResult,
  makeCourse,
  makeEnrollment,
  makeStudent,
  renderCoursePage as renderPage,
  roster,
} from './testUtils'

vi.mock('../../api/courses', async (importOriginal) => ({
  ...(await importOriginal<typeof coursesApi>()),
  fetchCourse: vi.fn(),
}))
vi.mock('../../api/enrollments', async (importOriginal) => ({
  ...(await importOriginal<typeof enrollmentsApi>()),
  fetchRoster: vi.fn(),
  searchCandidates: vi.fn(),
  previewStudents: vi.fn(),
  addStudents: vi.fn(),
  dropStudent: vi.fn(),
}))
const fetchCourse = vi.mocked(coursesApi.fetchCourse)
const fetchRoster = vi.mocked(enrollmentsApi.fetchRoster)
const searchCandidates = vi.mocked(enrollmentsApi.searchCandidates)
const previewStudents = vi.mocked(enrollmentsApi.previewStudents)
const addStudents = vi.mocked(enrollmentsApi.addStudents)
const dropStudent = vi.mocked(enrollmentsApi.dropStudent)

beforeEach(() => {
  vi.resetAllMocks()
  fetchCourse.mockResolvedValue(makeCourse())
  fetchRoster.mockResolvedValue(roster([makeEnrollment(1), makeEnrollment(2)]))
})

describe('หัวรายวิชา', () => {
  it('แสดงชื่อ ภาคเรียน ผู้สอน สถานะ รหัสเข้าร่วม และจำนวนผู้เรียนบนแท็บ', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Python พื้นฐาน' })).toBeInTheDocument()
    expect(screen.getByText('ปีการศึกษา 2569 ภาคเรียนที่ 1')).toBeInTheDocument()
    expect(screen.getByText('ผู้สอน กมล ศรีวงศ์')).toBeInTheDocument()
    expect(screen.getByText('เผยแพร่แล้ว')).toBeInTheDocument()
    expect(screen.getByText('K7Q2XM9A')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ผู้เรียน/ })).toHaveTextContent('2')
  })

  it('ปิดการใช้รหัส → ไม่แสดงรหัสเข้าร่วม', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ join_code_enabled: false }))
    renderPage()

    await screen.findByRole('heading', { name: 'Python พื้นฐาน' })
    expect(screen.queryByText('K7Q2XM9A')).not.toBeInTheDocument()
  })

  it('ไม่มีวิชานี้หรือไม่มีสิทธิ์ (404) → "ไม่พบรายวิชา" พร้อมลิงก์กลับ', async () => {
    fetchCourse.mockRejectedValue(new ApiError(404, 'not_found'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบรายวิชา')
    expect(screen.getByRole('link', { name: 'รายวิชาของฉัน' })).toHaveAttribute('href', '/courses')
  })

  it('ที่อยู่ที่ไม่ใช่ตัวเลข → "ไม่พบรายวิชา" โดยไม่เรียก API', async () => {
    renderPage('/courses/abc')

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบรายวิชา')
    expect(fetchCourse).not.toHaveBeenCalled()
  })

  it('โหลดไม่สำเร็จ → ปุ่มลองอีกครั้ง', async () => {
    fetchCourse.mockRejectedValueOnce(new ApiError(0, 'network_error'))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'ลองอีกครั้ง' }))

    expect(await screen.findByRole('heading', { name: 'Python พื้นฐาน' })).toBeInTheDocument()
  })
})

describe('แท็บผู้เรียน', () => {
  it('แสดงรายชื่อ วิธีเข้าร่วม และป้ายบัญชีถูกระงับ', async () => {
    fetchRoster.mockResolvedValue(
      roster([
        makeEnrollment(1),
        makeEnrollment(2, { method: 'teacher', student: makeStudent(2, { is_active: false }) }),
      ]),
    )
    renderPage()

    const table = await screen.findByRole('table')
    expect(within(table).getByText('ชื่อ1 สกุล1')).toBeInTheDocument()
    expect(within(table).getByText('รหัสเข้าร่วม')).toBeInTheDocument()
    expect(within(table).getByText('เพิ่มโดยผู้สอน')).toBeInTheDocument()
    expect(within(table).getByText('บัญชีถูกระงับ')).toBeInTheDocument()
  })

  it('กดตัวกรอง "ถูกถอน" → ขอรายชื่อใหม่ และแถวมีปุ่มเพิ่มกลับ', async () => {
    const { user } = renderPage()
    await screen.findByRole('table')
    fetchRoster.mockResolvedValue(
      roster(
        [makeEnrollment(3, { status: 'dropped', dropped_at: '2026-07-01T03:00:00Z' })],
        { active: 2, dropped: 1 },
      ),
    )

    await user.click(screen.getByRole('button', { name: /ถูกถอน/ }))

    await waitFor(() =>
      expect(fetchRoster).toHaveBeenLastCalledWith(5, { status: 'dropped', search: '', page: 1 }),
    )
    const table = await screen.findByRole('table')
    expect(await within(table).findAllByRole('button', { name: 'เพิ่มกลับ' })).toHaveLength(1)
    expect(within(table).getByText('ถอนเมื่อ')).toBeInTheDocument()
  })

  it('เพิ่มกลับไม่สำเร็จเพราะบัญชีถูกระงับ → แถบแดงบอกเหตุผล', async () => {
    fetchRoster.mockResolvedValue(
      roster([makeEnrollment(3, { status: 'dropped' })], { active: 0, dropped: 1 }),
    )
    addStudents.mockResolvedValue({
      ...emptyResult,
      failed: [{ identifier: '670513', reason: 'suspended' }],
    })
    const { user } = renderPage('/courses/5?status=dropped')

    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: 'เพิ่มกลับ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('เพิ่ม ชื่อ3 สกุล3 กลับไม่สำเร็จ: บัญชีถูกระงับ')
  })

  it('ถอนต้องยืนยัน → ถอนแล้วมีแถบเขียวและโหลดข้อมูลใหม่', async () => {
    dropStudent.mockResolvedValue(makeEnrollment(1, { status: 'dropped' }))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'ถอน ชื่อ1 สกุล1' }))
    const dialog = screen.getByRole('alertdialog', { name: 'ถอน ชื่อ1 สกุล1 ออกจากรายวิชา?' })
    expect(dropStudent).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'ถอน' }))

    expect(await screen.findByText('ถอน ชื่อ1 สกุล1 ออกจากรายวิชาแล้ว')).toBeInTheDocument()
    expect(dropStudent).toHaveBeenCalledWith(5, 1)
    expect(fetchCourse).toHaveBeenCalledTimes(2)
  })

  it('ยังไม่มีผู้เรียน → ข้อความชวนเพิ่ม', async () => {
    fetchRoster.mockResolvedValue(roster([]))
    renderPage()

    expect(await screen.findByText('ยังไม่มีผู้เรียนในรายวิชานี้')).toBeInTheDocument()
  })

  it('วิชาที่ปิดแล้ว → ไม่มีปุ่มเพิ่มและปุ่มถอน', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_closed: true }))
    renderPage()

    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'เพิ่มผู้เรียน' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ถอน ชื่อ1 สกุล1' })).not.toBeInTheDocument()
  })
})

describe('หน้าต่างเพิ่มผู้เรียน', () => {
  async function openDialog() {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'เพิ่มผู้เรียน' }))
    return { user, dialog: screen.getByRole('dialog', { name: 'เพิ่มผู้เรียน' }) }
  }

  /** ไปแท็บรายการ แล้ววางข้อความ */
  async function openList(text: string) {
    const opened = await openDialog()
    await opened.user.click(
      within(opened.dialog).getByRole('button', { name: 'วางรายการหรือเลือกไฟล์' }),
    )
    if (text) {
      await opened.user.type(
        within(opened.dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน'),
        text,
      )
    }
    return opened
  }

  const ROWS: PreviewRow[] = [
    { identifier: '670511', result: 'add', student: makeStudent(11) },
    { identifier: '670519', result: 'not_found', student: null },
    { identifier: '670512', result: 'reactivate', student: makeStudent(12) },
    { identifier: '670513', result: 'already', student: makeStudent(13) },
  ]

  it('ค้นหาทีละคน: กดเพิ่ม → ป้ายเพิ่มแล้ว ; ปิดหน้าต่างแล้วไม่ขึ้นแถบเขียว (ไม่ดันตาราง)', async () => {
    searchCandidates.mockResolvedValue([
      { ...makeStudent(11), enrollment_status: null },
      { ...makeStudent(12), enrollment_status: 'dropped' },
      { ...makeStudent(13), enrollment_status: 'active' },
    ])
    addStudents.mockResolvedValue({
      ...emptyResult,
      added: [{ identifier: '6705111', student: makeStudent(11) }],
    })
    const { user, dialog } = await openDialog()

    await user.type(within(dialog).getByLabelText('ค้นหาผู้เรียน'), 'ชื่อ')
    const add = await within(dialog).findByRole('button', { name: 'เพิ่ม ชื่อ11 สกุล11' })
    expect(within(dialog).getByRole('button', { name: 'เพิ่มกลับ ชื่อ12 สกุล12' })).toBeInTheDocument()
    expect(within(dialog).getByText('อยู่ในรายวิชาแล้ว')).toBeInTheDocument()
    await user.click(add)

    expect(await within(dialog).findByText('เพิ่มแล้ว')).toBeInTheDocument()
    expect(addStudents).toHaveBeenCalledWith(5, ['6705111'])
    await user.click(within(dialog).getByRole('button', { name: 'เสร็จ' }))
    // ขั้น 3.6 รอบ 3 แบบ ท1: หน้าต่างรายงานผลแล้ว จึงไม่ขึ้นแถบเขียวซ้ำที่หน้า
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText(/คนแล้ว/)).not.toBeInTheDocument()
  })

  it('กดเพิ่มคนที่มีคนอื่นเพิ่มไปก่อนแล้ว → ไม่นับเป็นคนที่เพิ่ม', async () => {
    searchCandidates.mockResolvedValue([{ ...makeStudent(11), enrollment_status: null }])
    addStudents.mockResolvedValue({
      ...emptyResult,
      already: [{ identifier: '6705111', student: makeStudent(11) }],
    })
    const { user, dialog } = await openDialog()
    await user.type(within(dialog).getByLabelText('ค้นหาผู้เรียน'), 'ชื่อ')
    const add = await within(dialog).findByRole('button', { name: 'เพิ่ม ชื่อ11 สกุล11' })
    searchCandidates.mockResolvedValue([{ ...makeStudent(11), enrollment_status: 'active' }])

    await user.click(add)

    expect(await within(dialog).findByText('อยู่ในรายวิชาแล้ว')).toBeInTheDocument()
    expect(within(dialog).queryByText('เพิ่มแล้ว')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'เสร็จ' }))
    expect(screen.queryByText(/คนแล้ว/)).not.toBeInTheDocument()
  })

  it('เพิ่มจากแท็บรายการ → ผลค้นหาในแท็บค้นหาโหลดใหม่', async () => {
    searchCandidates.mockResolvedValue([{ ...makeStudent(11), enrollment_status: null }])
    previewStudents.mockResolvedValue({
      rows: [{ identifier: '6705111', result: 'add', student: makeStudent(11) }],
      duplicates: 0,
    })
    addStudents.mockResolvedValue({
      ...emptyResult,
      added: [{ identifier: '6705111', student: makeStudent(11) }],
    })
    const { user, dialog } = await openDialog()
    await user.type(within(dialog).getByLabelText('ค้นหาผู้เรียน'), 'ชื่อ')
    await within(dialog).findByRole('button', { name: 'เพิ่ม ชื่อ11 สกุล11' })
    searchCandidates.mockResolvedValue([{ ...makeStudent(11), enrollment_status: 'active' }])

    await user.click(within(dialog).getByRole('button', { name: 'วางรายการหรือเลือกไฟล์' }))
    await user.type(within(dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน'), '6705111')
    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))
    await user.click(await within(dialog).findByRole('button', { name: 'เพิ่มผู้เรียน 1 คน' }))
    await within(dialog).findByText('เพิ่มผู้เรียน 1 คนแล้ว')
    await user.click(within(dialog).getByRole('button', { name: 'ค้นหาทีละคน' }))

    expect(await within(dialog).findByText('อยู่ในรายวิชาแล้ว')).toBeInTheDocument()
  })

  it('อ่านไฟล์ไม่ได้ แล้ววางรายการตรวจผ่าน → กลับมาแก้ ข้อความไฟล์เดิมไม่ค้าง', async () => {
    previewStudents.mockResolvedValue({ rows: ROWS, duplicates: 0 })
    const { user, dialog } = await openList('670511')
    await user.upload(
      within(dialog).getByLabelText('เลือกไฟล์'),
      new File(['ลำดับ,ชื่อ\n1,ก\n'], 'ห้อง.csv', { type: 'text/csv' }),
    )
    await within(dialog).findByRole('alert')

    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))
    await user.click(await within(dialog).findByRole('button', { name: 'แก้รายการ' }))

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ตรวจไฟล์ไม่สำเร็จ แล้วแก้รายการเอง → ไม่อ้างชื่อไฟล์เดิม', async () => {
    previewStudents.mockRejectedValueOnce(new ApiError(0, 'network_error'))
    previewStudents.mockResolvedValue({ rows: ROWS, duplicates: 0 })
    const { user, dialog } = await openList('')
    await user.upload(
      within(dialog).getByLabelText('เลือกไฟล์'),
      new File(['670511\n'], 'ห้อง.txt', { type: 'text/plain' }),
    )
    await within(dialog).findByRole('alert')

    await user.type(within(dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน'), '2')
    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))

    expect(await within(dialog).findByText('รายการที่วาง')).toBeInTheDocument()
    expect(within(dialog).queryByText('ห้อง.txt')).not.toBeInTheDocument()
  })

  it('พิมพ์ 1 ตัวอักษร → ยังไม่ค้นหา', async () => {
    const { user, dialog } = await openDialog()

    await user.type(within(dialog).getByLabelText('ค้นหาผู้เรียน'), 'ช')
    await new Promise((resolve) => setTimeout(resolve, 350))

    expect(searchCandidates).not.toHaveBeenCalled()
  })

  it('ตรวจรายการ → ตารางเรียงแถวมีปัญหาก่อน และปุ่มนับเฉพาะคนที่จะเพิ่ม', async () => {
    previewStudents.mockResolvedValue({ rows: ROWS, duplicates: 1 })
    const { user, dialog } = await openList('670511{enter}670511{enter}670519')

    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))

    const table = await within(dialog).findByRole('table')
    expect(previewStudents).toHaveBeenCalledWith(5, ['670511', '670511', '670519'])
    const results = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[3]?.textContent)
    expect(results).toEqual(['ไม่พบผู้ใช้นี้', 'เพิ่มกลับ', 'อยู่ในรายวิชาแล้ว', 'จะเพิ่ม'])
    expect(within(dialog).getByText('รายการซ้ำ 1 รายการ')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'เพิ่มผู้เรียน 2 คน' })).toBeEnabled()
    expect(addStudents).not.toHaveBeenCalled()
  })

  it('เอาออกจากตาราง → ไม่ส่งแถวนั้น ; รายงานผลและเหลือรายการที่เพิ่มไม่ได้ในช่อง', async () => {
    previewStudents.mockResolvedValue({ rows: ROWS, duplicates: 1 })
    addStudents.mockResolvedValue({
      added: [],
      reactivated: [{ identifier: '670512', student: makeStudent(12) }],
      already: [{ identifier: '670513', student: makeStudent(13) }],
      failed: [{ identifier: '670519', reason: 'not_found' }],
    })
    const { user, dialog } = await openList('670511')
    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))
    const table = await within(dialog).findByRole('table')

    await user.click(within(table).getByRole('button', { name: 'เอา 6705111 ออก' }))
    await user.click(within(dialog).getByRole('button', { name: 'เพิ่มผู้เรียน 1 คน' }))

    expect(addStudents).toHaveBeenCalledWith(5, ['670519', '670512', '670513'])
    // จำนวนรวมนับคนที่เพิ่มกลับด้วย ตรงกับตัวเลขบนปุ่ม (ขั้น 3.6 รอบ 3 แบบ ธ1)
    expect(await within(dialog).findByText('เพิ่มผู้เรียน 1 คนแล้ว')).toBeInTheDocument()
    expect(within(dialog).getByText(/^รวมเพิ่มกลับ 1 คนที่เคยถูกถอน \(6705112 ชื่อ12 สกุล12\)/)).toBeInTheDocument()
    expect(within(dialog).getByText('รายการซ้ำ 1 รายการ นับครั้งเดียว')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน')).toHaveValue('670519')
  })

  it('ไม่มีคนที่เพิ่มได้ → ปุ่มเพิ่มกดไม่ได้', async () => {
    previewStudents.mockResolvedValue({
      rows: [{ identifier: '670519', result: 'not_found', student: null }],
      duplicates: 0,
    })
    const { user, dialog } = await openList('670519')

    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))

    expect(await within(dialog).findByRole('button', { name: 'เพิ่มผู้เรียน 0 คน' })).toBeDisabled()
  })

  it('แก้รายการ → กลับไปช่องเดิม รายการยังอยู่', async () => {
    previewStudents.mockResolvedValue({ rows: ROWS, duplicates: 0 })
    const { user, dialog } = await openList('670511')
    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))

    await user.click(await within(dialog).findByRole('button', { name: 'แก้รายการ' }))

    expect(within(dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน')).toHaveValue('670511')
  })

  it('เลือกไฟล์ → รายการจากไฟล์แทนที่รายการเดิม ตรวจทันที และเอาไฟล์ออกแล้วช่องว่าง', async () => {
    previewStudents.mockResolvedValue({
      rows: [{ identifier: '670511', result: 'add', student: makeStudent(11) }],
      duplicates: 0,
    })
    const { user, dialog } = await openList('รายการเดิม')
    const file = new File(['รหัสนักศึกษา\n670511\n'], 'ห้อง.csv', { type: 'text/csv' })

    await user.upload(within(dialog).getByLabelText('เลือกไฟล์'), file)

    expect(await within(dialog).findByText('ห้อง.csv')).toBeInTheDocument()
    expect(within(dialog).getByText('คอลัมน์ "รหัสนักศึกษา" พบ 1 รายการ')).toBeInTheDocument()
    expect(previewStudents).toHaveBeenCalledWith(5, ['670511'])

    await user.click(within(dialog).getByRole('button', { name: 'เอาไฟล์ออก' }))
    expect(within(dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน')).toHaveValue('')
  })

  it('อ่านไฟล์ไม่ได้ → บอกสาเหตุ และรายการเดิมในช่องไม่เปลี่ยน', async () => {
    const { user, dialog } = await openList('670511')
    const file = new File(['ลำดับ,ชื่อ\n1,ก\n'], 'ห้อง.csv', { type: 'text/csv' })

    await user.upload(within(dialog).getByLabelText('เลือกไฟล์'), file)

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('อ่านรายการจาก ห้อง.csv ไม่ได้')
    expect(alert).toHaveTextContent('ไม่พบคอลัมน์รหัสนักศึกษาหรืออีเมล')
    expect(within(dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน')).toHaveValue('670511')
    expect(previewStudents).not.toHaveBeenCalled()
  })

  it('เกิน 500 บรรทัด → แจ้งเตือนก่อนส่ง', async () => {
    const { user, dialog } = await openDialog()
    await user.click(within(dialog).getByRole('button', { name: 'วางรายการหรือเลือกไฟล์' }))
    const box = within(dialog).getByLabelText('รหัสนักศึกษาหรืออีเมล บรรทัดละ 1 คน')
    await user.click(box)
    await user.paste(Array.from({ length: 501 }, (_, index) => `s${index}`).join('\n'))

    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('มี 501 รายการ เกินสูงสุด 500 รายการ')
    expect(previewStudents).not.toHaveBeenCalled()
  })

  it('ช่องว่าง → ปุ่มตรวจรายการกดไม่ได้', async () => {
    const { user, dialog } = await openDialog()
    await user.click(within(dialog).getByRole('button', { name: 'วางรายการหรือเลือกไฟล์' }))

    expect(within(dialog).getByRole('button', { name: 'ตรวจรายการ' })).toBeDisabled()
  })

  it('วิชาถูกปิดระหว่างตรวจ → ข้อความในหน้าต่าง และโหลดข้อมูลวิชาใหม่', async () => {
    previewStudents.mockRejectedValue(new ApiError(409, 'course_closed'))
    const { user, dialog } = await openList('670511')

    await user.click(within(dialog).getByRole('button', { name: 'ตรวจรายการ' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('รายวิชานี้ปิดแล้ว')
    await waitFor(() => expect(fetchCourse).toHaveBeenCalledTimes(2))
  })
})
