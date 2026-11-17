/**
 * ข้อความรายละเอียดใต้ชื่อเนื้อหา (ตาม board "แท็บเนื้อหา (ผู้สอน)") — ขั้น 4.5
 *   ข้อความ        → "ข้อความ"
 *   เอกสาร         → "PDF 2.1 MB" / "Word 340 KB" / "ไฟล์ .py 3 KB"
 *   รูป / เสียง / วิดีโอ → "รูปภาพ PNG 340 KB" / "เสียง M4A 4.8 MB" / "วิดีโอ MP4 64.2 MB"
 *   วิดีโอ YouTube  → "วิดีโอจาก YouTube"
 *   ลิงก์           → "ลิงก์ docs.python.org"
 *   ปิดดาวน์โหลด   → ต่อท้าย "ปิดการดาวน์โหลด" (แท็บผู้สอนบอกเฉพาะไฟล์ที่ปิด — กฑ2)
 * ข้อความทั้งหมดมาจาก th.ts (กฎ i18n) — ไฟล์นี้แค่เลือกรหัสข้อความและเติมค่า
 */
import type { TFunction } from 'i18next'
import type { StudentContent } from '../../../api/content'

/** นามสกุลไฟล์แบบตัวพิมพ์ใหญ่ เช่น "บท.pdf" → "PDF" ; ไม่มี = '' */
function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : ''
}

/** ชื่อเว็บไซต์จากลิงก์ เช่น https://www.python.org/x → python.org (อ่านไม่ได้ = ลิงก์เดิม) — ใช้ในหน้าบทเรียนด้วย */
export function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * กติกาหารหัสวิดีโอ YouTube — ⚠ สำเนาของ backend content/youtube.py (youtube_video_id) แก้ที่นั่นต้องแก้ที่นี่ด้วย
 * ใช้แค่ขึ้นคำแนะนำใต้ช่องลิงก์ (ขั้น 4.6) — backend เป็นคนตัดสินชนิดจริงเสมอ
 * (แก้หลังตรวจขั้น 4.6 ก — กศ1: เดิมดูแค่ชื่อเว็บ ลิงก์ช่อง / เพลย์ลิสต์ของ YouTube จึงถูกบอกว่าเป็นวิดีโอ)
 */
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])
const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be'])
/** รูปแบบที่อยู่ที่มีรหัสวิดีโอเป็นส่วนที่ 2 เช่น /shorts/<รหัส>, /embed/<รหัส> */
const YOUTUBE_ID_PATH_PREFIXES = new Set(['shorts', 'embed', 'live', 'v'])
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** รหัสวิดีโอ 11 ตัวถ้าเป็นลิงก์วิดีโอ YouTube ที่รู้จัก ; ไม่ใช่ (รวมลิงก์ช่อง / เพลย์ลิสต์) → null */
export function youtubeVideoId(url: string): string | null {
  let parts: URL
  try {
    parts = new URL(url.trim())
  } catch {
    return null
  }
  if (parts.protocol !== 'http:' && parts.protocol !== 'https:') return null
  const host = parts.hostname.toLowerCase()
  const segments = parts.pathname.split('/').filter(Boolean)

  let candidate: string | null | undefined = null
  if (YOUTUBE_SHORT_HOSTS.has(host) && segments.length > 0) {
    // https://youtu.be/<รหัส>
    candidate = segments[0]
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (parts.pathname === '/watch') {
      // https://www.youtube.com/watch?v=<รหัส>
      candidate = parts.searchParams.get('v')
    } else if (segments.length >= 2 && YOUTUBE_ID_PATH_PREFIXES.has(segments[0]!)) {
      candidate = segments[1]
    }
  }
  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null
}

/**
 * ขนาดไฟล์อ่านง่าย: < 1 KB = ไบต์, < 1 MB = KB (จำนวนเต็ม), อื่น ๆ = MB ทศนิยม 1 ตำแหน่ง
 * ตัดสินจากค่าที่ปัดแล้ว — ไฟล์เกือบ 1 MB (ปัดได้ 1024 KB) แสดง "1.0 MB" ไม่ใช่ "1024 KB" (แก้หลังตรวจขั้น 4.5)
 */
export function formatFileSize(bytes: number, t: TFunction): string {
  if (bytes < 1024) return t('content.sizeBytes', { size: bytes })
  const kb = Math.round(bytes / 1024)
  if (kb < 1024) return t('content.sizeKb', { size: kb })
  return t('content.sizeMb', { size: (bytes / (1024 * 1024)).toFixed(1) })
}

/** ชนิดของเอกสารตามชื่อไฟล์ (PDF / Word / ไฟล์ .py) — การ์ดไฟล์ในหน้าบทเรียน (ขั้น 4.7) */
export function documentKindLabel(fileName: string, t: TFunction): string {
  return documentLabel(extension(fileName), t)
}

/** ชนิดของเอกสารตามนามสกุล (PDF / Word / PowerPoint / Excel / ไฟล์ .xxx) */
function documentLabel(ext: string, t: TFunction): string {
  switch (ext) {
    case 'PDF':
      return t('content.kindPdf')
    case 'DOCX':
      return t('content.kindWord')
    case 'PPTX':
      return t('content.kindPowerPoint')
    case 'XLSX':
      return t('content.kindExcel')
    default:
      return t('content.kindFileExt', { ext: ext.toLowerCase() })
  }
}

/** รายการข้อความรายละเอียดของเนื้อหา 1 ชิ้น (แสดงคั่นด้วยช่องว่าง) */
export function contentMeta(content: StudentContent, t: TFunction): string[] {
  const ext = extension(content.file_name)
  const size = content.file_size != null ? [formatFileSize(content.file_size, t)] : []
  const downloadOff = content.file_link && !content.allow_download ? [t('content.downloadOff')] : []

  switch (content.content_type) {
    case 'text':
      return [t('content.kindText')]
    case 'link':
      return [t('content.kindLink', { site: siteName(content.external_url) })]
    case 'video':
      if (content.youtube_id || !content.file_link) return [t('content.kindYoutube')]
      return [t('content.kindVideo', { ext }), ...size, ...downloadOff]
    case 'image':
      return [t('content.kindImage', { ext }), ...size, ...downloadOff]
    case 'audio':
      return [t('content.kindAudio', { ext }), ...size, ...downloadOff]
    case 'file':
      return [documentLabel(ext, t), ...size, ...downloadOff]
  }
}
