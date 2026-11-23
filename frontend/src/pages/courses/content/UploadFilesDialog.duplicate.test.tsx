/**
 * test ของไฟล์ชื่อซ้ำในหน้าต่างอัปโหลด (ชซ1 — ผู้ใช้เลือก 2026-11-24, docs/decisions/block-4.md)
 * — ถามในแถว 4 ทาง: ยืนยัน (เก็บทั้งคู่) / แทนที่ (เปลี่ยนไฟล์ของรายการเดิม) / เปลี่ยนชื่อ / ยกเลิก
 * — ไฟล์ที่รอเลือกไม่ขวางไฟล์อื่น ; ยังรอเลือก = ยังไม่สรุปผล ; ไฟล์ซ้ำกันเองในรอบเดียวกันก็ถูกถาม
 * แยกจาก UploadFilesDialog.test.tsx เพื่อไม่ให้ไฟล์เดียวยาวเกินอ่าน ; ใช้ตัวปลอมแทน API แบบเดียวกัน
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
  replaceContentFile: vi.fn(),
}))
const fetchCourse = vi.mocked(coursesApi.fetchCourse)
const api = vi.mocked(contentApi)

const MB = 1024 * 1024
/** ไฟล์ที่มีอยู่แล้วในหน่วยที่ 2 (รหัสหน่วย 3) */
const EXISTING = makeContent(30, {
  module: 3,
  title: 'บทที่3-ลูป',
  content_type: 'file',
  file_name: 'บทที่3-ลูป.pdf',
  file_size: 2.1 * MB,
  is_published: true,
  updated_at: '2026-10-03T07:20:00Z',
})
const MODULES: Module[] = [
  makeModule(1, { title: 'ก้าวแรกกับ Python' }),
  makeModule(3, { title: 'โครงสร้างควบคุมทิศทาง', contents: [EXISTING] }),
]

