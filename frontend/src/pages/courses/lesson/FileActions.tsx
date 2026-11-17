/**
 * ปุ่ม "เปิด" / "ดาวน์โหลด" ของไฟล์ในหน้าบทเรียน (ขั้น 4.7 ก — board "บทเรียนของผู้เรียน")
 *
 *   FileCard   เอกสาร: [ไอคอน] ชื่อไฟล์ / "PDF  2.1 MB"            [เปิด] [ดาวน์โหลด]
 *   FileLine   ใต้วิดีโอ / รูป / เสียง: ชื่อไฟล์  ขนาด             [ดาวน์โหลด] หรือ "ผู้สอนปิดการดาวน์โหลดไฟล์นี้"
 *
 * - "เปิด" มีเฉพาะไฟล์ที่เบราว์เซอร์เปิดดูได้: PDF และ .txt (ค่ามาตรฐานที่แจ้งผู้ใช้แล้ว —
 *   .txt ปิดการดาวน์โหลดได้ตาม กพ1 ถ้าไม่มี "เปิด" ผู้เรียนจะดูไฟล์ไม่ได้เลย)
 * - ปิดดาวน์โหลด (กฑ2): ไม่มีปุ่ม + ข้อความเทา — ผู้เรียนไม่ได้ลิงก์ดาวน์โหลดจาก backend อยู่แล้ว
 *   แท็บผู้สอน (ขั้น 4.7 ข) ได้ลิงก์เสมอ จึงดู allow_download ด้วย ให้เห็นเหมือนผู้เรียน
 * - ลิงก์หมดอายุ (ขง1): ข้อมูลเก่ากว่า 50 นาที → ขอรายการใหม่ก่อน
 *     เปิด      = เปิดแท็บเปล่าทันทีตอนกด (ถ้ารอผลก่อนแล้วค่อยเปิด เบราว์เซอร์จะบล็อกเป็นป๊อปอัป) แล้วส่งไปลิงก์ใหม่
 *     ดาวน์โหลด = ได้ลิงก์ใหม่แล้วสั่งดาวน์โหลดผ่านลิงก์ชั่วคราว (การดาวน์โหลดไม่ถูกบล็อกแบบป๊อปอัป)
 *   ขอไม่สำเร็จ → ข้อความแดงใต้ไฟล์
 */
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudentContent } from '../../../api/content'
import { buttonClassName } from '../../../components/ui'
import { ContentKindIcon } from '../content/contentIcons'
import { documentKindLabel, formatFileSize } from '../content/contentLabels'
import { DownloadIcon, NoDownloadIcon, OpenIcon } from './lessonIcons'
import { useLinks } from './useFreshLinks'

/** ชนิดไฟล์ที่มีปุ่ม "เปิด" */
const OPENABLE_MIME = new Set(['application/pdf', 'text/plain'])

/** ลิงก์ดาวน์โหลดที่ผู้เรียนใช้ได้จริง (ปิดดาวน์โหลด = ไม่มี) */
function downloadLinkOf(content: StudentContent): string | null {
  return content.allow_download ? content.download_link : null
}

const SMALL_BUTTON = `${buttonClassName('secondary')} h-10! px-3.5!`

/** ปุ่ม เปิด / ดาวน์โหลด หรือข้อความปิดดาวน์โหลด + ข้อความแดงเมื่อขอลิงก์ใหม่ไม่สำเร็จ */
function Actions({ content, withOpen }: { content: StudentContent; withOpen: boolean }) {
  const { t } = useTranslation()
  const links = useLinks()
  const [failed, setFailed] = useState(false)
  const download = downloadLinkOf(content)
  const canOpen = withOpen && content.file_link && OPENABLE_MIME.has(content.mime_type)

  /** เปิดในแท็บใหม่ — ลิงก์เก่าเกินไปให้เปิดแท็บก่อน แล้วค่อยส่งไปลิงก์ใหม่ */
  const onOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    setFailed(false)
    if (!links.isStale()) return
    event.preventDefault()
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null // กันหน้าที่เปิดเข้าถึงหน้าเรา (แทน rel="noopener" ที่ใช้กับ window.open ตรงนี้ไม่ได้)
    void links.refresh().then((lookup) => {
      const url = lookup?.(content.id)?.file_link
      if (url && tab) tab.location.href = url
      else {
        tab?.close()
        setFailed(true)
      }
    })
  }

  /** ดาวน์โหลด — ลิงก์เก่าเกินไปให้ขอใหม่แล้วสั่งดาวน์โหลดด้วยลิงก์ใหม่ */
  const onDownload = (event: MouseEvent<HTMLAnchorElement>) => {
    setFailed(false)
    if (!links.isStale()) return
    event.preventDefault()
    void links.refresh().then((lookup) => {
      const fresh = lookup?.(content.id)
      const url = fresh ? downloadLinkOf(fresh) : null
      if (!url) {
        setFailed(true)
        return
      }
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = content.file_name
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    })
  }

  return (
    <>
      {canOpen && (
        <a
          href={content.file_link ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          aria-label={t('lesson.openLabel', { name: content.file_name })}
          className={SMALL_BUTTON}
        >
          <OpenIcon />
          {t('lesson.open')}
        </a>
      )}
      {download ? (
        <a
          href={download}
          // ตอนพัฒนา (ลิงก์ในเครื่อง) ใช้ download ให้ได้ชื่อเดิม ; ตอน deploy B2 ใส่ชื่อเดิมให้เอง (กค1)
          download={content.file_name}
          onClick={onDownload}
          aria-label={t('lesson.downloadLabel', { name: content.file_name })}
          className={SMALL_BUTTON}
        >
          <DownloadIcon />
          {t('lesson.download')}
        </a>
      ) : (
        content.file_link && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
            <NoDownloadIcon />
            {t('lesson.downloadOff')}
          </span>
        )
      )}
      {failed && (
        <p role="alert" className="m-0 basis-full text-[13.5px] text-bad">
          {t('lesson.linkFailed')}
        </p>
      )}
    </>
  )
}

/** ขนาดไฟล์ (ไม่มี = ไม่แสดง) */
function SizeText({ content }: { content: StudentContent }) {
  const { t } = useTranslation()
  return content.file_size != null ? <span>{formatFileSize(content.file_size, t)}</span> : null
}

/** การ์ดเอกสาร (ชนิด "ไฟล์") */
export function FileCard({ content }: { content: StudentContent }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[12px] border border-line bg-surface px-3.5 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-canvas text-brand">
        <ContentKindIcon kind="file" />
      </span>
      <div className="min-w-0 grow basis-40">
        <div className="text-[15px] leading-[1.45] font-semibold [overflow-wrap:anywhere]">
          {content.file_name}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13.5px] text-ink-muted">
          <span>{documentKindLabel(content.file_name, t)}</span>
          <SizeText content={content} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Actions content={content} withOpen />
      </div>
    </div>
  )
}

/** แถวใต้วิดีโอ / รูป / เสียง: ชื่อไฟล์ + ขนาด + ดาวน์โหลด */
export function FileLine({ content }: { content: StudentContent }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-[13.5px] text-ink-muted">
        <span className="[overflow-wrap:anywhere]">{content.file_name}</span>
        <SizeText content={content} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Actions content={content} withOpen={false} />
      </div>
    </div>
  )
}
