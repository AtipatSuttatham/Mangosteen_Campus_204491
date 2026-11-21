/**
 * test ของแท็บเนื้อหาของผู้สอน /courses/:courseId (ขั้น 4.5 ; หน้าต่างเพิ่ม / แก้เนื้อหาอยู่ใน ContentDialogs.test.tsx)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import * as contentApi from '../../../api/content'
import type { Module } from '../../../api/content'
import * as coursesApi from '../../../api/courses'
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
  createModule: vi.fn(),
  updateModule: vi.fn(),
  deleteModule: vi.fn(),
  runModuleAction: vi.fn(),
  moveModule: vi.fn(),
  deleteContent: vi.fn(),
  runContentAction: vi.fn(),
  moveContent: vi.fn(),
}))
const fetchCourse = vi.mocked(coursesApi.fetchCourse)
const api = vi.mocked(contentApi)

const PDF = makeContent(11, {
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
const YOUTUBE = makeContent(12, {
  title: 'วิดีโอ: if, elif, else',
  content_type: 'video',
  external_url: 'https://www.youtube.com/watch?v=Zp5MuPOtsSY',
  youtube_id: 'Zp5MuPOtsSY',
  is_published: false,
})

const MODULES: Module[] = [
  makeModule(1, { title: 'ก้าวแรกกับ Python', contents: [makeContent(10, { title: 'สรุปก่อนเรียน' })] }),
  makeModule(2, {
    title: 'โครงสร้างควบคุมทิศทาง',
    description: 'เงื่อนไข **if**',
    contents: [makeContent(13, { title: 'สรุป' }), PDF, YOUTUBE],
  }),
  makeModule(3, { title: 'ลิสต์และดิกชันนารี', is_published: false }),
]

const renderTab = (isAdmin = false) => renderCoursePage('/courses/5', null, <ContentTab />, isAdmin)

beforeEach(() => {
  vi.resetAllMocks()
  fetchCourse.mockResolvedValue(makeCourse())
  api.fetchModules.mockResolvedValue(MODULES)
})

/** การ์ดหน่วยที่มีชื่อนี้ (ค้นจากปุ่มหัวหน่วย) */
async function moduleCard(title: string) {
  const toggle = await screen.findByRole('button', { name: new RegExp(title) })
  return { toggle, card: toggle.closest('li') as HTMLElement }
}

describe('แท็บและรายการหน่วย', () => {
  it('แท็บเนื้อหาเป็นแท็บแรกและเปิดอยู่ที่ /courses/:id (กช1)', async () => {
    renderTab()

    const tabs = await screen.findByRole('navigation', { name: 'ส่วนของรายวิชา' })
    const links = within(tabs).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['เนื้อหา', 'ผู้เรียน2', 'ตั้งค่า'])
    expect(links[0]).toHaveAttribute('aria-current', 'page')
    expect(links[1]).toHaveAttribute('href', '/courses/5/students')
  })

  it('แสดงหน่วยเรียงตามลำดับ + สถิติ + ป้ายสถานะ ; เริ่มต้นพับทุกหน่วย', async () => {
    renderTab()

    expect(await screen.findByText('3 หน่วย')).toBeInTheDocument()
    expect(screen.getByText('เผยแพร่แล้ว 2 หน่วย')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'หน่วยการเรียน' })
    const titles = within(list)
      .getAllByRole('button', { expanded: false })
      .map((button) => button.textContent)
    expect(titles).toEqual([
      expect.stringContaining('ก้าวแรกกับ Python'),
      expect.stringContaining('โครงสร้างควบคุมทิศทาง'),
      expect.stringContaining('ลิสต์และดิกชันนารี'),
    ])
    const { card } = await moduleCard('ลิสต์และดิกชันนารี')
    expect(within(card).getByText('ยังไม่มีเนื้อหา')).toBeInTheDocument()
    expect(within(card).getByText('ยังไม่เผยแพร่')).toBeInTheDocument()
    expect(screen.queryByText('สรุปก่อนเรียน')).not.toBeInTheDocument()
  })

  it('กดหัวหน่วยแล้วเปิดดูคำอธิบาย + เนื้อหาพร้อมรายละเอียดชนิด / ขนาด / ปิดดาวน์โหลด', async () => {
    const { user } = renderTab()
    const { toggle, card } = await moduleCard('โครงสร้างควบคุมทิศทาง')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(card).getByText('if')).toBeInTheDocument()
    expect(within(card).getByText('สไลด์: while และ for loop')).toBeInTheDocument()
    expect(within(card).getByText('PDF')).toBeInTheDocument()
    expect(within(card).getByText('2.1 MB')).toBeInTheDocument()
    expect(within(card).getByText('ปิดการดาวน์โหลด')).toBeInTheDocument()
    expect(within(card).getByText('วิดีโอจาก YouTube')).toBeInTheDocument()
    // เนื้อหาร่างมีป้าย "ยังไม่เผยแพร่"
    const draftRow = within(card).getByText('วิดีโอ: if, elif, else').closest('li') as HTMLElement
    expect(within(draftRow).getByText('ยังไม่เผยแพร่')).toBeInTheDocument()

    await user.click(toggle)
    expect(within(card).queryByText('สไลด์: while และ for loop')).not.toBeInTheDocument()
  })
})