function makeFile(name: string, size = 1000): File {
  const file = new File(['x'], name, { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

/** ผลของการส่งไฟล์ใหม่สำเร็จ (ชื่อไฟล์ตามที่ส่ง) */
const created = (id: number, file: File): Content =>
  makeContent(id, { module: 3, content_type: 'file', file_name: file.name, file_size: file.size })

beforeEach(() => {
  vi.resetAllMocks()
  fetchCourse.mockResolvedValue(makeCourse())
  api.fetchModules.mockResolvedValue(MODULES)
  let nextId = 100
  api.uploadContentFile.mockImplementation(async (_c, _m, file) => created(nextId++, file))
  api.replaceContentFile.mockImplementation(async (_c, id, file) => ({
    ...EXISTING,
    id,
    file_name: file.name,
    file_size: file.size,
  }))
})

async function openUpload() {
  const view = renderCoursePage('/courses/5', null, <ContentTab />)
  await view.user.click(await screen.findByRole('button', { name: /โครงสร้างควบคุมทิศทาง/, expanded: false }))
  await view.user.click(screen.getByRole('button', { name: 'อัปโหลดไฟล์ในหน่วยที่ 2' }))
  const dialog = await screen.findByRole('dialog', { name: 'อัปโหลดไฟล์' })
  return { ...view, dialog }
}

function choose(dialog: HTMLElement, files: File[]) {
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

/** แถวที่ index ของไฟล์ชื่อนี้ (ชื่อเดียวกันมีได้หลายแถว — นับจากบนลงล่าง) */
function rowAt(dialog: HTMLElement, name: string, index = 0): HTMLElement {
  const element = within(dialog).getAllByText(name)[index]
  if (!element) throw new Error(`ไม่พบแถวที่ ${index} ของ ${name}`)
  return element.closest('li') as HTMLElement
}

describe('พบไฟล์ชื่อซ้ำ', () => {
  it('แถวรอเลือก + ข้อมูลไฟล์เดิม + กล่องอธิบาย ; ไฟล์อื่นส่งต่อ ; ยังไม่สรุปผล', async () => {
    const { dialog } = await openUpload()
    const other = makeFile('สรุป.pdf')
    choose(dialog, [makeFile('บทที่3-ลูป.pdf'), other])

    const dup = rowAt(dialog, 'บทที่3-ลูป.pdf')
    expect(await within(dup).findByText('รอเลือก')).toBeInTheDocument()
    expect(within(dup).getByText('มีไฟล์ชื่อนี้ในหน่วยนี้แล้ว')).toBeInTheDocument()
    expect(
      within(dup).getByText(/ไฟล์เดิม: เผยแพร่แล้ว, 2\.1 MB, แก้ไขล่าสุด 3 ต\.ค\. 2569 14:20/),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('ไฟล์นี้ชื่อซ้ำกับไฟล์ในหน่วยนี้')).toBeInTheDocument()

    // ไฟล์อื่นส่งไปแล้ว ไฟล์ซ้ำยังไม่ถูกส่ง
    await waitFor(() => expect(api.uploadContentFile).toHaveBeenCalledTimes(1))
    expect(api.uploadContentFile).toHaveBeenCalledWith(5, 3, other, expect.anything())
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 จาก 2 ไฟล์ รอเลือก 1 ไฟล์')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'รอเลือก 1 ไฟล์' })).toBeDisabled()
    expect(within(dialog).queryByText(/^อัปโหลดแล้ว 1 ไฟล์$/)).not.toBeInTheDocument()
  })

  it('ตัวพิมพ์ใหญ่ต่างกันก็ถือว่าซ้ำ', async () => {
    const { dialog } = await openUpload()
    choose(dialog, [makeFile('บทที่3-ลูป.PDF')])
    expect(await within(rowAt(dialog, 'บทที่3-ลูป.PDF')).findByText('รอเลือก')).toBeInTheDocument()
    expect(api.uploadContentFile).not.toHaveBeenCalled()
  })

  it('เลือกไฟล์ชื่อเดียวกัน 2 ไฟล์ในรอบเดียว (ไม่มีในหน่วย) → ไฟล์แรกส่ง ไฟล์ที่ 2 ถูกถาม', async () => {
    const { dialog } = await openUpload()
    choose(dialog, [makeFile('ใบงาน.pdf'), makeFile('ใบงาน.pdf')])
    const first = rowAt(dialog, 'ใบงาน.pdf', 0)
    const second = rowAt(dialog, 'ใบงาน.pdf', 1)
    expect(await within(first).findByText('อัปโหลดแล้ว')).toBeInTheDocument()
    expect(await within(second).findByText('รอเลือก')).toBeInTheDocument()
    expect(api.uploadContentFile).toHaveBeenCalledTimes(1)
  })
})

describe('4 ทางเลือก', () => {
  it('ยืนยัน → อัปโหลดเป็นรายการใหม่ โฟกัสหัวรายการ → สรุปผล', async () => {
    const { user, dialog } = await openUpload()
    const file = makeFile('บทที่3-ลูป.pdf')
    choose(dialog, [file])
    await user.click(
      await within(dialog).findByRole('button', { name: 'ยืนยันอัปโหลด บทที่3-ลูป.pdf เป็นรายการใหม่' }),
    )
    expect(within(dialog).getByText('ไฟล์ที่เลือก 1 ไฟล์')).toHaveFocus()
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')).toBeInTheDocument()
    expect(api.uploadContentFile).toHaveBeenCalledWith(5, 3, file, expect.anything())
    expect(api.replaceContentFile).not.toHaveBeenCalled()
  })

  it('แทนที่ → เปลี่ยนไฟล์ของรายการเดิม (รหัส 30) + สรุปบอกจำนวนที่แทนที่', async () => {
    const { user, dialog } = await openUpload()
    const file = makeFile('บทที่3-ลูป.pdf')
    choose(dialog, [file])
    await user.click(await within(dialog).findByRole('button', { name: 'แทนที่ไฟล์เดิมด้วย บทที่3-ลูป.pdf' }))
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์ (แทนที่ไฟล์เดิม 1 ไฟล์)')).toBeInTheDocument()
    expect(within(dialog).getByText('หัวข้อ ลำดับ และการเผยแพร่ของรายการเดิมคงเดิม')).toBeInTheDocument()
    expect(within(rowAt(dialog, 'บทที่3-ลูป.pdf')).getByText('แทนที่ไฟล์เดิมแล้ว')).toBeInTheDocument()
    expect(api.replaceContentFile).toHaveBeenCalledWith(5, 30, file, expect.anything())
    expect(api.uploadContentFile).not.toHaveBeenCalled()
  })

  it('แทนที่แล้วรายการเดิมถูกลบไประหว่างนั้น (404) → บอกเหตุผล ไฟล์อื่นไม่ถูกหยุด', async () => {
    api.replaceContentFile.mockRejectedValue(new ApiError(404, 'not_found'))
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('บทที่3-ลูป.pdf')])
    await user.click(await within(dialog).findByRole('button', { name: 'แทนที่ไฟล์เดิมด้วย บทที่3-ลูป.pdf' }))
    expect(
      await within(dialog).findByText('ไฟล์เดิมถูกลบไปแล้ว อัปโหลดไฟล์นี้อีกครั้งเพื่อเพิ่มเป็นรายการใหม่'),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText(/หยุดอัปโหลดไฟล์ที่เหลือแล้ว/)).not.toBeInTheDocument()
  })

  it('เปลี่ยนชื่อ → ช่องได้ชื่อตั้งต้น "(2)" + โฟกัส ; ส่งด้วยชื่อใหม่ นามสกุลเดิม', async () => {
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('บทที่3-ลูป.pdf')])
    await user.click(
      await within(dialog).findByRole('button', { name: 'เปลี่ยนชื่อ บทที่3-ลูป.pdf ก่อนอัปโหลด' }),
    )
    const input = within(dialog).getByRole('textbox', { name: 'ชื่อไฟล์ใหม่ของ บทที่3-ลูป.pdf' })
    expect(input).toHaveFocus()
    expect(input).toHaveValue('บทที่3-ลูป (2)')

    await user.click(within(dialog).getByRole('button', { name: 'อัปโหลดด้วยชื่อนี้' }))
    expect(await within(dialog).findByText('อัปโหลดแล้ว 1 ไฟล์')).toBeInTheDocument()
    const sent = api.uploadContentFile.mock.calls[0]?.[2]
    expect(sent?.name).toBe('บทที่3-ลูป (2).pdf')
    expect(sent?.size).toBe(1) // เนื้อไฟล์เดิม (ไฟล์สมมติมี 1 ไบต์จริง)
  })

  it('เปลี่ยนชื่อ: ว่าง / ยังซ้ำ → ข้อความแดง ไม่ส่ง ; กลับ → โฟกัสปุ่มเปลี่ยนชื่อ', async () => {
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('บทที่3-ลูป.pdf')])
    const renameButton = await within(dialog).findByRole('button', {
      name: 'เปลี่ยนชื่อ บทที่3-ลูป.pdf ก่อนอัปโหลด',
    })
    await user.click(renameButton)
    const input = within(dialog).getByRole('textbox', { name: 'ชื่อไฟล์ใหม่ของ บทที่3-ลูป.pdf' })

    await user.clear(input)
    await user.keyboard('{Enter}')
    expect(await within(dialog).findByText('กรุณากรอกชื่อไฟล์')).toBeInTheDocument()

    await user.type(input, 'บทที่3-ลูป')
    await user.keyboard('{Enter}')
    expect(await within(dialog).findByText('ชื่อนี้ยังซ้ำกับไฟล์ในหน่วยนี้ ลองชื่ออื่น')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(api.uploadContentFile).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'กลับ' }))
    expect(
      within(dialog).getByRole('button', { name: 'เปลี่ยนชื่อ บทที่3-ลูป.pdf ก่อนอัปโหลด' }),
    ).toHaveFocus()
  })

  it('ยกเลิก → ไม่ส่งไฟล์นั้น สรุปเป็น "ยกเลิก 1 ไฟล์"', async () => {
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('บทที่3-ลูป.pdf')])
    await user.click(await within(dialog).findByRole('button', { name: 'ยกเลิกการอัปโหลด บทที่3-ลูป.pdf' }))
    expect(await within(dialog).findByText('ยกเลิก 1 ไฟล์')).toBeInTheDocument()
    expect(api.uploadContentFile).not.toHaveBeenCalled()
  })
})

