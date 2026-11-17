/**
 * test ของส่วนแสดงผลกลาง (ขั้น 4.7 ก): หน้าตาแต่ละชนิด + ขยาย / ย่อ + ดาวน์โหลด + ลิงก์หมดอายุ (ขง1)
 * ข้อมูลสมมติทั้งหมด ; ตัวขอลิงก์ใหม่เป็นตัวปลอมที่ test กำหนดเอง
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudentContent } from '../../../api/content'
import { makeContent } from '../content/testData'
import { ContentView } from './ContentView'
import { FreshLinksContext, type ContentLookup, type FreshLinks } from './useFreshLinks'

/** เนื้อหาแบบที่ผู้เรียนได้ (ตัดช่องของผู้สอนทิ้งไม่จำเป็น — ส่วนแสดงผลไม่ใช้) */
function item(overrides: Partial<StudentContent> = {}): StudentContent {
  return makeContent(1, { title: 'บทเรียนทดลอง', ...overrides })
}

const pdf = (overrides: Partial<StudentContent> = {}) =>
  item({
    content_type: 'file',
    title: 'สไลด์: while และ for loop',
    file_name: 'while-for-loop.pdf',
    file_size: 2.1 * 1024 * 1024,
    mime_type: 'application/pdf',
    file_link: '/media/old.pdf',
    download_link: '/media/old.pdf?dl',
    ...overrides,
  })

const video = (overrides: Partial<StudentContent> = {}) =>
  item({
    content_type: 'video',
    title: 'if-elif-else',
    file_name: 'if-elif-else.mp4',
    file_size: 64 * 1024 * 1024,
    mime_type: 'video/mp4',
    file_link: '/media/old.mp4',
    download_link: '/media/old.mp4?dl',
    ...overrides,
  })

/** วาดเนื้อหา 1 ชิ้น พร้อมตัวขอลิงก์ใหม่แบบกำหนดเอง (ไม่ส่ง = ไม่มี provider) */
function renderView(content: StudentContent, links?: FreshLinks) {
  const view = <ContentView content={content} />
  render(links ? <FreshLinksContext value={links}>{view}</FreshLinksContext> : view)
  return userEvent.setup()
}

