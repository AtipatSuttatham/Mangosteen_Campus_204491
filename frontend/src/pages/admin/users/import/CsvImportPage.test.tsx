/**
 * test ของหน้านำเข้าผู้ใช้จาก CSV /users/import (ขั้น 2.7) — 3 ขั้น: เลือกไฟล์ → ตรวจข้อมูล → รับรหัสผ่าน
 * แทนที่ฟังก์ชันเรียก API และการดาวน์โหลดไฟล์ด้วยตัวปลอม (ไม่เรียก backend จริง ไม่สร้างไฟล์จริง)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as adminUsersApi from '../../../../api/adminUsers'
import type { CsvReport, CsvRowError, ImportResult } from '../../../../api/adminUsers'
import { ApiError } from '../../../../api/client'
import * as csvFiles from '../../../../lib/csvFiles'
import { requestLeave } from '../../../../lib/useLeaveGuard'
import CsvImportPage from './CsvImportPage'
import { csvProblemText } from './csvProblem'

vi.mock('../../../../api/adminUsers', async (importOriginal) => ({
  ...(await importOriginal<typeof adminUsersApi>()),
  validateUserImport: vi.fn(),
  importUsers: vi.fn(),
}))
vi.mock('../../../../lib/csvFiles', async (importOriginal) => ({
  ...(await importOriginal<typeof csvFiles>()),
  downloadCsv: vi.fn(),
}))
const validateUserImport = vi.mocked(adminUsersApi.validateUserImport)
const importUsers = vi.mocked(adminUsersApi.importUsers)
const downloadCsv = vi.mocked(csvFiles.downloadCsv)

/** ไฟล์ CSV สมมติ */
const csvFile = (name = 'นักศึกษา_204111.csv', size = 100) =>
  new File(['x'.repeat(size)], name, { type: 'text/csv' })

/** รายงานไฟล์ถูกทุกแถว: 7 แถว (ตัวอย่าง 5 แถวแรก) */
const READY: CsvReport = {
  valid: true,
  total: 7,
  by_role: { student: 6, teacher: 1 },
  errors: [],
  preview: [2, 3, 4, 5, 6].map((row) => ({
    row,
    email: `s${row}@example.com`,
    student_or_staff_id: row === 6 ? null : `69000000${row}`,
    first_name: `ชื่อ${row}`,
    last_name: `สกุล${row}`,
    role: row === 6 ? 'teacher' : 'student',
  })),
}

/** รายงานที่มีแถวผิด: 2 แถว (แถว 3 ผิด 2 ช่อง) */
const PROBLEMS: CsvReport = {
  valid: false,
  total: 4,
  by_role: { student: 3, teacher: 0 },
  errors: [
    { row: 3, column: 'email', code: 'unique', value: 's3@example.com' },
    { row: 3, column: 'first_name', code: 'blank', value: '' },
    { row: 5, column: 'email', code: 'duplicate_in_file', value: 's2@example.com', duplicate_of: 2 },
  ],
  preview: [],
}

