/**
 * test ของหน้าต่างอัปโหลดหลายไฟล์ในแท็บเนื้อหา (ขั้น 4.6 ข)
 * — เลือก / ลากไฟล์, ตรวจไฟล์ในหน้าเว็บ, ส่งทีละไฟล์, เอาออก / ยกเลิก / ลองใหม่ / หยุดไฟล์ที่เหลือ,
 *   สรุปผล, เกิน 20 ไฟล์ (กห1), ปิดหน้าต่างระหว่างส่ง, หยุดทั้งคิวเมื่อวิชาถูกปิด
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import * as contentApi from '../../../api/content'
import type { Content, Module } from '../../../api/content'
import * as coursesApi from '../../../api/courses'
import { UploadAbortedError, type UploadOptions } from '../../../api/upload'
import { makeCourse, renderCoursePage } from '../testUtils'
import ContentTab from './ContentTab'
import { makeContent, makeModule } from './testData'

vi.mock('../../../api/courses', async (importOriginal) => ({
  ...(await importOriginal<typeof coursesApi>()),
  fetchCourse: vi.fn(),
}))
vi.mock('../../../api/content', async (importOriginal) => ({
  ...(await importOriginal<typeof contentApi>()),
  fetchModules: vi.fn(),
  uploadContentFile: vi.fn(),
}))
const fetchCourse = vi.mocked(coursesApi.fetchCourse)
const api = vi.mocked(contentApi)

const MODULES: Module[] = [
  makeModule(1, { title: 'ก้าวแรกกับ Python' }),
  makeModule(3, { title: 'โครงสร้างควบคุมทิศทาง' }),
]
const MB = 1024 * 1024

/** ไฟล์สมมติ (ตั้งขนาดเองได้โดยไม่ต้องสร้างข้อมูลจริง) */
function makeFile(name: string, size = 1000): File {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

/** การส่ง 1 ครั้งที่ test สั่งได้ว่าจะสำเร็จ / ไม่สำเร็จเมื่อไร (หยุดได้ด้วย signal เหมือนตัวจริง) */
type PendingUpload = {
  file: File
  options: UploadOptions
  resolve: (content: Content) => void
  reject: (error: unknown) => void
}
function controlUploads(): PendingUpload[] {
  const pending: PendingUpload[] = []
  api.uploadContentFile.mockImplementation(
    (_course, _module, file, options = {}) =>
      new Promise<Content>((resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new UploadAbortedError()))
        pending.push({ file, options, resolve, reject })
      }),
  )
  return pending
}

const uploaded = (id: number) => makeContent(id, { module: 3, content_type: 'file' })

beforeEach(() => {
  vi.resetAllMocks()
  fetchCourse.mockResolvedValue(makeCourse())
  api.fetchModules.mockResolvedValue(MODULES)
})

/** เปิดหน่วยที่ 2 แล้วกด "อัปโหลดไฟล์" → คืนหน้าต่าง */
async function openUpload() {
  const view = renderCoursePage('/courses/5', null, <ContentTab />)
  await view.user.click(await screen.findByRole('button', { name: /โครงสร้างควบคุมทิศทาง/, expanded: false }))
  await view.user.click(screen.getByRole('button', { name: 'อัปโหลดไฟล์ในหน่วยที่ 2' }))
  const dialog = await screen.findByRole('dialog', { name: 'อัปโหลดไฟล์' })
  return { ...view, dialog }
}