/** ตัวขอลิงก์ปลอม: เก่าแล้ว/ยัง + ข้อมูลชุดใหม่ที่จะได้ (null = ขอไม่สำเร็จ) */
function fakeLinks(
  stale: boolean,
  fresh: StudentContent[] | null,
): FreshLinks & { refresh: ReturnType<typeof vi.fn> } {
  const lookup: ContentLookup | null = fresh ? (id) => fresh.find((content) => content.id === id) : null
  return { isStale: () => stale, refresh: vi.fn(() => Promise.resolve(lookup)) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('หน้าตาแต่ละชนิด', () => {
  it('ข้อความ: หัวข้อ h4 + เนื้อความ Markdown', () => {
    renderView(item({ body: 'เงื่อนไขช่วยให้โปรแกรม**เลือกทำ**\n\n```\nscore = 72\n```' }))

    expect(screen.getByRole('heading', { level: 4, name: 'บทเรียนทดลอง' })).toBeInTheDocument()
    expect(screen.getByText('เลือกทำ').tagName).toBe('STRONG')
    expect(screen.getByText('score = 72')).toBeInTheDocument()
  })

  it('วิดีโอ YouTube: เล่นในหน้าผ่าน youtube-nocookie + ปุ่มขยาย / ย่อบอกชื่อเนื้อหา', async () => {
    const user = renderView(
      item({
        content_type: 'video',
        title: 'วิดีโอ: if',
        youtube_id: 'dQw4w9WgXcQ',
        external_url: 'https://youtu.be/x',
      }),
    )

    const frame = screen.getByTitle('วิดีโอจาก YouTube: วิดีโอ: if')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    const box = frame.parentElement!
    expect(box).toHaveClass('lg:max-w-[320px]')

    await user.click(screen.getByRole('button', { name: 'ขยาย วิดีโอ: if' }))
    expect(box).not.toHaveClass('lg:max-w-[320px]')
    await user.click(screen.getByRole('button', { name: 'ย่อ วิดีโอ: if' }))
    expect(box).toHaveClass('lg:max-w-[320px]')
  })

  it('วิดีโออัปโหลด: ตัวเล่น (โหลดแค่ข้อมูลต้นไฟล์) + ชื่อไฟล์ ขนาด ดาวน์โหลดได้ชื่อเดิม', () => {
    renderView(video())

    const player = screen.getByLabelText('วิดีโอ if-elif-else')
    expect(player.tagName).toBe('VIDEO')
    expect(player).toHaveAttribute('src', '/media/old.mp4')
    expect(player).toHaveAttribute('preload', 'metadata')
    expect(player).not.toHaveAttribute('controlslist')
    expect(screen.getByText('if-elif-else.mp4')).toBeInTheDocument()
    expect(screen.getByText('64.0 MB')).toBeInTheDocument()
    const download = screen.getByRole('link', { name: 'ดาวน์โหลด if-elif-else.mp4' })
    expect(download).toHaveAttribute('href', '/media/old.mp4?dl')
    expect(download).toHaveAttribute('download', 'if-elif-else.mp4')
    expect(screen.getByRole('button', { name: 'ขยาย if-elif-else' })).toBeInTheDocument()
  })

  it('ปิดดาวน์โหลด: ไม่มีปุ่ม + ข้อความ + ตัวเล่นซ่อนเมนูดาวน์โหลด (ผู้เรียนไม่ได้ลิงก์ดาวน์โหลดอยู่แล้ว)', () => {
    renderView(video({ allow_download: false, download_link: null }))

    expect(screen.queryByRole('link', { name: /ดาวน์โหลด/ })).not.toBeInTheDocument()
    expect(screen.getByText('ผู้สอนปิดการดาวน์โหลดไฟล์นี้')).toBeInTheDocument()
    expect(screen.getByLabelText('วิดีโอ if-elif-else')).toHaveAttribute('controlslist', 'nodownload')
  })

  it('ข้อมูลของผู้สอนที่ปิดดาวน์โหลด (ยังมีลิงก์) ก็ไม่แสดงปุ่ม — ตัวอย่างต้องเหมือนที่ผู้เรียนเห็น', () => {
    renderView(pdf({ allow_download: false }))

    expect(screen.queryByRole('link', { name: /ดาวน์โหลด/ })).not.toBeInTheDocument()
    expect(screen.getByText('ผู้สอนปิดการดาวน์โหลดไฟล์นี้')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'เปิด while-for-loop.pdf ในแท็บใหม่' })).toBeInTheDocument()
  })

  it('เอกสาร: PDF / .txt มี "เปิด" ในแท็บใหม่ ; .py มีแค่ดาวน์โหลด', () => {
    renderView(pdf())
    const open = screen.getByRole('link', { name: 'เปิด while-for-loop.pdf ในแท็บใหม่' })
    expect(open).toHaveAttribute('href', '/media/old.pdf')
    expect(open).toHaveAttribute('target', '_blank')
    expect(open).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('2.1 MB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ดาวน์โหลด while-for-loop.pdf' })).toBeInTheDocument()
  })

  it('.txt มีปุ่มเปิด ; .py ไม่มี', () => {
    renderView(pdf({ id: 2, file_name: 'notes.txt', mime_type: 'text/plain' }))
    expect(screen.getByRole('link', { name: 'เปิด notes.txt ในแท็บใหม่' })).toBeInTheDocument()
  })

  it('.py ไม่มีปุ่มเปิด', () => {
    renderView(pdf({ file_name: 'break_continue.py', mime_type: 'text/x-python' }))
    expect(screen.queryByRole('link', { name: /^เปิด/ })).not.toBeInTheDocument()
    expect(screen.getByText('ไฟล์ .py')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ดาวน์โหลด break_continue.py' })).toBeInTheDocument()
  })

  it('รูป: ข้อความแทนรูปคือหัวข้อ + ขยาย ; เสียง: ตัวเล่นเต็มความกว้าง', () => {
    renderView(
      item({ content_type: 'image', title: 'ผังงาน', file_name: 'flow.png', file_link: '/media/f.png' }),
    )
    expect(screen.getByRole('img', { name: 'ผังงาน' })).toHaveAttribute('src', '/media/f.png')
    expect(screen.getByRole('button', { name: 'ขยาย ผังงาน' })).toBeInTheDocument()
  })

  it('เสียง: ตัวเล่น ไม่มีปุ่มขยาย ; ชนิดอื่นที่มีคำอธิบายแสดงใต้หัวข้อ', () => {
    renderView(
      item({
        content_type: 'audio',
        title: 'ฟังสรุป',
        body: 'ฟังก่อนเข้าเรียน',
        file_name: 'sum.m4a',
        file_link: '/media/s.m4a',
      }),
    )
    expect(screen.getByLabelText('เสียง ฟังสรุป').tagName).toBe('AUDIO')
    expect(screen.queryByRole('button', { name: /ขยาย/ })).not.toBeInTheDocument()
    expect(screen.getByText('ฟังก่อนเข้าเรียน')).toBeInTheDocument()
  })

  it('ลิงก์: "เปิดลิงก์ <ชื่อเว็บ>" แท็บใหม่', () => {
    renderView(item({ content_type: 'link', external_url: 'https://docs.python.org/3/' }))
    const link = screen.getByRole('link', { name: 'เปิดลิงก์ docs.python.org ในแท็บใหม่' })
    expect(link).toHaveAttribute('href', 'https://docs.python.org/3/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveTextContent('เปิดลิงก์ docs.python.org')
  })
})

