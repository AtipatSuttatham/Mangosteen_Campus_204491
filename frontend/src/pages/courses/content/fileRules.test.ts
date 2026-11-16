/**
 * test ของกติกาไฟล์ฝั่งหน้าเว็บ (ขั้น 4.6 — กย1) — ต้องตรงกับ backend content/file_types.py
 */
import { describe, expect, it } from 'vitest'
import {
  acceptFor,
  checkFile,
  CONTENT_MAX_BYTES,
  CONTENT_VIDEO_MAX_BYTES,
  fileExtension,
  fileKindOf,
} from './fileRules'

const MB = 1024 * 1024

describe('fileKindOf', () => {
  it.each([
    ['บทที่ 1.pdf', 'file'],
    ['สไลด์.PPTX', 'file'],
    ['ตาราง.xlsx', 'file'],
    ['งาน.docx', 'file'],
    ['โน้ต.txt', 'file'],
    ['ตัวอย่าง.py', 'file'],
    ['ชุด.zip', 'file'],
    ['รูป.JPG', 'image'],
    ['รูป.jpeg', 'image'],
    ['รูป.png', 'image'],
    ['รูป.gif', 'image'],
    ['รูป.webp', 'image'],
    ['เสียง.mp3', 'audio'],
    ['เสียง.m4a', 'audio'],
    ['คลิป.mp4', 'video'],
    ['คลิป.webm', 'video'],
  ])('%s → %s', (name, kind) => {
    expect(fileKindOf(name)).toBe(kind)
  })

  it.each(['หน้า.html', 'ภาพ.svg', 'โปรแกรม.exe', 'ไม่มีนามสกุล', '.pdf'])('%s → ไม่รับ', (name) => {
    expect(fileKindOf(name)).toBeNull()
  })
})

describe('fileExtension / acceptFor', () => {
  it('นามสกุลตัวพิมพ์เล็กมีจุด ; ไม่มีนามสกุล = ว่าง', () => {
    expect(fileExtension('ก.ข.PDF')).toBe('.pdf')
    expect(fileExtension('README')).toBe('')
  })

  it('accept ของชนิดเดียว / ทุกชนิด', () => {
    expect(acceptFor('audio')).toBe('.mp3,.m4a')
    expect(acceptFor().split(',')).toHaveLength(16)
  })
})

describe('checkFile', () => {
  it('ผ่าน → null (ขนาดเท่าเพดานพอดีผ่าน)', () => {
    expect(checkFile({ name: 'a.pdf', size: CONTENT_MAX_BYTES })).toBeNull()
    expect(checkFile({ name: 'a.mp4', size: CONTENT_VIDEO_MAX_BYTES })).toBeNull()
  })

  it('นามสกุลไม่รับ', () => {
    expect(checkFile({ name: 'ใบงาน3.exe', size: 10 })).toEqual({
      code: 'type_not_allowed',
      extension: '.exe',
    })
  })

  it('ต้องเป็นชนิดเดิม (เปลี่ยนไฟล์)', () => {
    expect(checkFile({ name: 'a.png', size: 10 }, 'file')).toEqual({
      code: 'kind_mismatch',
      expected: 'file',
    })
    expect(checkFile({ name: 'a.docx', size: 10 }, 'file')).toBeNull()
  })

  it('ไฟล์ว่าง', () => {
    expect(checkFile({ name: 'a.txt', size: 0 })).toEqual({ code: 'empty' })
  })

  it('ใหญ่เกิน: เอกสาร 20 MB / วิดีโอ 100 MB', () => {
    expect(checkFile({ name: 'a.pdf', size: 20 * MB + 1 })).toEqual({
      code: 'too_large',
      kind: 'file',
      maxBytes: 20 * MB,
    })
    expect(checkFile({ name: 'lecture.mp4', size: 312 * MB })).toEqual({
      code: 'too_large',
      kind: 'video',
      maxBytes: 100 * MB,
    })
  })
})