/** เลือกไฟล์ในช่องเลือกไฟล์ที่ซ่อนอยู่ (ไม่ผ่านตัวกรอง accept — ทดสอบตัวตรวจของหน้าเว็บเอง) */
function choose(dialog: HTMLElement, files: File[]) {
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

/** แถวของไฟล์ชื่อนี้ */
const row = (dialog: HTMLElement, name: string) => within(dialog).getByText(name).closest('li') as HTMLElement

describe('ปุ่มและหน้าต่าง', () => {
  it('ปุ่มอัปโหลดไฟล์ท้ายหน่วย → หน้าต่างมีกล่องเลือกไฟล์ + ตารางชนิดไฟล์ โฟกัสปุ่มเลือกไฟล์', async () => {
    const { dialog } = await openUpload()
    expect(within(dialog).getByText('หน่วยที่ 2 โครงสร้างควบคุมทิศทาง')).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'เลือกไฟล์ที่จะอัปโหลด' })).toBeInTheDocument()
    expect(
      within(dialog).getByText('เลือกได้ครั้งละไม่เกิน 20 ไฟล์ ระบบดูชนิดจากไฟล์เอง'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('100 MB')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'เลือกไฟล์' })).toHaveFocus()
    // ช่องเลือกไฟล์เลือกได้หลายไฟล์ + กรองนามสกุลที่รับ
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.multiple).toBe(true)
    expect(input.accept).toContain('.pdf')
    expect(input.accept).not.toContain('.exe')
  })

  it('ยังไม่เลือกไฟล์ → ยกเลิกปิดได้ทันที', async () => {
    const { user, dialog } = await openUpload()
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('เลือกไฟล์และส่ง', () => {
  it('ไฟล์ที่ใช้ไม่ได้ขึ้นแดงและข้าม ไฟล์อื่นส่งต่อ → สรุปผล', async () => {
    api.uploadContentFile.mockResolvedValue(uploaded(50))
    const { user, dialog } = await openUpload()
    const pdf = makeFile('while-for-loop.pdf', 2 * MB)
    choose(dialog, [pdf, makeFile('ใบงาน3.exe'), makeFile('lecture-week3-full.mp4', 312 * MB)])

    expect(within(row(dialog, 'ใบงาน3.exe')).getByText('ไม่รองรับไฟล์ .exe')).toBeInTheDocument()
    const video = row(dialog, 'lecture-week3-full.mp4')
    expect(within(video).getByText('วิดีโอ 312.0 MB ใหญ่เกิน 100.0 MB')).toBeInTheDocument()
    expect(within(video).getByText('อัปโหลดขึ้น YouTube แล้วใช้ "เพิ่มลิงก์" แทน')).toBeInTheDocument()

    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')).toBeInTheDocument()
    expect(within(dialog).getByText('อัปโหลดไม่ได้ 2 ไฟล์')).toBeInTheDocument()
    expect(within(row(dialog, 'while-for-loop.pdf')).getByText('อัปโหลดแล้ว')).toBeInTheDocument()
    // ส่งเฉพาะไฟล์ที่ผ่าน เข้าหน่วยที่กด
    expect(api.uploadContentFile).toHaveBeenCalledTimes(1)
    expect(api.uploadContentFile).toHaveBeenCalledWith(5, 3, pdf, expect.anything())
    // รายการโหลดใหม่หลังส่งสำเร็จ
    await waitFor(() => expect(api.fetchModules).toHaveBeenCalledTimes(2))

    await user.click(within(dialog).getByRole('button', { name: 'เสร็จ' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('เลือกเกิน 20 ไฟล์ → ไม่รับทั้งชุด (กห1)', async () => {
    const { dialog } = await openUpload()
    choose(
      dialog,
      Array.from({ length: 21 }, (_, index) => makeFile(`บท${index}.pdf`)),
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'เลือกได้ครั้งละไม่เกิน 20 ไฟล์ (เลือกมา 21 ไฟล์) กรุณาเลือกใหม่',
    )
    expect(within(dialog).queryByRole('listitem')).not.toBeInTheDocument()
    expect(api.uploadContentFile).not.toHaveBeenCalled()
  })

  it('ลากไฟล์มาวางในหน้าต่างได้', async () => {
    api.uploadContentFile.mockResolvedValue(uploaded(50))
    const { dialog } = await openUpload()
    const file = makeFile('ผังงาน.png')
    fireEvent.drop(within(dialog).getByRole('group', { name: 'เลือกไฟล์ที่จะอัปโหลด' }), {
      dataTransfer: { files: [file] },
    })
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')).toBeInTheDocument()
    expect(api.uploadContentFile).toHaveBeenCalledWith(5, 3, file, expect.anything())
  })

  it('ส่งทีละไฟล์: แถวที่รอคิวเอาออกได้ ; ความคืบหน้า → ส่งครบแล้วซ่อนปุ่มยกเลิก', async () => {
    const pending = controlUploads()
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf', 4 * MB), makeFile('b.pdf'), makeFile('c.pdf')])

    await waitFor(() => expect(pending).toHaveLength(1))
    expect(within(row(dialog, 'b.pdf')).getByText('รอคิว')).toBeInTheDocument()
    expect(within(dialog).getByText('อัปโหลดแล้ว 0 จาก 3 ไฟล์')).toBeInTheDocument()

    // เอาไฟล์ที่รอคิวออก → โฟกัสหัวรายการ
    await user.click(within(dialog).getByRole('button', { name: 'เอาออก b.pdf' }))
    expect(within(dialog).queryByText('b.pdf')).not.toBeInTheDocument()
    expect(within(dialog).getByText('ไฟล์ที่เลือก 2 ไฟล์')).toHaveFocus()

    // ความคืบหน้า
    act(() => pending[0]!.options.onProgress?.({ loaded: 2 * MB, total: 4 * MB }))
    const first = row(dialog, 'a.pdf')
    expect(within(first).getByText('2.0 MB จาก 4.0 MB (50%)')).toBeInTheDocument()
    expect(within(first).getByRole('progressbar', { name: 'ความคืบหน้า a.pdf' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    // ส่งครบทุกไบต์ → ไม่มีปุ่มยกเลิก (กศ1)
    act(() => pending[0]!.options.onSent?.())
    expect(within(first).getByText('ส่งไฟล์ครบแล้ว กำลังบันทึก…')).toBeInTheDocument()
    expect(within(first).queryByRole('button', { name: /ยกเลิก/ })).not.toBeInTheDocument()

    act(() => pending[0]!.resolve(uploaded(50)))
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[1]!.file.name).toBe('c.pdf')
    act(() => pending[1]!.resolve(uploaded(51)))
    expect(await within(dialog).findByText('อัปโหลดแล้ว 2 ไฟล์')).toBeInTheDocument()
  })

  it('ยกเลิกไฟล์ที่กำลังส่ง → ไฟล์ถัดไปส่งต่อ', async () => {
    const pending = controlUploads()
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('a.mp4'), makeFile('b.pdf')])
    await waitFor(() => expect(pending).toHaveLength(1))

    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิกการอัปโหลด a.mp4' }))
    expect(await within(row(dialog, 'a.mp4')).findByText('ยกเลิกแล้ว')).toBeInTheDocument()
    await waitFor(() => expect(pending).toHaveLength(2))
    act(() => pending[1]!.resolve(uploaded(51)))
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')).toBeInTheDocument()
    expect(within(dialog).getByText('ยกเลิก 1 ไฟล์')).toBeInTheDocument()
  })

  it('หยุดไฟล์ที่เหลือ: หยุดไฟล์ที่กำลังส่ง + ล้างคิว (กอ1) → อัปโหลดไฟล์อื่นเพิ่มได้', async () => {
    const pending = controlUploads()
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf'), makeFile('b.pdf')])
    await waitFor(() => expect(pending).toHaveLength(1))
    expect(within(dialog).getByRole('button', { name: 'กำลังอัปโหลด…' })).toBeDisabled()

    const stop = within(dialog).getByRole('button', { name: 'หยุดไฟล์ที่เหลือ' })
    await user.click(stop)
    expect(await within(dialog).findByText('ยกเลิก 2 ไฟล์')).toBeInTheDocument()
    expect(pending).toHaveLength(1)
    // ปุ่มเดิมเปลี่ยนชื่อในตำแหน่งเดิม — โฟกัสไม่หลุด
    const more = within(dialog).getByRole('button', { name: 'อัปโหลดไฟล์อื่นเพิ่ม' })
    expect(more).toHaveFocus()
    await user.click(more)
    expect(within(dialog).queryByRole('listitem')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'เลือกไฟล์ที่จะอัปโหลด' })).toBeInTheDocument()
  })

  it('หยุดไฟล์ที่เหลือหลังส่งครบแล้ว → ไฟล์นั้นบันทึกต่อจนเสร็จ ล้างแค่คิว', async () => {
    const pending = controlUploads()
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf'), makeFile('b.pdf')])
    await waitFor(() => expect(pending).toHaveLength(1))
    act(() => pending[0]!.options.onSent?.())

    await user.click(within(dialog).getByRole('button', { name: 'หยุดไฟล์ที่เหลือ' }))
    expect(within(row(dialog, 'b.pdf')).getByText('ยกเลิกแล้ว')).toBeInTheDocument()
    act(() => pending[0]!.resolve(uploaded(50)))
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')).toBeInTheDocument()
    expect(pending).toHaveLength(1)
  })
})

describe('ส่งไม่สำเร็จ', () => {
  it('เน็ตหลุด → ลองใหม่ได้ (กฬ1) ; ไฟล์ผิดจากเซิร์ฟเวอร์ → ไม่มีปุ่มลองใหม่', async () => {
    api.uploadContentFile
      .mockRejectedValueOnce(new ApiError(0, 'network_error'))
      .mockRejectedValueOnce(new ApiError(400, 'content_file_mismatch'))
      .mockResolvedValueOnce(uploaded(50))
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf'), makeFile('แบบฝึกหัด.pdf')])

    expect(await within(dialog).findByText('อัปโหลดไม่ได้ 2 ไฟล์')).toBeInTheDocument()
    expect(
      within(row(dialog, 'a.pdf')).getByText('ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ'),
    ).toBeInTheDocument()
    const mismatch = row(dialog, 'แบบฝึกหัด.pdf')
    expect(
      within(mismatch).getByText('เนื้อไฟล์ไม่ตรงกับนามสกุล ไฟล์อาจเสียหรือถูกเปลี่ยนชื่อ'),
    ).toBeInTheDocument()
    expect(within(mismatch).queryByRole('button')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'ลองอัปโหลด a.pdf อีกครั้ง' }))
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')).toBeInTheDocument()
    expect(within(dialog).getByText('อัปโหลดไม่ได้ 1 ไฟล์')).toBeInTheDocument()
  })

  it('ใหญ่เกินตามเซิร์ฟเวอร์ → ใช้เพดานจริงที่ส่งมา (max_bytes)', async () => {
    api.uploadContentFile.mockRejectedValue(
      new ApiError(400, 'content_file_too_large', {}, '', { code: 'content_file_too_large', max_bytes: 40 }),
    )
    const { dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf', 100)])
    expect(await within(dialog).findByText('เอกสาร 100 ไบต์ ใหญ่เกิน 40 ไบต์')).toBeInTheDocument()
  })

  it('รายวิชาถูกปิดกลางทาง → หยุดทั้งคิว + บอกเหตุผล', async () => {
    api.uploadContentFile.mockRejectedValue(new ApiError(409, 'course_closed'))
    const { dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf'), makeFile('b.pdf')])
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'หยุดอัปโหลดไฟล์ที่เหลือแล้ว: รายวิชานี้ปิดแล้ว แก้ไขไม่ได้',
    )
    expect(api.uploadContentFile).toHaveBeenCalledTimes(1)
    expect(within(row(dialog, 'b.pdf')).getByText('ยกเลิกแล้ว')).toBeInTheDocument()
  })
})

describe('ปิดหน้าต่างระหว่างส่ง', () => {
  it('ถามยืนยัน: อัปโหลดต่อ = อยู่ต่อ ; หยุดและปิด = หยุดไฟล์ที่ส่งอยู่แล้วปิด', async () => {
    const pending = controlUploads()
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf')])
    await waitFor(() => expect(pending).toHaveLength(1))

    await user.click(within(dialog).getByRole('button', { name: 'ปิด' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'หยุดอัปโหลดแล้วปิดหน้าต่าง?' })
    await user.click(within(confirm).getByRole('button', { name: 'อัปโหลดต่อ' }))
    expect(screen.getByRole('dialog', { name: 'อัปโหลดไฟล์' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'หยุดและปิด' }),
    )
    expect(screen.queryByRole('dialog', { name: 'อัปโหลดไฟล์' })).not.toBeInTheDocument()
    expect(pending[0]!.options.signal?.aborted).toBe(true)
  })
})

describe('แก้หลังตรวจขั้น 4.6 ข (กฮ1)', () => {
  it('ส่งจบ → กล่องเลือกไฟล์หาย โฟกัสไปหัวรายการ (ไม่หลุดไปต้นหน้า)', async () => {
    api.uploadContentFile.mockResolvedValue(uploaded(50))
    const { dialog } = await openUpload()
    expect(within(dialog).getByRole('button', { name: 'เลือกไฟล์' })).toHaveFocus()
    choose(dialog, [makeFile('a.pdf')])
    await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')
    expect(within(dialog).getByText('ไฟล์ที่เลือก 1 ไฟล์')).toHaveFocus()
  })

  it('เลือกเฉพาะไฟล์ที่ใช้ไม่ได้ → ขึ้นสรุปทันที โฟกัสไปหัวรายการ', async () => {
    const { dialog } = await openUpload()
    choose(dialog, [makeFile('a.exe')])
    await within(dialog).findByText('อัปโหลดไม่ได้ 1 ไฟล์')
    expect(within(dialog).getByText('ไฟล์ที่เลือก 1 ไฟล์')).toHaveFocus()
  })

  it('คิวเดินขณะโฟกัสปุ่ม "เอาออก" ของไฟล์ถัดไป → ปุ่มเปลี่ยนเป็น "ยกเลิก" โฟกัสไปหัวรายการ', async () => {
    const pending = controlUploads()
    const { dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf'), makeFile('b.pdf')])
    await waitFor(() => expect(pending).toHaveLength(1))
    within(dialog).getByRole('button', { name: 'เอาออก b.pdf' }).focus()
    act(() => pending[0]!.resolve(uploaded(50)))
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(within(dialog).getByText('ไฟล์ที่เลือก 2 ไฟล์')).toHaveFocus()
  })

  it('วางไฟล์พลาดนอกพื้นที่รับระหว่างหน้าต่างเปิด → เบราว์เซอร์ไม่เปิดไฟล์ ; ปิดแล้วกลับเป็นปกติ', async () => {
    const { user, dialog } = await openUpload()
    // fireEvent คืน false = มีคนสั่ง preventDefault (เบราว์เซอร์จะไม่เปิดไฟล์)
    expect(fireEvent.drop(document.body, { dataTransfer: { files: [] } })).toBe(false)
    expect(fireEvent.dragOver(document.body)).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }))
    expect(fireEvent.drop(document.body, { dataTransfer: { files: [] } })).toBe(true)
  })

  it('หน้าต่างยืนยันบอกว่าไฟล์ที่ยังส่งไม่ครบเท่านั้นที่ไม่ถูกอัปโหลด', async () => {
    const pending = controlUploads()
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf')])
    await waitFor(() => expect(pending).toHaveLength(1))
    await user.click(within(dialog).getByRole('button', { name: 'ปิด' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'ไฟล์ที่รอคิวและไฟล์ที่ยังส่งไม่ครบจะไม่ถูกอัปโหลด ไฟล์ที่อัปโหลดแล้วยังอยู่ในหน่วย',
    )
  })

  it('error ที่ระบบไม่รู้สาเหตุ (unknown) และเซิร์ฟเวอร์ขัดข้อง (5xx) → มีปุ่มลองใหม่', async () => {
    api.uploadContentFile
      .mockRejectedValueOnce(new ApiError(413, 'unknown'))
      .mockRejectedValueOnce(new ApiError(503, 'file_upload_failed'))
    const { dialog } = await openUpload()
    choose(dialog, [makeFile('a.pdf'), makeFile('b.pdf')])
    await within(dialog).findByText('อัปโหลดไม่ได้ 2 ไฟล์')
    expect(within(row(dialog, 'a.pdf')).getByText('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'ลองอัปโหลด a.pdf อีกครั้ง' })).toBeInTheDocument()
    expect(
      within(row(dialog, 'b.pdf')).getByText('อัปโหลดไม่สำเร็จ พื้นที่เก็บไฟล์อาจเต็ม ติดต่อผู้ดูแลระบบ'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'ลองอัปโหลด b.pdf อีกครั้ง' })).toBeInTheDocument()
  })

  it('ออกจากหน้าระหว่างส่ง (กล1): ถามก่อน — อัปโหลดต่อ = อยู่หน้าเดิม ; หยุดและออก = หยุดไฟล์แล้วออก', async () => {
    const pending = controlUploads()
    const { user, dialog, router } = await openUpload()
    choose(dialog, [makeFile('a.pdf')])
    await waitFor(() => expect(pending).toHaveLength(1))

    act(() => void router.navigate('/courses'))
    const ask = await screen.findByRole('alertdialog', { name: 'ออกจากหน้านี้ระหว่างอัปโหลด?' })
    await user.click(within(ask).getByRole('button', { name: 'อัปโหลดต่อ' }))
    expect(router.state.location.pathname).toBe('/courses/5')
    expect(screen.getByRole('dialog', { name: 'อัปโหลดไฟล์' })).toBeInTheDocument()

    act(() => void router.navigate('/courses'))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'หยุดและออก' }),
    )
    expect(await screen.findByText('หน้ารายวิชาของฉัน')).toBeInTheDocument()
    expect(pending[0]!.options.signal?.aborted).toBe(true)
  })
})