/** ผลการนำเข้า (รหัสสมมติ) */
const RESULT: ImportResult = {
  created: 2,
  by_role: { student: 1, teacher: 1 },
  users: [
    { row: 2, id: 31, email: 's2@example.com', student_or_staff_id: '690000002', first_name: 'ก', last_name: 'ข', role: 'student', password: 'hT7kPq4wNx9e' },
    { row: 3, id: 32, email: 't3@example.com', student_or_staff_id: null, first_name: 'ค', last_name: 'ง', role: 'teacher', password: 'Wm4rXc8tLp3a' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

/** วาดหน้า /users/import (router แบบหน่วยความจำ — มีหน้า /users ปลอมให้ลิงก์กลับ) */
function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/users/import', element: <CsvImportPage /> },
      { path: '/users', element: <h1>หน้ารายชื่อผู้ใช้</h1> },
    ],
    { initialEntries: ['/users/import'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  // applyAccept: false = เลือกไฟล์ชนิดอื่นได้ (ทดสอบการตรวจนามสกุลของหน้าเว็บเอง)
  return { user: userEvent.setup({ applyAccept: false }), router }
}

/** เลือกไฟล์ผ่านช่องเลือกไฟล์ */
async function choose(user: ReturnType<typeof renderPage>['user'], file: File) {
  await user.upload(screen.getByTestId('csv-file-input'), file)
}

const currentStep = () =>
  screen.getByRole('list', { name: 'ขั้นตอนการนำเข้า' }).querySelector('[aria-current="step"]')

describe('ขั้น ① เลือกไฟล์', () => {
  it('หัวข้อ + ลิงก์กลับ + แถบขั้นตอนอยู่ขั้นที่ 1 + ตารางคอลัมน์ 5 คอลัมน์', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'นำเข้าผู้ใช้จาก CSV' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'จัดการบัญชีผู้ใช้' })).toHaveAttribute('href', '/users')
    expect(currentStep()).toHaveTextContent('เลือกไฟล์')
    for (const column of ['email', 'student_or_staff_id', 'first_name', 'last_name', 'role']) {
      expect(screen.getByText(column)).toBeInTheDocument()
    }
  })

  it('ไม่ใช่ไฟล์ .csv → บอกให้บันทึกเป็น CSV และไม่ส่งไป backend', async () => {
    const { user } = renderPage()

    await choose(user, new File(['x'], 'รายชื่อ.xlsx'))

    expect(screen.getByRole('alert')).toHaveTextContent('เลือกไฟล์นามสกุล .csv')
    expect(validateUserImport).not.toHaveBeenCalled()
  })

  it('ไฟล์เกิน 1 MB → ข้อความขนาดเกิน และไม่ส่งไป backend', async () => {
    const { user } = renderPage()

    await choose(user, csvFile('ใหญ่.csv', 1024 * 1024 + 1))

    expect(screen.getByRole('alert')).toHaveTextContent('ไฟล์มีขนาดใหญ่เกินไป')
    expect(validateUserImport).not.toHaveBeenCalled()
  })

  it('ไฟล์ผิดทั้งไฟล์ (ขาดคอลัมน์) → ข้อความไทย และยังอยู่ขั้นที่ 1', async () => {
    validateUserImport.mockRejectedValue(new ApiError(400, 'csv_missing_columns', { role: ['required'] }))
    const { user } = renderPage()

    await choose(user, csvFile())

    expect(await screen.findByRole('alert')).toHaveTextContent('ไฟล์ขาดคอลัมน์ที่จำเป็น')
    expect(currentStep()).toHaveTextContent('เลือกไฟล์')
  })

  it('ลากไฟล์มาวางที่ช่อง → ตรวจไฟล์นั้น', async () => {
    validateUserImport.mockResolvedValue(READY)
    renderPage()
    const file = csvFile()

    fireEvent.drop(screen.getByTestId('csv-dropzone'), { dataTransfer: { files: [file] } })

    expect(await screen.findByText('ข้อมูลถูกต้องทุกแถว พร้อมนำเข้า')).toBeInTheDocument()
    expect(validateUserImport).toHaveBeenCalledWith(file)
  })

  it('"ดาวน์โหลดไฟล์ตัวอย่าง" → ไฟล์ตัวอย่างที่มีหัวตาราง 5 คอลัมน์', async () => {
    const { user } = renderPage()

    await user.click(screen.getByRole('button', { name: 'ดาวน์โหลดไฟล์ตัวอย่าง' }))

    expect(downloadCsv).toHaveBeenCalledWith(
      'ตัวอย่างนำเข้าผู้ใช้.csv',
      expect.stringContaining('email,student_or_staff_id,first_name,last_name,role'),
    )
  })
})

