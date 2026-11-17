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
 * - โหลดสำเร็จแล้วนับใหม่ — เปิดหน้าไว้นานจนลิงก์ใหม่หมดอายุอีกรอบก็ขอใหม่ได้อีก (แก้หลังตรวจขั้น 4.7 ก — ขฉ1)
 *
 * โฟกัส (กติกาเดียวกับ กภ1 / กฮ1 — ของที่โฟกัสอยู่ถูกถอดออกต้องไม่ทิ้งโฟกัสไปต้นหน้า):
 * - ตัวเล่นที่โฟกัสอยู่กลายเป็นกล่องแจ้งปัญหา → โฟกัสปุ่ม "ลองใหม่"
 * - กด "ลองใหม่" (กล่องหายไปพร้อมปุ่ม) → โฟกัสตัวเล่น / รูปที่วาดใหม่
 */
import { useCallback, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
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
  // หลังวาดครั้งถัดไปต้องโฟกัสอะไร (ตัวเล่น / ปุ่มลองใหม่) — ใช้ใน callback ref ตอนวาดเสร็จ
  const focusNextRef = useRef<'media' | 'retry' | null>(null)

  const onError = (event: SyntheticEvent<HTMLElement>) => {
    const element = event.currentTarget
    // ผู้ใช้อยู่ที่ตัวเล่นนี้ → ถ้ากลายเป็นกล่องแจ้งปัญหา ให้โฟกัสปุ่มลองใหม่
    focusNextRef.current = document.activeElement === element ? 'retry' : null
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

  /** โหลดไฟล์สำเร็จ (ข้อมูลต้นไฟล์ / รูป) — ลิงก์นี้ใช้ได้ ปัญหาครั้งต่อไปขอลิงก์ใหม่ได้อีก */
  const onReady = () => {
    triedRef.current = false
  }

  const onLoaded = (event: SyntheticEvent<MediaElement>) => {
    onReady()
    const resume = resumeRef.current
    if (!resume) return
    resumeRef.current = null
    const media = event.currentTarget
    if (resume.time > 0) media.currentTime = resume.time
    if (resume.play) void media.play().catch(() => undefined)
  }

  const retry = () => {
    focusNextRef.current = 'media'
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

  // callback ref: React เรียกตอนวาดเสร็จ — โฟกัสตามที่ตั้งไว้แล้วล้างค่า
  const attachMedia = useCallback((element: HTMLElement | null) => {
    if (element && focusNextRef.current === 'media') {
      focusNextRef.current = null
      element.focus()
    }
  }, [])
  const attachRetry = useCallback((element: HTMLButtonElement | null) => {
    if (element && focusNextRef.current === 'retry') {
      focusNextRef.current = null
      element.focus()
    }
  }, [])

  return { src, version, failed, onError, onLoaded, onReady, retry, playEvents, attachMedia, attachRetry }
}

/** กล่องแทนตัวเล่นเมื่อโหลดไม่ได้ */
function MediaFailed({
  onRetry,
  attachButton,
}: {
  onRetry: () => void
  attachButton: (element: HTMLButtonElement | null) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2.5 rounded-[12px] border border-bad-line bg-bad-soft px-4 py-3.5 text-[14.5px] text-bad"
    >
      <span className="font-semibold">{t('lesson.mediaFailed')}</span>
      <Button ref={attachButton} variant="secondary" onClick={onRetry}>
        {t('lesson.retry')}
      </Button>
    </div>
  )
}

type FileMediaProps = { contentId: number; title: string; src: string; allowDownload: boolean }

/** วิดีโอที่อัปโหลด — preload="metadata" ไม่โหลดไฟล์ทั้งก้อนจนกว่าจะกดเล่น */
export function FileVideo({ contentId, title, src: initialSrc, allowDownload }: FileMediaProps) {
  const { t } = useTranslation()
  const { attachMedia, attachRetry, ...media } = useRecoverableSrc(contentId, initialSrc)
  if (media.failed) return <MediaFailed onRetry={media.retry} attachButton={attachRetry} />
  return (
    <video
      key={media.version}
      ref={attachMedia}
      // ตัวเล่นที่มีปุ่มควบคุมรับโฟกัสอยู่แล้วใน Chrome — ระบุให้ชัดเพื่อคืนโฟกัสหลังกด "ลองใหม่" ได้ทุกเบราว์เซอร์
      tabIndex={0}
      src={media.src}
      controls
      preload="metadata"
      // ปิดดาวน์โหลด: ซ่อนเมนูดาวน์โหลดของตัวเล่น (ลดการกดโดยง่าย — ไม่ใช่การป้องกันจริง)
      controlsList={allowDownload ? undefined : 'nodownload'}
      aria-label={t('lesson.videoLabel', { title })}
      onError={media.onError}
      onLoadedMetadata={media.onLoaded}
      {...media.playEvents}
      className="block aspect-video w-full rounded-[12px] bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    />
  )
}

/** เสียงที่อัปโหลด — ตัวเล่นของเบราว์เซอร์เต็มความกว้าง */
export function FileAudio({ contentId, title, src: initialSrc, allowDownload }: FileMediaProps) {
  const { t } = useTranslation()
  const { attachMedia, attachRetry, ...media } = useRecoverableSrc(contentId, initialSrc)
  if (media.failed) return <MediaFailed onRetry={media.retry} attachButton={attachRetry} />
  return (
    <audio
      key={media.version}
      ref={attachMedia}
      tabIndex={0}
      src={media.src}
      controls
      preload="metadata"
      controlsList={allowDownload ? undefined : 'nodownload'}
      aria-label={t('lesson.audioLabel', { title })}
      onError={media.onError}
      onLoadedMetadata={media.onLoaded}
      {...media.playEvents}
      className="block w-full rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    />
  )
}

/** รูปที่อัปโหลด — ข้อความแทนรูปคือหัวข้อ (ผู้สอนตั้ง / ชื่อไฟล์) */
export function FileImage({ contentId, title, src: initialSrc }: Omit<FileMediaProps, 'allowDownload'>) {
  const { attachMedia, attachRetry, ...media } = useRecoverableSrc(contentId, initialSrc)
  if (media.failed) return <MediaFailed onRetry={media.retry} attachButton={attachRetry} />
  return (
    <img
      key={media.version}
      ref={attachMedia}
      // ไม่อยู่ในลำดับ Tab แต่รับโฟกัสจากโปรแกรมได้ (คืนโฟกัสหลังกด "ลองใหม่")
      tabIndex={-1}
      onLoad={media.onReady}
      src={media.src}
      alt={title}
      loading="lazy"
      onError={media.onError}
      className="block h-auto w-full rounded-[12px] border border-line bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    />
  )
}
