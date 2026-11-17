/**
 * test ของหน้าต่างเพิ่ม / แก้เนื้อหาในแท็บเนื้อหา (ขั้น 4.6 ก)
 * — เขียนข้อความ, เพิ่มลิงก์, แก้ข้อความ / ไฟล์ / ลิงก์, ย้ายหน่วย, สวิตช์ดาวน์โหลด, เปลี่ยนไฟล์ (กว1)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import * as contentApi from '../../../api/content'
import type { Module } from '../../../api/content'
import * as coursesApi from '../../../api/courses'
import { UploadAbortedError } from '../../../api/upload'
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
  createTextContent: vi.fn(),
  createLinkContent: vi.fn(),
  updateContent: vi.fn(),
  replaceContentFile: vi.fn(),
}))
const fetchCourse = vi.mocked(coursesApi.fetchCourse)
const api = vi.mocked(contentApi)

const TEXT = makeContent(10, { title: 'สรุปก่อนเรียน', body: 'เนื้อความเดิม' })
const PDF = makeContent(11, {
  module: 2,
  title: 'สไลด์: while และ for loop',
  content_type: 'file',
  file_name: 'while-for-loop.pdf',
  file_size: 2.1 * 1024 * 1024,
  mime_type: 'application/pdf',
  file_link: '/media/content/5/a.pdf',
  download_link: '/media/content/5/a.pdf',
  allow_download: false,
  can_disable_download: true,
})
const DOCX = makeContent(14, {
  module: 2,
  title: 'ใบงาน',
  content_type: 'file',
  file_name: 'ใบงาน.docx',
  file_size: 340 * 1024,
  file_link: '/media/content/5/b.docx',
  download_link: '/media/content/5/b.docx',
  can_disable_download: false,
})
const LINK = makeContent(15, {
  module: 2,
  title: 'เอกสาร Python',
  content_type: 'link',
  external_url: 'https://docs.python.org/3/',
})

const MODULES: Module[] = [
  makeModule(1, { title: 'ก้าวแรกกับ Python', contents: [TEXT] }),
  makeModule(2, { title: 'โครงสร้างควบคุมทิศทาง', contents: [PDF, DOCX, LINK] }),
  makeModule(3, { title: 'ฟังก์ชัน' }),
]

const renderTab = () => renderCoursePage('/courses/5', null, <ContentTab />)

beforeEach(() => {
  vi.resetAllMocks()
  fetchCourse.mockResolvedValue(makeCourse())
  api.fetchModules.mockResolvedValue(MODULES)
})

/** เปิดหน่วยที่มีชื่อนี้ */
async function openModule(user: ReturnType<typeof renderTab>['user'], title: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(title), expanded: false }))
}