describe('ขั้น ② ตรวจข้อมูล — มีแถวผิด', () => {
  it('นับแถวที่มีปัญหา + ตารางแถว/คอลัมน์/ปัญหา/ค่าในไฟล์ ; ค่าว่างแสดง "(ว่าง)"', async () => {
    validateUserImport.mockResolvedValue(PROBLEMS)
    const { user } = renderPage()

    await choose(user, csvFile())

    expect(await screen.findByText('พบปัญหา 2 แถว ยังไม่มีบัญชีใดถูกสร้าง')).toBeInTheDocument()
    expect(currentStep()).toHaveTextContent('ตรวจข้อมูล')
    const table = screen.getByRole('table', { name: 'แถวที่มีปัญหา' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('อีเมลนี้มีผู้ใช้แล้ว')
    expect(rows[1]).toHaveTextContent('ไม่ได้กรอกชื่อ')
    expect(rows[1]).toHaveTextContent('(ว่าง)')
    expect(rows[2]).toHaveTextContent('อีเมลซ้ำกับแถว 2 ในไฟล์นี้')
    expect(screen.queryByRole('button', { name: /นำเข้า/ })).not.toBeInTheDocument()
  })

  it('"เลือกไฟล์ใหม่" → กลับขั้นที่ 1', async () => {
    validateUserImport.mockResolvedValue(PROBLEMS)
    const { user } = renderPage()
    await choose(user, csvFile())

    await user.click(await screen.findByRole('button', { name: 'เลือกไฟล์ใหม่' }))

    expect(currentStep()).toHaveTextContent('เลือกไฟล์')
    expect(screen.getByText('ลากไฟล์ CSV มาวางที่นี่')).toBeInTheDocument()
  })
})

describe('ขั้น ② ตรวจข้อมูล — ถูกทุกแถว', () => {
  it('ตัวเลขสรุป + ตัวอย่าง 5 แถว + "และอีก 2 แถว" + ปุ่ม "นำเข้า 7 บัญชี"', async () => {
    validateUserImport.mockResolvedValue(READY)
    const { user } = renderPage()

    await choose(user, csvFile())

    expect(await screen.findByText('ข้อมูลถูกต้องทุกแถว พร้อมนำเข้า')).toBeInTheDocument()
    expect(screen.getByText('บัญชีทั้งหมด').closest('div')).toHaveTextContent('7')
    expect(screen.getByText('ผู้เรียน', { selector: 'dt' }).closest('div')).toHaveTextContent('6')
    const table = screen.getByRole('table', { name: 'ตัวอย่างบัญชีที่จะนำเข้า' })
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(5)
    expect(screen.getByText('และอีก 2 แถว')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'นำเข้า 7 บัญชี' })).toBeEnabled()
  })

  it('นำเข้า → ส่งไฟล์เดิมซ้ำ → ขั้นที่ 3 "สร้างบัญชีแล้ว" ; ดาวน์โหลดไฟล์รหัสผ่าน (ชื่อไฟล์เดิม + รหัส)', async () => {
    validateUserImport.mockResolvedValue(READY)
    importUsers.mockResolvedValue(RESULT)
    const { user } = renderPage()
    const file = csvFile()
    await choose(user, file)

    await user.click(await screen.findByRole('button', { name: 'นำเข้า 7 บัญชี' }))

    expect(await screen.findByRole('heading', { name: 'สร้างบัญชีแล้ว 2 บัญชี' })).toBeInTheDocument()
    expect(importUsers).toHaveBeenCalledWith(file)
    expect(currentStep()).toHaveTextContent('รับรหัสผ่าน')
    expect(screen.getByText('ผู้เรียน 1 คน ผู้สอน 1 คน จากไฟล์ นักศึกษา_204111.csv')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('ดาวน์โหลดไฟล์รหัสผ่านก่อนออกจากหน้านี้')

    await user.click(screen.getByRole('button', { name: 'ดาวน์โหลดไฟล์รหัสผ่าน' }))

    const [fileName, content] = downloadCsv.mock.calls[0] ?? []
    expect(fileName).toBe('นักศึกษา_204111-รหัสผ่าน.csv')
    expect(content).toContain('s2@example.com,690000002,ก,ข,student,hT7kPq4wNx9e')
    expect(screen.getByRole('status')).toHaveTextContent('ดาวน์โหลดไฟล์รหัสผ่านแล้ว')
    expect(screen.getByRole('button', { name: 'ดาวน์โหลดอีกครั้ง' })).toBeInTheDocument()
  })

  it('มีคนเพิ่มข้อมูลซ้ำระหว่างตรวจกับนำเข้า (csv_invalid) → ตารางปัญหาจากรายงานใหม่ + ข้อความอธิบาย', async () => {
    validateUserImport.mockResolvedValue(READY)
    importUsers.mockRejectedValue(
      new ApiError(400, 'csv_invalid', {}, '', { code: 'csv_invalid', report: PROBLEMS }),
    )
    const { user } = renderPage()
    await choose(user, csvFile())

    await user.click(await screen.findByRole('button', { name: 'นำเข้า 7 บัญชี' }))

    expect(await screen.findByText(/ข้อมูลในระบบเปลี่ยนระหว่างตรวจกับนำเข้า/)).toBeInTheDocument()
    expect(screen.getByText('พบปัญหา 2 แถว ยังไม่มีบัญชีใดถูกสร้าง')).toBeInTheDocument()
  })
})

describe('csvProblemText', () => {
  it('ทุกคู่ (คอลัมน์, รหัส) ที่มีข้อความเฉพาะ แปลได้ (ไม่หลุดเป็นรหัสข้อความ)', () => {
    const cases: [CsvRowError['column'], string][] = [
      ['email', 'unique'],
      ['student_or_staff_id', 'unique'],
      ['email', 'blank'],
      ['first_name', 'blank'],
      ['last_name', 'required'],
      ['role', 'blank'],
      ['email', 'invalid'],
      ['role', 'invalid_choice'],
      ['role', 'csv_admin_not_allowed'],
    ]
    for (const [column, code] of cases) {
      expect(csvProblemText({ row: 2, column, code, value: '' })).not.toMatch(/csvImport/)
    }
  })

  it('รหัสที่ไม่มีข้อความเฉพาะ → ข้อความรายช่องกลาง', () => {
    expect(csvProblemText({ row: 2, column: 'first_name', code: 'max_length', value: 'x' })).toBe(
      'ข้อความยาวเกินกำหนด',
    )
    expect(
      csvProblemText({ row: 4, column: 'student_or_staff_id', code: 'duplicate_in_file', value: '1', duplicate_of: 2 }),
    ).toBe('รหัสซ้ำกับแถว 2 ในไฟล์นี้')
  })
})

describe('ตัวเฝ้าประตู: ยังไม่ดาวน์โหลดไฟล์รหัสผ่าน (ข้อ 2.ก)', () => {
  /** ไปจนถึงขั้นที่ 3 (นำเข้าแล้ว ยังไม่ดาวน์โหลด) */
  async function reachDone() {
    validateUserImport.mockResolvedValue(READY)
    importUsers.mockResolvedValue(RESULT)
    const rendered = renderPage()
    await choose(rendered.user, csvFile())
    await rendered.user.click(await screen.findByRole('button', { name: 'นำเข้า 7 บัญชี' }))
    await screen.findByRole('heading', { name: 'สร้างบัญชีแล้ว 2 บัญชี' })
    return rendered
  }

  it('กดลิงก์ออก → ถามยืนยัน (โฟกัส "อยู่ต่อ") ; อยู่ต่อ = ยังอยู่หน้าเดิม ; ออกจากหน้านี้ = ไปตามลิงก์', async () => {
    const { user } = await reachDone()

    await user.click(screen.getByRole('link', { name: 'จัดการบัญชีผู้ใช้' }))
    const dialog = screen.getByRole('alertdialog', { name: 'ออกโดยยังไม่ดาวน์โหลดไฟล์รหัสผ่าน?' })
    expect(within(dialog).getByRole('button', { name: 'อยู่ต่อ' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'อยู่ต่อ' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สร้างบัญชีแล้ว 2 บัญชี' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'กลับไปจัดการบัญชีผู้ใช้' }))
    await user.click(screen.getByRole('button', { name: 'ออกจากหน้านี้' }))
    expect(await screen.findByRole('heading', { name: 'หน้ารายชื่อผู้ใช้' })).toBeInTheDocument()
  })

  it('ปุ่มย้อนกลับของเบราว์เซอร์ก็ถูกถามยืนยัน', async () => {
    const { router } = await reachDone()

    await act(() => router.navigate(-1))

    expect(screen.getByRole('alertdialog', { name: 'ออกโดยยังไม่ดาวน์โหลดไฟล์รหัสผ่าน?' })).toBeInTheDocument()
  })

  it('ออกจากระบบ (requestLeave) → ถามก่อน และออกจริงเมื่อยืนยันเท่านั้น', async () => {
    const { user } = await reachDone()
    const logout = vi.fn()

    act(() => requestLeave(logout))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'ออกจากหน้านี้' }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('ปิดแท็บ / รีเฟรช → ให้เบราว์เซอร์ถาม (beforeunload)', async () => {
    await reachDone()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('ดาวน์โหลดแล้ว → ออกได้ทันทีไม่ถาม (ทั้งลิงก์และออกจากระบบ)', async () => {
    const { user } = await reachDone()
    await user.click(screen.getByRole('button', { name: 'ดาวน์โหลดไฟล์รหัสผ่าน' }))
    const logout = vi.fn()

    act(() => requestLeave(logout))
    expect(logout).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('link', { name: 'จัดการบัญชีผู้ใช้' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'หน้ารายชื่อผู้ใช้' })).toBeInTheDocument()
  })

  it('ก่อนนำเข้า (ยังไม่มีรหัสผ่าน) ไม่เฝ้าประตู', async () => {
    const { user } = renderPage()
    const logout = vi.fn()

    act(() => requestLeave(logout))
    expect(logout).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('link', { name: 'จัดการบัญชีผู้ใช้' }))
    expect(await screen.findByRole('heading', { name: 'หน้ารายชื่อผู้ใช้' })).toBeInTheDocument()
  })
})
