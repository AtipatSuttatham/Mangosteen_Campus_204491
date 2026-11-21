/**
 * ส่วนแสดงผลกลางของเนื้อหา 1 ชิ้น (ขั้น 4.7 — กฟ1: ใช้ทั้งหน้าบทเรียนของผู้เรียนและตัวอย่างในแท็บผู้สอน)
 * หน้าตาตาม board "บทเรียนของผู้เรียน" (จอใหญ่ + มือถือ) แถวก้อน 4
 *
 *   ข้อความ          หัวข้อ + เนื้อความ Markdown
 *   วิดีโอ YouTube    กรอบ 16:9 เล่นในหน้า (youtube-nocookie.com — กฉ1) + ขยาย / ย่อ
 *   วิดีโออัปโหลด     ตัวเล่น + ขยาย / ย่อ + ชื่อไฟล์ ขนาด ดาวน์โหลด
 *   รูป              รูป + ขยาย / ย่อ + ชื่อไฟล์ ขนาด ดาวน์โหลด
 *   เสียง            ตัวเล่น + ชื่อไฟล์ ขนาด ดาวน์โหลด
 *   ไฟล์ (เอกสาร)    การ์ดไฟล์ + เปิด (PDF / .txt) + ดาวน์โหลด
 *   ลิงก์             ปุ่ม "เปิดลิงก์ <ชื่อเว็บ>" แท็บใหม่
 *
 * - ชนิดอื่นที่ไม่ใช่ข้อความ: ผู้สอนเขียนคำอธิบายไว้ (body) → แสดงเป็น Markdown ใต้หัวข้อ
 * - รับข้อมูลแบบ StudentContent — ข้อมูลของผู้สอน (Content) ส่งเข้ามาได้เลยเพราะมีช่องครบ
 * - ไม่จัดการสิทธิ์เอง: backend ส่งเฉพาะสิ่งที่ผู้ใช้คนนั้นเห็นได้
 */
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudentContent } from '../../../api/content'
import { buttonClassName, Markdown } from '../../../components/ui'
import { siteName } from '../content/contentLabels'
import { FileCard, FileLine } from './FileActions'
import { ExternalIcon } from './lessonIcons'
import { ExpandBox, FileAudio, FileImage, FileVideo } from './MediaBox'

type ContentViewProps = {
  content: StudentContent
  /** แสดงหัวข้อไหม — ตัวอย่างในแท็บผู้สอนมีชื่ออยู่ในแถวแล้ว (ขั้น 4.7 ข) */
  showTitle?: boolean
  /**
   * ระดับหัวข้อ (# / ##) ในข้อความของผู้สอน — ให้ต่ำกว่าหัวข้อที่ครอบอยู่ (ค่าเริ่มต้น 5: หน้าบทเรียนอยู่ใต้ h4 ชื่อเนื้อหา)
   * แท็บผู้สอนมีแค่ h2 "หน่วยการเรียน" จึงใช้ 3 (แก้หลังตรวจขั้น 4.7 — ไม่ให้ลำดับหัวข้อกระโดด h2 → h5)
   */
  headingLevel?: ComponentProps<typeof Markdown>['headingLevel']
}

/** เนื้อหา 1 ชิ้นแบบที่ผู้เรียนเห็น */
export function ContentView({ content, showTitle = true, headingLevel = 5 }: ContentViewProps) {
  const isText = content.content_type === 'text'
  const description = isText ? '' : content.body.trim()

  return (
    <article className="flex flex-col gap-2">
      {showTitle && (
        <h4 className="m-0 font-display text-lg leading-[1.4] font-semibold break-words">{content.title}</h4>
      )}
      {/* หัวข้อในข้อความของผู้สอนอยู่ใต้หัวข้อที่ครอบอยู่ (หน้าบทเรียน h4 → เริ่ม h5) ไม่แทรกลำดับหัวข้อของหน้า */}
      {description && <Markdown text={description} headingLevel={headingLevel} className="text-ink-muted" />}
      <ContentBody content={content} headingLevel={headingLevel} />
    </article>
  )
}

/** ส่วนเนื้อของแต่ละชนิด */
function ContentBody({
  content,
  headingLevel,
}: {
  content: StudentContent
  headingLevel: ContentViewProps['headingLevel']
}) {
  const { t } = useTranslation()
  const allowDownload = content.allow_download && content.download_link != null

  switch (content.content_type) {
    case 'text':
      return (
        <Markdown
          text={content.body}
          headingLevel={headingLevel}
          className="lg:text-[15.5px] lg:leading-[1.75]"
        />
      )

    case 'video':
      if (content.youtube_id) {
        return (
          <ExpandBox title={content.title}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${content.youtube_id}`}
              title={t('lesson.youtubeTitle', { title: content.title })}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              // YouTube ต้องการที่มาของหน้า (ไม่ส่งเลยบางวิดีโอเล่นไม่ได้) — ส่งแค่โดเมน ไม่ส่งที่อยู่เต็ม
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
              className="block aspect-video w-full rounded-[12px] border-0 bg-ink"
            />
          </ExpandBox>
        )
      }
      if (content.file_link) {
        return (
          <div>
            <ExpandBox title={content.title}>
              <FileVideo
                contentId={content.id}
                title={content.title}
                src={content.file_link}
                allowDownload={allowDownload}
              />
            </ExpandBox>
            <FileLine content={content} />
          </div>
        )
      }
      // วิดีโอแบบลิงก์ที่ไม่ใช่ YouTube (ไม่ควรเกิด — backend ตั้งเป็นชนิดลิงก์) → เปิดลิงก์แทน
      return <ExternalLink url={content.external_url} />

    case 'image':
      if (!content.file_link) return null
      return (
        <div>
          <ExpandBox title={content.title}>
            <FileImage contentId={content.id} title={content.title} src={content.file_link} />
          </ExpandBox>
          <FileLine content={content} />
        </div>
      )

    case 'audio':
      if (!content.file_link) return null
      return (
        <div>
          <FileAudio
            contentId={content.id}
            title={content.title}
            src={content.file_link}
            allowDownload={allowDownload}
          />
          <FileLine content={content} />
        </div>
      )

    case 'file':
      return <FileCard content={content} />

    case 'link':
      return <ExternalLink url={content.external_url} />
  }
}

/** ปุ่มเปิดลิงก์ภายนอกในแท็บใหม่ */
function ExternalLink({ url }: { url: string }) {
  const { t } = useTranslation()
  if (!url) return null
  const site = siteName(url)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('lesson.openLinkLabel', { site })}
      className={`${buttonClassName('secondary')} w-fit max-w-full`}
    >
      <span className="truncate">{t('lesson.openLink', { site })}</span>
      <ExternalIcon />
    </a>
  )
}
