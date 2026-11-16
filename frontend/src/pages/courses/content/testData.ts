/**
 * ข้อมูลสมมติของ test แท็บเนื้อหา (ใช้เฉพาะในไฟล์ *.test.tsx — ไม่ถูกรวมในหน้าเว็บจริง)
 */
import type { Content, Module } from '../../../api/content'

export function makeContent(id: number, overrides: Partial<Content> = {}): Content {
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

export function makeModule(id: number, overrides: Partial<Module> = {}): Module {
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
