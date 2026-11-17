/**
 * วิดีโอ / รูป / เสียงในหน้าบทเรียน (ขั้น 4.7 ก — board "บทเรียนของผู้เรียน")
 *
 *   ExpandBox    กรอบที่ "ขยาย / ย่อ" ได้ (กซ1 + กณ1): จอใหญ่เริ่มกว้าง 320px + ปุ่มมุมขวาบน → เต็มความกว้าง
 *                มือถือเต็มความกว้างเสมอและไม่มีปุ่ม ; ไม่จำค่า (เปิดหน้าใหม่กลับเป็น 320px)
 *   FileVideo / FileAudio / FileImage   ตัวเล่น / รูปจากไฟล์ที่อัปโหลด
 *
 * ลิงก์หมดอายุ (ขง1):
 * - ตัวเล่นจำลิงก์ของตัวเองตั้งแต่วาดครั้งแรก — ข้อมูลที่โหลดใหม่ภายหลังไม่เปลี่ยนลิงก์ของวิดีโอที่กำลังเล่น (ไม่สะดุด)
 * - โหลดไฟล์ไม่ได้ → ขอรายการใหม่ 1 ครั้ง ได้ลิงก์ใหม่ → ใช้ลิงก์ใหม่แล้วเล่นต่อจากตำแหน่งเดิม
 * - ยังไม่ได้ (หรือได้ลิงก์เดิม = ปัญหาไม่ใช่ลิงก์หมดอายุ) → "โหลดไฟล์ไม่สำเร็จ" + ปุ่มลองใหม่ (ไม่วนขอเอง)
 */
import { useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui'
import { ExpandIcon, ShrinkIcon } from './lessonIcons'
import { useLinks } from './useFreshLinks'

/** กรอบขยาย / ย่อ — children คือตัวเล่น / รูป */
export function ExpandBox({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()
  const [big, setBig] = useState(false)
  return (
    <div className={'relative ' + (big ? '' : 'lg:max-w-[320px]')}>
      {children}
      {/* ชื่อปุ่มเปลี่ยนตามสิ่งที่จะเกิด (ขยาย ↔ ย่อ) และบอกชื่อเนื้อหา — มือถือซ่อน (เต็มจออยู่แล้ว) */}
      <button
        type="button"
        onClick={() => setBig((value) => !value)}
        aria-label={t(big ? 'lesson.shrinkLabel' : 'lesson.expandLabel', { title })}
        className={
          'absolute top-2.5 right-2.5 hidden h-[34px] cursor-pointer items-center gap-1.5 rounded-control ' +
          'border border-line-strong bg-surface/95 px-3 text-[13.5px] font-semibold text-ink hover:border-brand ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:inline-flex'
        }
      >
        {big ? <ShrinkIcon /> : <ExpandIcon />}
        {t(big ? 'lesson.shrink' : 'lesson.expand')}
      </button>
    </div>
  )
}

type MediaElement = HTMLVideoElement | HTMLAudioElement

/**
 * ลิงก์ของตัวเล่น 1 ตัว + กู้คืนเมื่อโหลดไม่ได้
 * - `version` เปลี่ยน = วาดตัวเล่นใหม่ (ใช้ตอนกด "ลองใหม่" ด้วยลิงก์เดิม)
 * - `onLoaded` คืนตำแหน่งที่เล่นค้างไว้ + เล่นต่อถ้ากำลังเล่นอยู่ตอนเกิดปัญหา
 */
function useRecoverableSrc(contentId: number, initialSrc: string) {
  const links = useLinks()
  const [src, setSrc] = useState(initialSrc)
  const [version, setVersion] = useState(0)
  const [failed, setFailed] = useState(false)
  // ขอลิงก์ใหม่ไปแล้วหรือยัง (ครั้งเดียวต่อปัญหา — กันวนขอไม่รู้จบ)
  const triedRef = useRef(false)
  // กำลังเล่นอยู่ไหม (ดูจากเหตุการณ์ play / pause — ตอน error เบราว์เซอร์อาจหยุดเองก่อน)
  const playingRef = useRef(false)
  const resumeRef = useRef<{ time: number; play: boolean } | null>(null)

  const onError = (event: SyntheticEvent<HTMLElement>) => {
    const element = event.currentTarget
    if ('currentTime' in element) {
      const media = element as MediaElement
      resumeRef.current = { time: media.currentTime, play: playingRef.current }
    }
    if (triedRef.current) {
      setFailed(true)
      return
    }
    triedRef.current = true
    void links.refresh().then((lookup) => {
      const next = lookup?.(contentId)?.file_link
      if (next && next !== src) setSrc(next)
      else setFailed(true)
    })
  }

  const onLoaded = (event: SyntheticEvent<MediaElement>) => {
    const resume = resumeRef.current
    if (!resume) return
    resumeRef.current = null
    const media = event.currentTarget
    if (resume.time > 0) media.currentTime = resume.time
    if (resume.play) void media.play().catch(() => undefined)
  }

  const retry = () => {
    triedRef.current = false
    setFailed(false)
    setVersion((value) => value + 1)
  }

  const playEvents = {
    onPlay: () => {
      playingRef.current = true
    },
    onPause: (event: SyntheticEvent<MediaElement>) => {
      // pause ที่เกิดจาก error ไม่นับ (จะได้เล่นต่อหลังได้ลิงก์ใหม่)
      if (!event.currentTarget.error) playingRef.current = false
    },
  }

  return { src, version, failed, onError, onLoaded, retry, playEvents }
}

/** กล่องแทนตัวเล่นเมื่อโหลดไม่ได้ */
function MediaFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2.5 rounded-[12px] border border-bad-line bg-bad-soft px-4 py-3.5 text-[14.5px] text-bad"
    >
      <span className="font-semibold">{t('lesson.mediaFailed')}</span>
      <Button variant="secondary" onClick={onRetry}>
        {t('lesson.retry')}
      </Button>
    </div>
  )
}