/** เลือกไฟล์ในช่องเลือกไฟล์ที่ซ่อนอยู่ของหน้าต่าง (ไม่ผ่านตัวกรอง accept — ทดสอบตัวตรวจของหน้าเว็บเอง) */
function chooseFile(dialog: HTMLElement, file: File) {
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('เขียนข้อความ', () => {
  it('หัวข้อห้ามว่าง → ดูตัวอย่าง Markdown ได้ → บันทึกต่อท้ายหน่วยที่กด', async () => {
    const { user } = renderTab()
    await openModule(user, 'ฟังก์ชัน')
    await user.click(screen.getByRole('button', { name: 'เขียนข้อความในหน่วยที่ 3' }))

    const dialog = await screen.findByRole('dialog', { name: 'เขียนข้อความ' })
    expect(within(dialog).getByText('หน่วยที่ 3 ฟังก์ชัน')).toBeInTheDocument()
    expect(within(dialog).getByText(/เนื้อหาใหม่ยังไม่เผยแพร่/)).toBeInTheDocument()
    const title = within(dialog).getByLabelText('ชื่อหัวข้อ')
    await waitFor(() => expect(title).toHaveFocus())

    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))
    expect(within(dialog).getByText('กรุณากรอกข้อมูลช่องนี้')).toBeInTheDocument()
    expect(api.createTextContent).not.toHaveBeenCalled()

    await user.type(title, '  สรุปบท  ')
    await user.type(within(dialog).getByLabelText('เนื้อความ'), 'เงื่อนไข **สำคัญ**')
    await user.click(within(dialog).getByRole('button', { name: 'ดูตัวอย่าง' }))
    expect(within(dialog).getByRole('button', { name: 'ดูตัวอย่าง' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByText('สำคัญ').tagName).toBe('STRONG')

    api.createTextContent.mockResolvedValue(makeContent(20, { module: 3, title: 'สรุปบท' }))
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    expect(api.createTextContent).toHaveBeenCalledWith(5, 3, { title: 'สรุปบท', body: 'เงื่อนไข **สำคัญ**' })
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(api.fetchModules).toHaveBeenCalledTimes(2)
  })
})

describe('เพิ่มลิงก์', () => {
  it('บอกชนิดที่ผู้เรียนจะเห็น ; ไม่กรอกหัวข้อไม่ส่ง title ; ลิงก์ผิดรูปแบบขึ้นใต้ช่อง', async () => {
    const { user } = renderTab()
    await openModule(user, 'โครงสร้างควบคุมทิศทาง')
    await user.click(screen.getByRole('button', { name: 'เพิ่มลิงก์ในหน่วยที่ 2' }))
    const dialog = await screen.findByRole('dialog', { name: 'เพิ่มลิงก์' })
    const url = within(dialog).getByLabelText('ลิงก์')

    await user.type(url, 'https://docs.python.org/3/')
    expect(within(dialog).getByText('ลิงก์เว็บไซต์ · ผู้เรียนกดเปิดในแท็บใหม่')).toBeInTheDocument()
    // ลิงก์ช่อง YouTube (ไม่มีรหัสวิดีโอ) → backend เก็บเป็นลิงก์เว็บ คำแนะนำต้องตรงกัน (กศ1)
    await user.clear(url)
    await user.type(url, 'https://www.youtube.com/@channel')
    expect(within(dialog).getByText('ลิงก์เว็บไซต์ · ผู้เรียนกดเปิดในแท็บใหม่')).toBeInTheDocument()
    await user.clear(url)
    await user.type(url, 'https://youtu.be/Zp5MuPOtsSY')
    expect(within(dialog).getByText('วิดีโอจาก YouTube · ผู้เรียนดูได้ในหน้าบทเรียนเลย')).toBeInTheDocument()

    api.createLinkContent
      .mockRejectedValueOnce(new ApiError(400, 'validation_error', { url: ['invalid'] }))
      .mockResolvedValueOnce(makeContent(21, { module: 2, content_type: 'video' }))
    await user.click(within(dialog).getByRole('button', { name: 'เพิ่มลิงก์' }))
    expect(await within(dialog).findByText('รูปแบบไม่ถูกต้อง')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'เพิ่มลิงก์' }))
    expect(api.createLinkContent).toHaveBeenLastCalledWith(5, 2, { url: 'https://youtu.be/Zp5MuPOtsSY' })
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })
})