describe('จัดการหน่วย', () => {
  it('เพิ่มหน่วย: ชื่อห้ามว่าง → บันทึกแล้วหน่วยใหม่เปิดให้ทันที', async () => {
    const created = makeModule(4, { title: 'ฟังก์ชัน', is_published: false })
    api.createModule.mockResolvedValue(created)
    const { user } = renderTab()
    await user.click(await screen.findByRole('button', { name: 'เพิ่มหน่วยการเรียน' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/หน่วยใหม่ต่อท้ายรายการและยังไม่เผยแพร่/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกหน่วยการเรียน' }))
    expect(await within(dialog).findByText('กรุณากรอกข้อมูลช่องนี้')).toBeInTheDocument()
    expect(api.createModule).not.toHaveBeenCalled()

    api.fetchModules.mockResolvedValue([...MODULES, created])
    await user.type(within(dialog).getByLabelText('ชื่อหน่วยการเรียน'), '  ฟังก์ชัน ')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกหน่วยการเรียน' }))

    expect(api.createModule).toHaveBeenCalledWith(5, { title: 'ฟังก์ชัน', description: '' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const { toggle } = await moduleCard('ฟังก์ชัน')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('แก้หน่วย: ส่งเฉพาะช่องที่เปลี่ยน', async () => {
    api.updateModule.mockResolvedValue(makeModule(1, { title: 'ก้าวแรก' }))
    const { user } = renderTab()
    await user.click(await screen.findByRole('button', { name: 'แก้ไข หน่วยที่ 1' }))

    const dialog = screen.getByRole('dialog', { name: 'แก้ไขหน่วยการเรียน' })
    const title = within(dialog).getByLabelText('ชื่อหน่วยการเรียน')
    expect(title).toHaveValue('ก้าวแรกกับ Python')
    await user.clear(title)
    await user.type(title, 'ก้าวแรก')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึกหน่วยการเรียน' }))

    await waitFor(() => expect(api.updateModule).toHaveBeenCalledWith(5, 1, { title: 'ก้าวแรก' }))
  })

  it('ปุ่มเลื่อน: ตัวแรกกด ↑ ไม่ได้ ตัวสุดท้ายกด ↓ ไม่ได้ ; กด ↓ ส่งคำสั่งเลื่อน', async () => {
    api.moveModule.mockResolvedValue(makeModule(1))
    const { user } = renderTab()

    expect(await screen.findByRole('button', { name: 'เลื่อน หน่วยที่ 1 ขึ้น' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'เลื่อน หน่วยที่ 3 ลง' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'เลื่อน หน่วยที่ 1 ลง' }))

    expect(api.moveModule).toHaveBeenCalledWith(5, 1, 'down')
    await waitFor(() => expect(api.fetchModules).toHaveBeenCalledTimes(2))
  })

  it('ระหว่างรอผล ปุ่มทุกแถวกดไม่ได้แต่โฟกัสไม่หลุด ; เลื่อนเสร็จโฟกัสกลับที่ลูกศรเดิม (กภ1)', async () => {
    let finishMove: (module: Module) => void = () => {}
    api.moveModule.mockReturnValue(new Promise((resolve) => (finishMove = resolve)))
    const { user } = renderTab()

    const down = await screen.findByRole('button', { name: 'เลื่อน หน่วยที่ 1 ลง' })
    await user.click(down)
    expect(down).toHaveFocus()
    expect(down).toHaveAttribute('aria-disabled', 'true')
    const publish = screen.getByRole('button', { name: 'เผยแพร่ หน่วยที่ 3' })
    expect(publish).toHaveAttribute('aria-disabled', 'true')
    await user.click(publish)
    expect(api.runModuleAction).not.toHaveBeenCalled()

    // backend ตอบ → โหลดรายการใหม่ได้ลำดับ 2, 1, 3 → ปุ่มเดิม (element เดิม) กลายเป็นของ "หน่วยที่ 2"
    api.fetchModules.mockResolvedValue([MODULES[1], MODULES[0], MODULES[2]] as Module[])
    finishMove(makeModule(1))
    await waitFor(() => expect(down).toHaveAccessibleName('เลื่อน หน่วยที่ 2 ลง'))
    await waitFor(() => expect(down).not.toHaveAttribute('aria-disabled'))
    expect(down).toHaveFocus()
  })

  it('เลื่อนจนถึงบนสุด → โฟกัสย้ายไปลูกศรลงของแถวเดียวกัน (กภ1)', async () => {
    api.moveModule.mockResolvedValue(makeModule(2))
    const { user } = renderTab()
    const { card } = await moduleCard('โครงสร้างควบคุมทิศทาง')
    const up = within(card).getByRole('button', { name: 'เลื่อน หน่วยที่ 2 ขึ้น' })
    const down = within(card).getByRole('button', { name: 'เลื่อน หน่วยที่ 2 ลง' })

    api.fetchModules.mockResolvedValue([MODULES[1], MODULES[0], MODULES[2]] as Module[])
    await user.click(up)

    expect(api.moveModule).toHaveBeenCalledWith(5, 2, 'up')
    await waitFor(() => expect(up).toBeDisabled())
    await waitFor(() => expect(down).toHaveFocus())
    expect(down).toHaveAccessibleName('เลื่อน หน่วยที่ 1 ลง')
  })

  it('เผยแพร่ / ยกเลิกเผยแพร่ตามสถานะของหน่วย', async () => {
    api.runModuleAction.mockResolvedValue(makeModule(1))
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'ยกเลิกเผยแพร่ หน่วยที่ 1' }))
    await waitFor(() => expect(api.runModuleAction).toHaveBeenCalledWith(5, 1, 'unpublish'))
    await user.click(screen.getByRole('button', { name: 'เผยแพร่ หน่วยที่ 3' }))
    await waitFor(() => expect(api.runModuleAction).toHaveBeenCalledWith(5, 3, 'publish'))
  })

  it('ทำไม่สำเร็จ → แถบแดงบอกเหตุผล', async () => {
    api.runModuleAction.mockRejectedValue(new ApiError(409, 'course_closed'))
    const { user } = renderTab()

    await user.click(await screen.findByRole('button', { name: 'ยกเลิกเผยแพร่ หน่วยที่ 1' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ทำรายการไม่สำเร็จ: รายวิชานี้ปิดแล้ว แก้ไขไม่ได้',
    )
  })

  it('ลบหน่วย: ยืนยันก่อน (บอกจำนวนเนื้อหาที่หายตาม + แนะนำยกเลิกเผยแพร่) → แถบเขียว', async () => {
    api.deleteModule.mockResolvedValue(undefined)
    const { user } = renderTab()
    await user.click(await screen.findByRole('button', { name: 'ลบ หน่วยที่ 2' }))

    const dialog = screen.getByRole('alertdialog', { name: 'ลบหน่วยการเรียน "โครงสร้างควบคุมทิศทาง"?' })
    expect(within(dialog).getByText(/เนื้อหา 3 รายการในหน่วยนี้จะถูกลบไปด้วย/)).toBeInTheDocument()
    expect(within(dialog).getByText(/ให้กดยกเลิกเผยแพร่แทน/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'ยกเลิก' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'ลบหน่วยการเรียน' }))

    expect(api.deleteModule).toHaveBeenCalledWith(5, 2)
    expect(await screen.findByText('ลบหน่วยการเรียน "โครงสร้างควบคุมทิศทาง" แล้ว')).toHaveAttribute(
      'role',
      'status',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('ลบสำเร็จ → โฟกัสหัวข้อ "หน่วยการเรียน" (ปุ่มลบหายไปพร้อมแถว — กภ1)', async () => {
    api.deleteModule.mockResolvedValue(undefined)
    const { user } = renderTab()
    await user.click(await screen.findByRole('button', { name: 'ลบ หน่วยที่ 3' }))

    api.fetchModules.mockResolvedValue(MODULES.slice(0, 2))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ลบหน่วยการเรียน' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'หน่วยการเรียน' })).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'ลบ หน่วยที่ 3' })).not.toBeInTheDocument()
  })

  it('ลบไม่สำเร็จ → ข้อความในหน้าต่าง หน้าต่างยังเปิด', async () => {
    api.deleteModule.mockRejectedValue(new ApiError(409, 'course_closed'))
    const { user } = renderTab()
    await user.click(await screen.findByRole('button', { name: 'ลบ หน่วยที่ 3' }))

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('หน่วยนี้ยังไม่มีเนื้อหา')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'ลบหน่วยการเรียน' }))

    expect(await within(dialog).findByText('รายวิชานี้ปิดแล้ว แก้ไขไม่ได้')).toBeInTheDocument()
  })
})

describe('จัดการแถวเนื้อหา', () => {
  it('เลื่อน / เผยแพร่ / ลบเนื้อหา (ลบไฟล์บอกว่าไฟล์หายตาม)', async () => {
    api.moveContent.mockResolvedValue(PDF)
    api.runContentAction.mockResolvedValue(YOUTUBE)
    api.deleteContent.mockResolvedValue(undefined)
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)

    expect(screen.getByRole('button', { name: 'เลื่อน สรุป ขึ้น' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'เลื่อน สไลด์: while และ for loop ขึ้น' }))
    await waitFor(() => expect(api.moveContent).toHaveBeenCalledWith(5, 11, 'up'))

    await user.click(screen.getByRole('button', { name: 'เผยแพร่ วิดีโอ: if, elif, else' }))
    await waitFor(() => expect(api.runContentAction).toHaveBeenCalledWith(5, 12, 'publish'))

    await user.click(screen.getByRole('button', { name: 'ลบ สไลด์: while และ for loop' }))
    const dialog = screen.getByRole('alertdialog', { name: 'ลบ "สไลด์: while และ for loop"?' })
    expect(within(dialog).getByText('ไฟล์ที่อัปโหลดไว้จะถูกลบไปด้วย')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'ลบเนื้อหา' }))
    await waitFor(() => expect(api.deleteContent).toHaveBeenCalledWith(5, 11))
  })

  it('ทุกแถวมีปุ่มแก้ไข + ท้ายหน่วยมีปุ่มอัปโหลดไฟล์ / เขียนข้อความ / เพิ่มลิงก์', async () => {
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)

    expect(screen.getByRole('button', { name: 'แก้ไข สรุป' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'แก้ไข สไลด์: while และ for loop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เขียนข้อความในหน่วยที่ 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เพิ่มลิงก์ในหน่วยที่ 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'อัปโหลดไฟล์ในหน่วยที่ 2' })).toBeInTheDocument()
  })
})

describe('ดูอย่างเดียว / ว่าง', () => {
  it('ผู้ดูแลระบบ: ไม่มีปุ่มจัดการ + ข้อความบอกว่าดูอย่างเดียว แต่ยังเปิดดูหน่วยได้ (กง1)', async () => {
    const { user } = renderTab(true)

    expect(await screen.findByText(/ผู้ดูแลระบบดูเนื้อหาได้อย่างเดียว/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เพิ่มหน่วยการเรียน' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ลบ / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^เลื่อน / })).not.toBeInTheDocument()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)
    expect(screen.getByText('สไลด์: while และ for loop')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^แก้ไข / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^เขียนข้อความ/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^อัปโหลดไฟล์/ })).not.toBeInTheDocument()
  })

  it('รายวิชาที่ปิดแล้ว: ผู้สอนดูอย่างเดียว', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_closed: true }))
    renderTab()

    expect(await screen.findByText('รายวิชานี้ปิดแล้ว ดูเนื้อหาได้อย่างเดียว')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เพิ่มหน่วยการเรียน' })).not.toBeInTheDocument()
  })

  it('ยังไม่มีหน่วย: ข้อความชวนเพิ่ม + ปุ่มเพิ่ม (ผู้ดูแลระบบไม่มีปุ่ม)', async () => {
    api.fetchModules.mockResolvedValue([])
    renderTab()

    expect(await screen.findByText('ยังไม่มีหน่วยการเรียน')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เพิ่มหน่วยการเรียน' })).toBeInTheDocument()
  })

  it('โหลดไม่สำเร็จ → ข้อความ + ปุ่มลองอีกครั้ง', async () => {
    api.fetchModules.mockRejectedValueOnce(new ApiError(500, 'server_error'))
    const { user } = renderTab()

    expect(await screen.findByText('โหลดเนื้อหาไม่สำเร็จ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }))
    expect(await screen.findByText('3 หน่วย')).toBeInTheDocument()
  })
})

describe('ตัวอย่างที่ผู้เรียนจะเห็น (ขั้น 4.7 ข)', () => {
  /** ปุ่มชื่อรายการ (ชื่อ + "ดูตัวอย่างที่ผู้เรียนจะเห็น" สำหรับโปรแกรมอ่านหน้าจอ) */
  const titleButton = (title: string) =>
    screen.getByRole('button', { name: `${title} ดูตัวอย่างที่ผู้เรียนจะเห็น` })
  const previewOf = (title: string) =>
    document.getElementById(titleButton(title).getAttribute('aria-controls')!) as HTMLElement | null

  it('กดชื่อรายการ → ตัวอย่างใต้แถวแบบที่ผู้เรียนเห็น (ปิดดาวน์โหลด = ไม่มีปุ่ม) ; กดซ้ำปิด', async () => {
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)
    expect(titleButton('สไลด์: while และ for loop')).toHaveAttribute('aria-expanded', 'false')

    await user.click(titleButton('สไลด์: while และ for loop'))

    const preview = previewOf('สไลด์: while และ for loop')!
    expect(titleButton('สไลด์: while และ for loop')).toHaveAttribute('aria-expanded', 'true')
    expect(preview).toHaveAccessibleName('ตัวอย่างที่ผู้เรียนจะเห็น')
    expect(within(preview).getByText('while-for-loop.pdf')).toBeInTheDocument()
    expect(
      within(preview).getByRole('link', { name: 'เปิด while-for-loop.pdf ในแท็บใหม่' }),
    ).toBeInTheDocument()
    // ข้อมูลของผู้สอนมีลิงก์ดาวน์โหลด แต่ผู้เรียนไม่ได้ (allow_download = false) → ตัวอย่างต้องไม่มีปุ่ม
    expect(within(preview).queryByRole('link', { name: /ดาวน์โหลด/ })).not.toBeInTheDocument()
    expect(within(preview).getByText('ผู้สอนปิดการดาวน์โหลดไฟล์นี้')).toBeInTheDocument()
    // ไม่มีหัวข้อซ้ำในตัวอย่าง (ชื่ออยู่ในแถวแล้ว)
    expect(within(preview).queryByRole('heading')).not.toBeInTheDocument()

    await user.click(titleButton('สไลด์: while และ for loop'))
    expect(previewOf('สไลด์: while และ for loop')).toBeNull()
    expect(titleButton('สไลด์: while และ for loop')).toHaveFocus()
  })

  it('เปิดได้ทีละรายการทั้งแท็บ (ขค1) — ข้ามหน่วยก็เช่นกัน', async () => {
    const { user } = renderTab()
    await user.click((await moduleCard('ก้าวแรกกับ Python')).toggle)
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)

    await user.click(titleButton('สรุปก่อนเรียน'))
    expect(previewOf('สรุปก่อนเรียน')).not.toBeNull()
    await user.click(titleButton('สไลด์: while และ for loop'))

    expect(previewOf('สไลด์: while และ for loop')).not.toBeNull()
    expect(previewOf('สรุปก่อนเรียน')).toBeNull()
    expect(titleButton('สรุปก่อนเรียน')).toHaveAttribute('aria-expanded', 'false')
  })

  it('ผู้เรียนยังไม่เห็น (รายการหรือหน่วยยังไม่เผยแพร่) → หัวกล่อง "… เมื่อเผยแพร่"', async () => {
    api.fetchModules.mockResolvedValue([
      ...MODULES.slice(0, 2),
      makeModule(3, {
        title: 'ลิสต์และดิกชันนารี',
        is_published: false,
        contents: [makeContent(20, { module: 3, title: 'ลิสต์เบื้องต้น', body: '# ส่วนแรก' })],
      }),
    ])
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)
    await user.click((await moduleCard('ลิสต์และดิกชันนารี')).toggle)

    await user.click(titleButton('วิดีโอ: if, elif, else'))
    const draftItem = previewOf('วิดีโอ: if, elif, else')!
    expect(draftItem).toHaveAccessibleName('ตัวอย่างที่ผู้เรียนจะเห็นเมื่อเผยแพร่')
    expect(within(draftItem).getByTitle('วิดีโอจาก YouTube: วิดีโอ: if, elif, else')).toBeInTheDocument()

    await user.click(titleButton('ลิสต์เบื้องต้น'))
    const draftModule = previewOf('ลิสต์เบื้องต้น')!
    expect(draftModule).toHaveAccessibleName('ตัวอย่างที่ผู้เรียนจะเห็นเมื่อเผยแพร่')
    // หัวข้อในข้อความเริ่มที่ h5 เหมือนหน้าบทเรียน
    expect(within(draftModule).getByRole('heading', { name: 'ส่วนแรก' }).tagName).toBe('H5')
  })

  it('พับหน่วย → ตัวอย่างปิด และเปิดหน่วยอีกครั้งไม่เด้งกลับมาเอง', async () => {
    const { user } = renderTab()
    const { toggle } = await moduleCard('โครงสร้างควบคุมทิศทาง')
    await user.click(toggle)
    await user.click(titleButton('สรุป'))

    await user.click(toggle)
    await user.click(toggle)

    expect(previewOf('สรุป')).toBeNull()
    expect(titleButton('สรุป')).toHaveAttribute('aria-expanded', 'false')
  })

  it('รายการถูกย้ายไปหน่วยอื่น / ถูกลบ → ตัวอย่างปิด', async () => {
    const moved = makeContent(13, { module: 1, title: 'สรุป' })
    api.runContentAction.mockResolvedValue(YOUTUBE)
    const { user } = renderTab()
    await user.click((await moduleCard('ก้าวแรกกับ Python')).toggle)
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)
    await user.click(titleButton('สรุป'))
    expect(previewOf('สรุป')).not.toBeNull()

    // โหลดรายการใหม่ (หลังกดเผยแพร่รายการอื่น) แล้ว "สรุป" อยู่หน่วยที่ 1
    api.fetchModules.mockResolvedValue([
      makeModule(1, {
        title: 'ก้าวแรกกับ Python',
        contents: [makeContent(10, { title: 'สรุปก่อนเรียน' }), moved],
      }),
      makeModule(2, { title: 'โครงสร้างควบคุมทิศทาง', contents: [PDF, YOUTUBE] }),
    ])
    await user.click(screen.getByRole('button', { name: 'เผยแพร่ วิดีโอ: if, elif, else' }))

    await waitFor(() => expect(titleButton('สรุป')).toHaveAttribute('aria-expanded', 'false'))
    expect(previewOf('สรุป')).toBeNull()
  })

  it('เปลี่ยนไฟล์แล้วตัวอย่างวาดตัวเล่นใหม่ ; เลื่อน / เผยแพร่รายการอื่นไม่ทำให้ตัวเล่นเปลี่ยนลิงก์', async () => {
    const video = (fileName: string, link: string) =>
      makeContent(30, {
        title: 'if-elif-else',
        content_type: 'video',
        file_name: fileName,
        file_size: 1000,
        mime_type: 'video/mp4',
        file_link: link,
        download_link: link,
      })
    const withVideo = (content: ReturnType<typeof video>) => [
      makeModule(2, { title: 'โครงสร้างควบคุมทิศทาง', contents: [content, YOUTUBE] }),
    ]
    api.fetchModules.mockResolvedValue(withVideo(video('a.mp4', '/media/a.mp4?sig=1')))
    api.runContentAction.mockResolvedValue(YOUTUBE)
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)
    await user.click(titleButton('if-elif-else'))
    const player = () => within(previewOf('if-elif-else')!).getByLabelText('วิดีโอ if-elif-else')
    expect(player()).toHaveAttribute('src', '/media/a.mp4?sig=1')

    // ไฟล์เดิม แต่ลิงก์ชั่วคราวเปลี่ยน (B2 ออกลิงก์ใหม่ทุกครั้งที่โหลดรายการ) → ตัวเล่นใช้ลิงก์เดิมต่อ ไม่เริ่มใหม่
    api.fetchModules.mockResolvedValue(withVideo(video('a.mp4', '/media/a.mp4?sig=2')))
    await user.click(screen.getByRole('button', { name: 'เผยแพร่ วิดีโอ: if, elif, else' }))
    await waitFor(() => expect(api.fetchModules).toHaveBeenCalledTimes(2))
    expect(player()).toHaveAttribute('src', '/media/a.mp4?sig=1')

    // เปลี่ยนไฟล์ (ชื่อ / ขนาดใหม่) → วาดตัวเล่นใหม่ด้วยไฟล์ใหม่
    api.fetchModules.mockResolvedValue(withVideo(video('b.mp4', '/media/b.mp4?sig=3')))
    await user.click(screen.getByRole('button', { name: 'เผยแพร่ วิดีโอ: if, elif, else' }))
    await waitFor(() => expect(player()).toHaveAttribute('src', '/media/b.mp4?sig=3'))
  })

  it('ระหว่างรอผลของปุ่มอื่น ชื่อรายการยังกดดูตัวอย่างได้', async () => {
    api.moveContent.mockReturnValue(new Promise(() => undefined))
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)
    await user.click(screen.getByRole('button', { name: 'เลื่อน สไลด์: while และ for loop ขึ้น' }))

    await user.click(titleButton('สรุป'))

    expect(previewOf('สรุป')).not.toBeNull()
  })

  it('ผู้ดูแลระบบดูตัวอย่างได้ (อ่านอย่างเดียว)', async () => {
    const { user } = renderTab(true)
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)

    await user.click(titleButton('สไลด์: while และ for loop'))

    expect(previewOf('สไลด์: while และ for loop')).not.toBeNull()
  })

  it('ข้อมูลเก่ากว่า 50 นาที: กดดาวน์โหลดในตัวอย่าง → โหลดรายการของแท็บใหม่แล้วใช้ลิงก์ใหม่ (ขง1)', async () => {
    const clicked: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute('href') ?? '')
    })
    const slides = (link: string) =>
      makeContent(40, {
        title: 'สไลด์',
        content_type: 'file',
        file_name: 'slides.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        file_link: link,
        download_link: `${link}?dl`,
      })
    api.fetchModules
      .mockResolvedValueOnce([
        makeModule(2, { title: 'โครงสร้างควบคุมทิศทาง', contents: [slides('/media/old.pdf')] }),
      ])
      .mockResolvedValueOnce([
        makeModule(2, { title: 'โครงสร้างควบคุมทิศทาง', contents: [slides('/media/new.pdf')] }),
      ])
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)
    await user.click(titleButton('สไลด์'))

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 51 * 60 * 1000)
    await user.click(within(previewOf('สไลด์')!).getByRole('link', { name: 'ดาวน์โหลด slides.pdf' }))

    await waitFor(() => expect(clicked).toEqual(['/media/new.pdf?dl']))
    expect(api.fetchModules).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('รายวิชายังไม่เผยแพร่ → ทุกตัวอย่างบอก "… เมื่อเผยแพร่" (ผู้เรียนยังไม่เห็นอะไรเลย)', async () => {
    fetchCourse.mockResolvedValue(makeCourse({ is_published: false }))
    const { user } = renderTab()
    await user.click((await moduleCard('ก้าวแรกกับ Python')).toggle)

    await user.click(titleButton('สรุปก่อนเรียน'))

    expect(previewOf('สรุปก่อนเรียน')).toHaveAccessibleName('ตัวอย่างที่ผู้เรียนจะเห็นเมื่อเผยแพร่')
  })
})
