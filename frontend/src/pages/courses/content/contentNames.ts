/**
 * ชื่อชนิด / ข้อความปัญหาไฟล์ ที่หน้าต่างเพิ่ม / แก้เนื้อหาใช้ร่วมกัน (ขั้น 4.6)
 * แยกจาก contentForm.tsx เพราะไฟล์คอมโพเนนต์ควร export แต่คอมโพเนนต์ (Fast Refresh ของ Vite)
 */
import type { TFunction } from 'i18next'
import type { Content } from '../../../api/content'
import { formatFileSize } from './contentLabels'
import type { FileKind, FileProblem } from './fileRules'

/** ชื่อชนิดของเนื้อหา (วิดีโอที่เป็นลิงก์ YouTube = "วิดีโอจาก YouTube") */
export function contentKindName(content: Content, t: TFunction): string {
  switch (content.content_type) {
    case 'text':
      return t('content.kindNameText')
    case 'link':
      return t('content.kindNameLink')
    case 'video':
      return content.file_link ? t('content.kindNameVideo') : t('content.kindNameYoutube')
    case 'image':
      return t('content.kindNameImage')
    case 'audio':
      return t('content.kindNameAudio')
    case 'file':
      return t('content.kindNameFile')
  }
}

/** ชื่อชนิดไฟล์ (เอกสาร / รูปภาพ / เสียง / วิดีโอ) */
export function fileKindName(kind: FileKind, t: TFunction): string {
  switch (kind) {
    case 'file':
      return t('content.kindNameFile')
    case 'image':
      return t('content.kindNameImage')
    case 'audio':
      return t('content.kindNameAudio')
    case 'video':
      return t('content.kindNameVideo')
  }
}

/** ข้อความของปัญหาไฟล์ที่ตรวจเจอก่อนส่ง (ตาม board "อัปโหลดไม่ผ่าน") */
export function fileProblemMessage(problem: FileProblem, size: number, t: TFunction): string {
  switch (problem.code) {
    case 'type_not_allowed':
      return t('content.fileTypeNotAllowed', { ext: problem.extension || '?' })
    case 'kind_mismatch':
      return t('content.fileKindMismatch', { kind: fileKindName(problem.expected, t) })
    case 'empty':
      return t('content.fileEmpty')
    case 'too_large':
      return t('content.fileTooLarge', {
        kind: fileKindName(problem.kind, t),
        size: formatFileSize(size, t),
        max: formatFileSize(problem.maxBytes, t),
      })
  }
}