describe('แก้ไขเนื้อหา', () => {
  it('ไม่ได้แก้อะไร → ปิดหน้าต่างโดยไม่ส่งคำขอ', async () => {
    const { user } = renderTab()
    await openModule(user, 'ก้าวแรกกับ Python')
    await user.click(screen.getByRole('button', { name: 'แก้ไข สรุปก่อนเรียน' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })

    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(api.updateContent).not.toHaveBeenCalled()
  })

  it('ข้อความ: ชนิดล็อก ; ย้ายหน่วย → ส่งเฉพาะ module แล้วเปิดหน่วยปลายทาง + โฟกัสหัวข้อ', async () => {
    const { user } = renderTab()
    await openModule(user, 'ก้าวแรกกับ Python')
    await user.click(screen.getByRole('button', { name: 'แก้ไข สรุปก่อนเรียน' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })
    expect(within(dialog).getByText('ชนิดเนื้อหาเปลี่ยนหลังสร้างแล้วไม่ได้')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('เนื้อความ')).toHaveValue('เนื้อความเดิม')

    await user.selectOptions(within(dialog).getByLabelText('อยู่ในหน่วย'), '3. ฟังก์ชัน')
    api.updateContent.mockResolvedValue({ ...TEXT, module: 3 })
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    expect(api.updateContent).toHaveBeenCalledWith(5, 10, { module: 3 })
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /ฟังก์ชัน/, expanded: true })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'หน่วยการเรียน' })).toHaveFocus())
  })

  it('ไฟล์ที่ปิดดาวน์โหลดได้: สวิตช์ + เปลี่ยนไฟล์ (ชนิดผิดไม่รับ) → ส่งไฟล์ก่อนแล้วค่อยบันทึกช่องอื่น (กว1)', async () => {
    const { user } = renderTab()
    await openModule(user, 'โครงสร้างควบคุมทิศทาง')
    await user.click(screen.getByRole('button', { name: 'แก้ไข สไลด์: while และ for loop' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })
    expect(within(dialog).getByText('ระบบตั้งจากไฟล์ เปลี่ยนภายหลังไม่ได้')).toBeInTheDocument()
    expect(within(dialog).getByText('while-for-loop.pdf')).toBeInTheDocument()

    const toggle = within(dialog).getByRole('switch', { name: 'ให้ผู้เรียนดาวน์โหลดได้' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    chooseFile(dialog, new File(['x'], 'รูป.png', { type: 'image/png' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('ไฟล์ใหม่ต้องเป็นเอกสารเหมือนไฟล์เดิม')

    const file = new File(['%PDF-1.7'], 'สไลด์ใหม่.pdf', { type: 'application/pdf' })
    chooseFile(dialog, file)
    expect(within(dialog).getByText('สไลด์ใหม่.pdf')).toBeInTheDocument()
    expect(within(dialog).getByText('ไฟล์ใหม่จะแทนที่ไฟล์เดิมเมื่อกดบันทึก')).toBeInTheDocument()

    api.replaceContentFile.mockResolvedValue({ ...PDF, file_name: 'สไลด์ใหม่.pdf' })
    api.updateContent.mockResolvedValue({ ...PDF, allow_download: true })
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(api.replaceContentFile).toHaveBeenCalledWith(5, 11, file, expect.anything())
    expect(api.updateContent).toHaveBeenCalledWith(5, 11, { allow_download: true })
    expect(api.replaceContentFile.mock.invocationCallOrder[0]).toBeLessThan(
      api.updateContent.mock.invocationCallOrder[0]!,
    )
  })

  it('ไฟล์ที่ผู้เรียนต้องดาวน์โหลด: ไม่มีสวิตช์ ; เลือกไฟล์แล้วกดยกเลิก → ไม่ส่งอะไร (ไฟล์เดิมไม่หาย)', async () => {
    const { user } = renderTab()
    await openModule(user, 'โครงสร้างควบคุมทิศทาง')
    await user.click(screen.getByRole('button', { name: 'แก้ไข ใบงาน' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(dialog).getByText('ไฟล์ชนิดนี้ผู้เรียนต้องดาวน์โหลดเพื่อเปิด')).toBeInTheDocument()

    chooseFile(dialog, new File(['x'], 'ใบงานใหม่.xlsx'))
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(api.replaceContentFile).not.toHaveBeenCalled()
    expect(api.updateContent).not.toHaveBeenCalled()
  })

  it('ไฟล์เปลี่ยนแล้วแต่ช่องอื่นบันทึกไม่สำเร็จ → บอกว่าไฟล์เปลี่ยนแล้ว หน้าต่างยังเปิด', async () => {
    const { user } = renderTab()
    await openModule(user, 'โครงสร้างควบคุมทิศทาง')
    await user.click(screen.getByRole('button', { name: 'แก้ไข สไลด์: while และ for loop' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })

    await user.type(within(dialog).getByLabelText('ชื่อหัวข้อ'), ' (ใหม่)')
    chooseFile(dialog, new File(['%PDF'], 'สไลด์ใหม่.pdf'))
    api.replaceContentFile.mockResolvedValue({ ...PDF, file_name: 'สไลด์ใหม่.pdf' })
    api.updateContent.mockRejectedValue(new ApiError(409, 'course_closed'))
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    expect(
      await within(dialog).findByText(
        'เปลี่ยนไฟล์แล้ว แต่บันทึกการแก้ไขอื่นไม่สำเร็จ: รายวิชานี้ปิดแล้ว แก้ไขไม่ได้',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('สไลด์ใหม่.pdf')).toBeInTheDocument()
    expect(within(dialog).queryByText('ไฟล์ใหม่')).not.toBeInTheDocument()
  })

  it('ระหว่างส่งไฟล์มีแถบความคืบหน้า ; กด "หยุดอัปโหลด" → ไม่บันทึกช่องอื่น หน้าต่างยังเปิด', async () => {
    const { user } = renderTab()
    await openModule(user, 'โครงสร้างควบคุมทิศทาง')
    await user.click(screen.getByRole('button', { name: 'แก้ไข สไลด์: while และ for loop' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })

    await user.type(within(dialog).getByLabelText('ชื่อหัวข้อ'), ' (ใหม่)')
    chooseFile(dialog, new File(['%PDF'], 'สไลด์ใหม่.pdf'))
    api.replaceContentFile.mockImplementation(
      (_course, _content, _file, options) =>
        new Promise((_resolve, reject) => {
          options?.onProgress?.({ loaded: 1024 * 1024, total: 4 * 1024 * 1024 })
          options?.signal?.addEventListener('abort', () => reject(new UploadAbortedError()))
        }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    expect(await within(dialog).findByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
    expect(within(dialog).getByText('กำลังอัปโหลด 1.0 MB จาก 4.0 MB (25%)')).not.toHaveAttribute('aria-live')
    expect(within(dialog).getByRole('status')).toHaveTextContent('กำลังอัปโหลดไฟล์…')
    const loads = api.fetchModules.mock.calls.length
    await user.click(within(dialog).getByRole('button', { name: 'หยุดอัปโหลด' }))

    expect(await within(dialog).findByText(/หยุดอัปโหลดแล้ว ไฟล์เดิมยังอยู่/)).toBeInTheDocument()
    // โหลดรายการใหม่เผื่อกดหยุดพร้อมกับที่ไฟล์ส่งครบพอดี (กศ1)
    await waitFor(() => expect(api.fetchModules.mock.calls.length).toBeGreaterThan(loads))
    expect(api.updateContent).not.toHaveBeenCalled()
    expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('ส่งไฟล์ครบแล้ว (รอเซิร์ฟเวอร์บันทึก) → ไม่มีปุ่มหยุด + บอกว่ากำลังบันทึก (กศ1)', async () => {
    const { user } = renderTab()
    await openModule(user, 'โครงสร้างควบคุมทิศทาง')
    await user.click(screen.getByRole('button', { name: 'แก้ไข สไลด์: while และ for loop' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })

    chooseFile(dialog, new File(['%PDF'], 'สไลด์ใหม่.pdf'))
    api.replaceContentFile.mockImplementation(
      (_course, _content, _file, options) =>
        new Promise(() => {
          options?.onProgress?.({ loaded: 4, total: 4 })
          options?.onSent?.()
        }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    expect(await within(dialog).findByRole('status')).toHaveTextContent('ส่งไฟล์ครบแล้ว กำลังบันทึก…')
    expect(within(dialog).getAllByText('ส่งไฟล์ครบแล้ว กำลังบันทึก…')).toHaveLength(2)
    expect(within(dialog).queryByRole('button', { name: 'หยุดอัปโหลด' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'ยกเลิก' })).toBeDisabled()
  })

  it('ลิงก์: แก้ที่อยู่ได้ ; ชนิดเปลี่ยน (content_kind_mismatch) → ข้อความเหนือปุ่ม', async () => {
    const { user } = renderTab()
    await openModule(user, 'โครงสร้างควบคุมทิศทาง')
    await user.click(screen.getByRole('button', { name: 'แก้ไข เอกสาร Python' }))
    const dialog = await screen.findByRole('dialog', { name: 'แก้ไขเนื้อหา' })
    const url = within(dialog).getByLabelText('ลิงก์')
    expect(url).toHaveValue('https://docs.python.org/3/')
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument()

    await user.clear(url)
    await user.type(url, 'https://youtu.be/Zp5MuPOtsSY')
    api.updateContent.mockRejectedValue(new ApiError(409, 'content_kind_mismatch'))
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกเนื้อหา' }))

    expect(api.updateContent).toHaveBeenCalledWith(5, 15, { url: 'https://youtu.be/Zp5MuPOtsSY' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'เปลี่ยนชนิดเนื้อหาไม่ได้ ถ้าต้องการชนิดอื่นให้ลบแล้วเพิ่มใหม่',
    )
  })
})
