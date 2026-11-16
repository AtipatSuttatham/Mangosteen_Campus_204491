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
import type { Content } from '../../../api/content'

/** นามสกุลไฟล์แบบตัวพิมพ์ใหญ่ เช่น "บท.pdf" → "PDF" ; ไม่มี = '' */
function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : ''
}

/** ชื่อเว็บไซต์จากลิงก์ เช่น https://www.python.org/x → python.org (อ่านไม่ได้ = ลิงก์เดิม) */
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
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
export function contentMeta(content: Content, t: TFunction): string[] {
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
