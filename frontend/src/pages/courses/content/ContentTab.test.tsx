/**
 * test ของแท็บเนื้อหาของผู้สอน /courses/:courseId (ขั้น 4.5)
 * แทนที่ฟังก์ชันเรียก API ด้วยตัวปลอม (ไม่เรียก backend จริง) ; ข้อมูลทั้งหมดเป็นข้อมูลสมมติ
 */
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import * as contentApi from '../../../api/content'
import type { Content, Module } from '../../../api/content'
import * as coursesApi from '../../../api/courses'
import { makeCourse, renderCoursePage } from '../testUtils'
import ContentTab from './ContentTab'

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

function makeContent(id: number, overrides: Partial<Content> = {}): Content {
  return {
    id,
    module: 1,
    title: `เนื้อหา ${id}`,
    content_type: 'text',
    body: '',
    order: id,
    is_published: true,
    file_name: '',
    file_size: null,
    mime_type: '',
    file_link: null,
    download_link: null,
    external_url: '',
    youtube_id: null,
    allow_download: true,
    can_disable_download: false,
    created_at: '2026-11-15T03:00:00Z',
    updated_at: '2026-11-15T03:00:00Z',
    ...overrides,
  }
}

function makeModule(id: number, overrides: Partial<Module> = {}): Module {
  return {
    id,
    title: `หน่วย ${id}`,
    description: '',
    order: id,
    is_published: true,
    contents: [],
    ...overrides,
  }
}

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

  it('ยังไม่มีปุ่มแก้เนื้อหา / เพิ่มเนื้อหา (มาในขั้น 4.6)', async () => {
    const { user } = renderTab()
    await user.click((await moduleCard('โครงสร้างควบคุมทิศทาง')).toggle)

    expect(screen.queryByRole('button', { name: 'แก้ไข สรุป' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /อัปโหลดไฟล์/ })).not.toBeInTheDocument()
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