type FileMediaProps = { contentId: number; title: string; src: string; allowDownload: boolean }

/** วิดีโอที่อัปโหลด — preload="metadata" ไม่โหลดไฟล์ทั้งก้อนจนกว่าจะกดเล่น */
export function FileVideo({ contentId, title, src: initialSrc, allowDownload }: FileMediaProps) {
  const { t } = useTranslation()
  const media = useRecoverableSrc(contentId, initialSrc)
  if (media.failed) return <MediaFailed onRetry={media.retry} />
  return (
    <video
      key={media.version}
      src={media.src}
      controls
      preload="metadata"
      // ปิดดาวน์โหลด: ซ่อนเมนูดาวน์โหลดของตัวเล่น (ลดการกดโดยง่าย — ไม่ใช่การป้องกันจริง)
      controlsList={allowDownload ? undefined : 'nodownload'}
      aria-label={t('lesson.videoLabel', { title })}
      onError={media.onError}
      onLoadedMetadata={media.onLoaded}
      {...media.playEvents}
      className="block aspect-video w-full rounded-[12px] bg-ink"
    />
  )
}

/** เสียงที่อัปโหลด — ตัวเล่นของเบราว์เซอร์เต็มความกว้าง */
export function FileAudio({ contentId, title, src: initialSrc, allowDownload }: FileMediaProps) {
  const { t } = useTranslation()
  const media = useRecoverableSrc(contentId, initialSrc)
  if (media.failed) return <MediaFailed onRetry={media.retry} />
  return (
    <audio
      key={media.version}
      src={media.src}
      controls
      preload="metadata"
      controlsList={allowDownload ? undefined : 'nodownload'}
      aria-label={t('lesson.audioLabel', { title })}
      onError={media.onError}
      onLoadedMetadata={media.onLoaded}
      {...media.playEvents}
      className="block w-full"
    />
  )
}

/** รูปที่อัปโหลด — ข้อความแทนรูปคือหัวข้อ (ผู้สอนตั้ง / ชื่อไฟล์) */
export function FileImage({ contentId, title, src: initialSrc }: Omit<FileMediaProps, 'allowDownload'>) {
  const media = useRecoverableSrc(contentId, initialSrc)
  if (media.failed) return <MediaFailed onRetry={media.retry} />
  return (
    <img
      key={media.version}
      src={media.src}
      alt={title}
      loading="lazy"
      onError={media.onError}
      className="block h-auto w-full rounded-[12px] border border-line bg-surface"
    />
  )
}
