/**
 * test ของข้อความรายละเอียดเนื้อหา — ขนาดไฟล์ (แก้หลังตรวจขั้น 4.5 แบบ กภ1)
 * + กติกาหารหัสวิดีโอ YouTube (แก้หลังตรวจขั้น 4.6 ก แบบ กศ1 — กรณีเดียวกับ backend content/tests/test_youtube.py)
 */
import { describe, expect, it } from 'vitest'
import i18n from '../../../i18n'
import { formatFileSize, youtubeVideoId } from './contentLabels'

const t = i18n.t.bind(i18n)

describe('formatFileSize', () => {
  it('เลือกหน่วยตามขนาด: ไบต์ / KB / MB', () => {
    expect(formatFileSize(512, t)).toBe('512 ไบต์')
    expect(formatFileSize(340 * 1024, t)).toBe('340 KB')
    expect(formatFileSize(2.1 * 1024 * 1024, t)).toBe('2.1 MB')
  })

  it('ไฟล์เกือบ 1 MB ที่ปัดแล้วได้ 1024 KB แสดงเป็น 1.0 MB', () => {
    expect(formatFileSize(1024 * 1024 - 1, t)).toBe('1.0 MB')
    expect(formatFileSize(1024 * 1024 - 513, t)).toBe('1023 KB')
  })
})

const VIDEO_ID = 'Zp5MuPOtsSY'

describe('youtubeVideoId (สำเนาของ backend content/youtube.py)', () => {
  it.each([
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}&t=42s&si=abc`,
    `http://m.youtube.com/watch?feature=share&v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}?si=xyz`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    `  https://WWW.YOUTUBE.COM/watch?v=${VIDEO_ID}  `,
  ])('%s → ได้รหัสวิดีโอ', (url) => {
    expect(youtubeVideoId(url)).toBe(VIDEO_ID)
  })

  it.each([
    'https://docs.python.org/3/tutorial/controlflow.html',
    `https://youtube.com.evil.example/watch?v=${VIDEO_ID}`,
    `https://notyoutube.com/watch?v=${VIDEO_ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/@channel',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/',
    `javascript:alert('${VIDEO_ID}')`,
    `ftp://youtu.be/${VIDEO_ID}`,
    'ไม่ใช่ลิงก์',
  ])('%s → ไม่ใช่วิดีโอ YouTube', (url) => {
    expect(youtubeVideoId(url)).toBeNull()
  })
})