describe('ลิงก์หมดอายุ (ขง1)', () => {
  let clicked: string[]
  beforeEach(() => {
    clicked = []
    // ลิงก์ชั่วคราวที่สั่งดาวน์โหลด — jsdom ไม่ดาวน์โหลดจริง เก็บไว้ตรวจแทน
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(`${this.getAttribute('href')}|${this.download}`)
    })
  })

  it('ข้อมูลยังใหม่: ปุ่มทำงานตามปกติ ไม่ขอรายการใหม่', async () => {
    const links = fakeLinks(false, [])
    const open = vi.spyOn(window, 'open')
    const user = renderView(pdf(), links)

    await user.click(screen.getByRole('link', { name: 'เปิด while-for-loop.pdf ในแท็บใหม่' }))

    expect(links.refresh).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('เปิด: เปิดแท็บเปล่าทันทีตอนกด แล้วส่งไปลิงก์ใหม่', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const links = fakeLinks(true, [pdf({ file_link: '/media/new.pdf' })])
    const user = renderView(pdf(), links)

    await user.click(screen.getByRole('link', { name: 'เปิด while-for-loop.pdf ในแท็บใหม่' }))

    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(tab.opener).toBeNull()
    await waitFor(() => expect(tab.location.href).toBe('/media/new.pdf'))
  })

  it('ดาวน์โหลด: ได้ลิงก์ใหม่แล้วสั่งดาวน์โหลดด้วยชื่อเดิม', async () => {
    const links = fakeLinks(true, [pdf({ download_link: '/media/new.pdf?dl' })])
    const user = renderView(pdf(), links)

    await user.click(screen.getByRole('link', { name: 'ดาวน์โหลด while-for-loop.pdf' }))

    await waitFor(() => expect(clicked).toEqual(['/media/new.pdf?dl|while-for-loop.pdf']))
  })

  it('ขอไม่สำเร็จ / เนื้อหาหายไปแล้ว: ปิดแท็บที่เปิดไว้ + ข้อความแดง', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const user = renderView(pdf(), fakeLinks(true, null))

    await user.click(screen.getByRole('link', { name: 'เปิด while-for-loop.pdf ในแท็บใหม่' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('เปิดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง')
    expect(tab.close).toHaveBeenCalled()
    expect(tab.location.href).toBe('')
  })

  it('ดาวน์โหลดแต่ผู้สอนเพิ่งปิดดาวน์โหลด: ไม่ดาวน์โหลด + ข้อความแดง', async () => {
    const user = renderView(pdf(), fakeLinks(true, [pdf({ allow_download: false, download_link: null })]))

    await user.click(screen.getByRole('link', { name: 'ดาวน์โหลด while-for-loop.pdf' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('เปิดไฟล์ไม่สำเร็จ')
    expect(clicked).toEqual([])
  })

  it('วิดีโอโหลดไม่ได้: ขอลิงก์ใหม่ 1 ครั้ง แล้วเล่นต่อจากตำแหน่งเดิม', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const links = fakeLinks(false, [video({ file_link: '/media/new.mp4' })])
    renderView(video(), links)
    const player = screen.getByLabelText('วิดีโอ if-elif-else') as HTMLVideoElement

    // กำลังเล่นอยู่ที่วินาทีที่ 42 แล้วลิงก์หมดอายุ
    fireEvent.play(player)
    let time = 42
    Object.defineProperty(player, 'currentTime', { get: () => time, set: (value: number) => (time = value) })
    fireEvent.error(player)

    await waitFor(() =>
      expect(screen.getByLabelText('วิดีโอ if-elif-else')).toHaveAttribute('src', '/media/new.mp4'),
    )
    expect(links.refresh).toHaveBeenCalledTimes(1)

    // ตัวเล่นตัวเดิมเปลี่ยนลิงก์ → เบราว์เซอร์เริ่มที่ 0 ใหม่ ; ได้ข้อมูลต้นไฟล์แล้วต้องกลับไปวินาทีที่ 42
    time = 0
    fireEvent.loadedMetadata(screen.getByLabelText('วิดีโอ if-elif-else'))
    expect(time).toBe(42)
    expect(play).toHaveBeenCalled()
  })

  it('ได้ลิงก์เดิม (ปัญหาไม่ใช่ลิงก์หมดอายุ) / error ซ้ำ: "โหลดไฟล์ไม่สำเร็จ" + ลองใหม่ วาดตัวเล่นกลับมา', async () => {
    const links = fakeLinks(false, [video()])
    const user = renderView(video(), links)

    fireEvent.error(screen.getByLabelText('วิดีโอ if-elif-else'))

    expect(await screen.findByRole('alert')).toHaveTextContent('โหลดไฟล์ไม่สำเร็จ')
    expect(screen.queryByLabelText('วิดีโอ if-elif-else')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ลองใหม่' }))
    expect(screen.getByLabelText('วิดีโอ if-elif-else')).toHaveAttribute('src', '/media/old.mp4')
    expect(links.refresh).toHaveBeenCalledTimes(1)
  })

  it('ข้อมูลที่โหลดใหม่ภายหลังไม่เปลี่ยนลิงก์ของวิดีโอที่กำลังเล่น', () => {
    const { rerender } = render(<ContentView content={video()} />)
    rerender(<ContentView content={video({ file_link: '/media/other.mp4' })} />)
    expect(screen.getByLabelText('วิดีโอ if-elif-else')).toHaveAttribute('src', '/media/old.mp4')
  })

  it('รูปโหลดไม่ได้: ขอลิงก์ใหม่แล้วใช้ลิงก์ใหม่', async () => {
    const image = item({
      content_type: 'image',
      title: 'ผังงาน',
      file_name: 'f.png',
      file_link: '/media/old.png',
    })
    renderView(image, fakeLinks(false, [{ ...image, file_link: '/media/new.png' }]))

    fireEvent.error(screen.getByRole('img', { name: 'ผังงาน' }))

    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'ผังงาน' })).toHaveAttribute('src', '/media/new.png'),
    )
  })
})