describe('ปิด / หยุดระหว่างมีไฟล์รอเลือก', () => {
  it('ไม่มีไฟล์กำลังส่ง → ปุ่ม "ยกเลิก" ปิดได้ทันทีโดยไม่ถาม', async () => {
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('บทที่3-ลูป.pdf')])
    await within(dialog).findByText('รอเลือก 1 ไฟล์')
    // ปุ่ม "ยกเลิก" ล่างซ้าย (ไม่ใช่ปุ่มยกเลิกในแถว — ชื่อของปุ่มในแถวบอกชื่อไฟล์)
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.uploadContentFile).not.toHaveBeenCalled()
  })

  it('หยุดไฟล์ที่เหลือระหว่างส่ง → ไฟล์ที่รอเลือกถูกยกเลิกด้วย', async () => {
    // ไฟล์แรกค้างไว้ (ยังไม่ตอบ) จนกว่าจะถูกหยุด
    api.uploadContentFile.mockImplementation(
      (_c, _m, _file, options: UploadOptions = {}) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new UploadAbortedError()))
        }),
    )
    const { user, dialog } = await openUpload()
    choose(dialog, [makeFile('บทที่3-ลูป.pdf'), makeFile('วิดีโอ.pdf', 3 * MB)])
    await within(rowAt(dialog, 'บทที่3-ลูป.pdf')).findByText('รอเลือก')
    await user.click(within(dialog).getByRole('button', { name: 'หยุดไฟล์ที่เหลือ' }))
    expect(within(rowAt(dialog, 'บทที่3-ลูป.pdf')).getByText('ยกเลิกแล้ว')).toBeInTheDocument()
  })
})