describe('แก้หลังตรวจขั้น 4.7 ก (ขฉ1)', () => {
  it('ลิงก์หมดอายุครั้งที่ 2 (เปิดหน้าไว้นาน): โหลดสำเร็จแล้วนับใหม่ ขอลิงก์ใหม่ได้อีก', async () => {
    let round = 0
    const refresh = vi.fn(() => {
      round += 1
      const lookup: ContentLookup = () => video({ file_link: `/media/v${round}.mp4` })
      return Promise.resolve(lookup)
    })
    renderView(video(), { isStale: () => false, refresh })
    const player = () => screen.getByLabelText('วิดีโอ if-elif-else')

    fireEvent.error(player())
    await waitFor(() => expect(player()).toHaveAttribute('src', '/media/v1.mp4'))
    fireEvent.loadedMetadata(player())
    // อีกชั่วโมงต่อมา ลิงก์ใหม่ก็หมดอายุ
    fireEvent.error(player())

    await waitFor(() => expect(player()).toHaveAttribute('src', '/media/v2.mp4'))
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('โหลดไฟล์ไม่สำเร็จ')).not.toBeInTheDocument()
  })

  it('รูปโหลดสำเร็จแล้วนับใหม่เช่นกัน', async () => {
    let round = 0
    const image = (link: string) =>
      item({ content_type: 'image', title: 'ผังงาน', file_name: 'f.png', file_link: link })
    const refresh = vi.fn(() => {
      round += 1
      const lookup: ContentLookup = () => image(`/media/p${round}.png`)
      return Promise.resolve(lookup)
    })
    renderView(image('/media/p0.png'), { isStale: () => false, refresh })
    const picture = () => screen.getByRole('img', { name: 'ผังงาน' })

    fireEvent.error(picture())
    await waitFor(() => expect(picture()).toHaveAttribute('src', '/media/p1.png'))
    fireEvent.load(picture())
    fireEvent.error(picture())

    await waitFor(() => expect(picture()).toHaveAttribute('src', '/media/p2.png'))
  })

  it('ตัวเล่นที่โฟกัสอยู่โหลดไม่ได้ → โฟกัสปุ่มลองใหม่ ; กดลองใหม่ → โฟกัสตัวเล่นที่วาดใหม่', async () => {
    const user = renderView(video(), fakeLinks(false, null))
    screen.getByLabelText('วิดีโอ if-elif-else').focus()

    fireEvent.error(screen.getByLabelText('วิดีโอ if-elif-else'))

    const retry = await screen.findByRole('button', { name: 'ลองใหม่' })
    expect(retry).toHaveFocus()
    await user.click(retry)
    expect(screen.getByLabelText('วิดีโอ if-elif-else')).toHaveFocus()
  })

  it('ตัวเล่นที่ไม่ได้โฟกัสโหลดไม่ได้ → ไม่ดึงโฟกัสไปที่ปุ่มลองใหม่', async () => {
    renderView(video(), fakeLinks(false, null))
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()

    fireEvent.error(screen.getByLabelText('วิดีโอ if-elif-else'))

    expect(await screen.findByRole('button', { name: 'ลองใหม่' })).not.toHaveFocus()
    expect(outside).toHaveFocus()
    outside.remove()
  })

  it('หัวข้อในข้อความ / คำอธิบายของผู้สอนเริ่มที่ h5 (อยู่ใต้หัวข้อเนื้อหา h4)', () => {
    renderView(item({ body: '# ส่วนที่ 1\n\n### ย่อย' }))
    expect(screen.getByRole('heading', { name: 'ส่วนที่ 1' }).tagName).toBe('H5')
    expect(screen.getByRole('heading', { name: 'ย่อย' }).tagName).toBe('H6')
  })

  it('คำอธิบายของชนิดอื่นก็เริ่มที่ h5', () => {
    renderView(pdf({ body: '## อ่านก่อน' }))
    expect(screen.getByRole('heading', { name: 'อ่านก่อน' }).tagName).toBe('H5')
  })
})
