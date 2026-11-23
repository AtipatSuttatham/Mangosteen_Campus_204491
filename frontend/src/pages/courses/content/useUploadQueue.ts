/**
 * คิวอัปโหลดหลายไฟล์ของหน้าต่าง "อัปโหลดไฟล์" (ขั้น 4.6 ข — ข้อตกลงก้อน 4 กญ1)
 * แยกส่วน "ทำงาน" ออกจากหน้าตา (UploadFilesDialog.tsx) ให้อ่านและทดสอบง่าย
 *
 * วงจรของไฟล์ 1 แถว:
 *
 *   เลือก / ลากมา ─┬─ ตรวจในหน้าเว็บไม่ผ่าน (fileRules — กย1) ──→ invalid (แดง ไม่ส่ง)
 *                 └─ ผ่าน → queued ("รอคิว" + เอาออก)
 *                              │ ถึงคิว (ส่งทีละไฟล์ตามลำดับในรายการ)
 *                              ├─ ชื่อซ้ำกับไฟล์ในหน่วย (ชซ1) → duplicate ("รอเลือก") ── คิวข้ามไปไฟล์ถัดไป
 *                              │     ยืนยัน → queued (ไม่ตรวจซ้ำอีก) ; แทนที่ → queued (ส่งเป็น "เปลี่ยนไฟล์" ของรายการเดิม)
 *                              │     เปลี่ยนชื่อ → queued ด้วยชื่อใหม่ (ถึงคิวแล้วตรวจอีกรอบ) ; ยกเลิก → cancelled
 *                              ▼
 *                         uploading (แถบความคืบหน้า + ยกเลิก ; ส่งครบทุกไบต์ = sent → ซ่อนปุ่มยกเลิก)
 *                    ┌─────────┼──────────────┐
 *                  done     failed          cancelled
 *              (อัปโหลดแล้ว) (เหตุผล ; เน็ต /     (ผู้ใช้ยกเลิก / หยุดไฟล์ที่เหลือ /
 *                         เซิร์ฟเวอร์ = ลองใหม่ได้)   วิชาถูกปิดกลางทาง)
 *
 * กติกาที่ผู้ใช้เลือก (2026-11-17):
 * - กห1: เลือก / ลากครั้งละไม่เกิน 20 ไฟล์ — เกินแล้วไม่รับทั้งชุด (ไม่มีไฟล์หายไปเงียบ ๆ)
 * - กฬ1: ไม่ผ่านเพราะเน็ต / เซิร์ฟเวอร์ → ปุ่ม "ลองใหม่" ; ไม่ผ่านเพราะตัวไฟล์ → ไม่มี (แก้ไฟล์แล้วเลือกใหม่)
 * - กอ1: "หยุดไฟล์ที่เหลือ" = ล้างคิว + หยุดไฟล์ที่กำลังส่ง (ถ้ายังส่งไม่ครบทุกไบต์ — กศ1)
 * Claude เลือก (มาตรฐาน):
 * - ไฟล์ที่สำเร็จ / ยกเลิก → เรียก onChanged ทันที (รายการด้านหลังโหลดใหม่ ; ยกเลิกพร้อมส่งครบพอดีก็ตรงความจริง)
 * - คำตอบที่ทำให้ไฟล์ถัดไปไม่ผ่านแน่ ๆ (วิชาถูกปิด / หน่วยถูกลบ / หมดสิทธิ์ / หลุดจากระบบ) → หยุดทั้งคิว + บอกเหตุผล
 * - หน้าต่างถูกปิด (ถอดออกจากหน้า) → หยุดไฟล์ที่กำลังส่ง และไม่เริ่มไฟล์ถัดไป
 *
 * ไฟล์ชื่อซ้ำ (ชซ1 — ผู้ใช้เลือก 2026-11-24 ; รายละเอียดใน docs/decisions/block-4.md):
 * - ตรวจ**ตอนไฟล์ถึงคิว** ไม่ใช่ตอนเลือก — ถึงตอนนั้นไฟล์ก่อนหน้าในรอบเดียวกันบันทึกเสร็จแล้ว จึงเทียบได้ครบ
 *   (เช่น เลือก a.pdf 2 ไฟล์พร้อมกัน ไฟล์ที่ 2 ถูกถาม) และ "แทนที่" มีรายการจริงให้เปลี่ยนไฟล์เสมอ
 * - เทียบกับ getContents() (รายการล่าสุดของหน่วยจากแคช) + ผลของไฟล์ที่ส่งสำเร็จในหน้าต่างนี้
 *   (แคชโหลดใหม่หลังส่งแต่ละไฟล์ แต่อาจยังมาไม่ถึง — ผลที่เก็บไว้เองจึงกันพลาด)
 * - ไฟล์ที่รอเลือกไม่ขวางคิว ; คิวว่างแต่ยังมีไฟล์รอเลือก = ยังไม่จบ (หน้าต่างยังไม่สรุปผล)
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { replaceContentFile, uploadContentFile, type Content } from '../../../api/content'
import { UploadAbortedError } from '../../../api/upload'
import { uploadErrorMessage } from './contentNames'
import { findDuplicate, renameProblem, splitName, type RenameProblem } from './duplicateNames'
import { checkFile, fileKindOf, type FileKind, type FileProblem } from './fileRules'

/** เลือก / ลากได้ครั้งละไม่เกินกี่ไฟล์ (กญ1 + กห1) */
export const MAX_FILES_PER_PICK = 20

export type UploadStatus = 'invalid' | 'queued' | 'duplicate' | 'uploading' | 'done' | 'failed' | 'cancelled'

/** ไฟล์ 1 แถวในรายการ */
export type UploadItem = {
  /** เลขประจำแถว (ไม่ซ้ำในหน้าต่าง — ไฟล์ชื่อซ้ำกันได้) */
  key: number
  file: File
  /** ชนิดจากนามสกุล ; ไม่รับ = null */
  kind: FileKind | null
  status: UploadStatus
  /** ปัญหาที่หน้าเว็บตรวจเจอ (invalid) */
  problem: FileProblem | null
  /** ข้อความเมื่อส่งไม่สำเร็จ (failed) */
  error: string | null
  /** ไม่สำเร็จเพราะเน็ต / เซิร์ฟเวอร์ → ลองใหม่ได้ (กฬ1) */
  retryable: boolean
  /** ส่งไปแล้วกี่ไบต์ */
  loaded: number
  /** ส่งครบทุกไบต์แล้ว รอเซิร์ฟเวอร์บันทึก — ยกเลิกไม่ได้แล้ว (กศ1) */
  sent: boolean
  /** ชื่อซ้ำ (duplicate): รายการเดิมในหน่วยที่ชื่อตรงกัน — "แทนที่" จะเปลี่ยนไฟล์ของรายการนี้ */
  duplicateOf: Content | null
  /** ผู้ใช้กด "ยืนยัน" (เก็บทั้งคู่) แล้ว → ถึงคิวไม่ต้องตรวจชื่อซ้ำอีก */
  keepBoth: boolean
  /** ผู้ใช้กด "แทนที่" → ส่งเป็นการเปลี่ยนไฟล์ของเนื้อหารหัสนี้ (หัวข้อ / ลำดับ / การเผยแพร่คงเดิม — กธ1) */
  replaceId: number | null
  /** ผลจากเซิร์ฟเวอร์เมื่อสำเร็จ (ใช้เทียบชื่อซ้ำของไฟล์ถัดไป ก่อนรายการในแคชโหลดใหม่เสร็จ) */
  result: Content | null
}

/**
 * ไม่สำเร็จเพราะเน็ต / เซิร์ฟเวอร์ (ไม่ใช่เพราะตัวไฟล์หรือสิทธิ์) → ลองส่งใหม่แล้วอาจผ่าน
 * รวม `unknown` (ระบบไม่รู้สาเหตุ เช่น ตัวกลางตอบหน้า HTML) เพราะข้อความของรหัสนี้บอก "กรุณาลองใหม่อีกครั้ง"
 * — ต้องมีปุ่มให้ลองตามที่บอก (แก้หลังตรวจขั้น 4.6 ข — กฮ1)
 */
function isRetryable(caught: unknown): boolean {
  if (!(caught instanceof ApiError)) return true
  return (
    caught.status === 0 || caught.status >= 500 || caught.code === 'throttled' || caught.code === 'unknown'
  )
}

/** คำตอบที่ทำให้ไฟล์ที่เหลือไม่ผ่านแน่ ๆ: หลุดจากระบบ / หมดสิทธิ์ / หน่วยถูกลบ / วิชาถูกปิด */
function stopsQueue(caught: unknown, replacing: boolean): boolean {
  if (!(caught instanceof ApiError)) return false
  // แทนที่แล้วได้ 404 = รายการเดิมถูกลบไประหว่างนั้น (ไม่ใช่หน่วยถูกลบ) → ไฟล์อื่นยังส่งได้ ไม่ต้องหยุดทั้งคิว
  if (replacing && caught.status === 404) return false
  return [401, 403, 404].includes(caught.status) || caught.code === 'course_closed'
}

/**
 * คิวอัปโหลดของหน่วยหนึ่ง
 * @param onChanged เรียกเมื่อเนื้อหาในหน่วยอาจเปลี่ยน (สำเร็จ / ยกเลิก) — ใช้โหลดรายการใหม่
 * @param getContents เนื้อหาล่าสุดของหน่วยนี้ (ตามลำดับในหน่วย) — ใช้ตรวจไฟล์ชื่อซ้ำ (ชซ1)
 */
export function useUploadQueue(
  courseId: number,
  moduleId: number,
  onChanged: () => void,
  getContents: () => readonly Content[],
) {
  const { t } = useTranslation()
  const [items, setItems] = useState<UploadItem[]>([])
  const [running, setRunning] = useState(false)
  /** เหตุผลที่คิวหยุดเอง (เช่น วิชาถูกปิดกลางทาง) */
  const [haltReason, setHaltReason] = useState<string | null>(null)

  // สำเนาล่าสุดในตัวแปรอ้างอิง — ลูปส่งไฟล์ (async) อ่านค่าล่าสุดได้โดยไม่ติดค่าเก่าของรอบวาดเดิม
  const itemsRef = useRef<UploadItem[]>([])
  const runningRef = useRef(false)
  const currentRef = useRef<{ key: number; controller: AbortController } | null>(null)
  const nextKeyRef = useRef(1)
  const closedRef = useRef(false)
  const onChangedRef = useRef(onChanged)
  const getContentsRef = useRef(getContents)
  useEffect(() => {
    onChangedRef.current = onChanged
    getContentsRef.current = getContents
  }, [onChanged, getContents])

  // ถอดหน้าต่างออก (ปิด / ออกจากหน้า) → หยุดไฟล์ที่กำลังส่ง + ไม่เริ่มไฟล์ถัดไป
  useEffect(() => {
    closedRef.current = false
    return () => {
      closedRef.current = true
      currentRef.current?.controller.abort()
    }
  }, [])

  /** แทนรายการทั้งชุด (ทั้งสำเนาและ state) */
  const commit = (next: UploadItem[]) => {
    itemsRef.current = next
    setItems(next)
  }
  /** แก้บางช่องของแถวเดียว */
  const patch = (key: number, changes: Partial<UploadItem>) =>
    commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...changes } : item)))
  /** แถวที่รอคิว + รอเลือก (ชื่อซ้ำ) ทั้งหมด → ยกเลิก */
  const cancelQueued = () =>
    commit(
      itemsRef.current.map((item) =>
        item.status === 'queued' || item.status === 'duplicate' ? { ...item, status: 'cancelled' } : item,
      ),
    )

  /**
   * เนื้อหาที่ใช้เทียบชื่อซ้ำ: รายการในหน่วย (แคช) + ผลของไฟล์ที่ส่งสำเร็จในหน้าต่างนี้
   * รหัสเดียวกัน → ใช้ผลที่เพิ่งได้ (เช่น เพิ่งแทนที่ไฟล์) ; ไฟล์ใหม่ที่แคชยังไม่มี → ต่อท้าย (ตรงกับลำดับจริงในหน่วย)
   */
  function knownContents(): Content[] {
    const fresh = new Map<number, Content>()
    for (const item of itemsRef.current) if (item.result) fresh.set(item.result.id, item.result)
    const merged = getContentsRef.current().map((content) => {
      const newer = fresh.get(content.id)
      fresh.delete(content.id)
      return newer ?? content
    })
    return [...merged, ...fresh.values()]
  }

  /** ส่งไฟล์ 1 แถว */
  async function uploadOne(item: UploadItem) {
    const controller = new AbortController()
    currentRef.current = { key: item.key, controller }
    patch(item.key, { status: 'uploading', loaded: 0, sent: false, error: null })
    const options = {
      signal: controller.signal,
      onProgress: ({ loaded }: { loaded: number }) => patch(item.key, { loaded }),
      onSent: () => patch(item.key, { sent: true }),
    }
    try {
      const result =
        item.replaceId !== null
          ? await replaceContentFile(courseId, item.replaceId, item.file, options)
          : await uploadContentFile(courseId, moduleId, item.file, options)
      patch(item.key, { status: 'done', loaded: item.file.size, sent: true, result })
      onChangedRef.current()
    } catch (caught) {
      if (caught instanceof UploadAbortedError) {
        patch(item.key, { status: 'cancelled' })
        // เผื่อกดยกเลิกพร้อมกับที่เซิร์ฟเวอร์บันทึกเสร็จพอดี — โหลดรายการให้ตรงกับข้อมูลจริง
        onChangedRef.current()
        return
      }
      const replacing = item.replaceId !== null
      // แทนที่แล้วรายการเดิมหายไป (404) → บอกให้ตรงเรื่อง แทน "ไม่พบข้อมูล" ทั่วไป
      const message =
        replacing && caught instanceof ApiError && caught.status === 404
          ? t('content.replaceTargetGone')
          : uploadErrorMessage(caught, item.file, t)
      patch(item.key, { status: 'failed', error: message, retryable: isRetryable(caught) })
      if (stopsQueue(caught, replacing)) {
        cancelQueued()
        setHaltReason(t('content.uploadHalted', { reason: message }))
      }
    } finally {
      currentRef.current = null
    }
  }

  /** ส่งไฟล์ที่รอคิวทีละไฟล์จนหมด (เรียกซ้ำระหว่างทำงานอยู่ = ไม่ทำอะไร — ลูปเดิมหยิบไฟล์ใหม่เอง) */
  async function pump() {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    try {
      for (;;) {
        if (closedRef.current) break
        const next = itemsRef.current.find((item) => item.status === 'queued')
        if (!next) break
        // ชื่อซ้ำ (ชซ1) → พักไว้ให้ผู้ใช้เลือก แล้วไปไฟล์ถัดไป ; กด "ยืนยัน" / "แทนที่" มาแล้วไม่ต้องตรวจอีก
        if (!next.keepBoth && next.replaceId === null) {
          const duplicateOf = findDuplicate(next.file.name, knownContents())
          if (duplicateOf) {
            patch(next.key, { status: 'duplicate', duplicateOf })
            continue
          }
        }
        await uploadOne(next)
      }
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  /**
   * เพิ่มไฟล์ที่เลือก / ลากมา แล้วเริ่มส่ง
   * @returns เกิน 20 ไฟล์ = จำนวนที่เลือกมา (ไม่รับทั้งชุด — กห1) ; รับแล้ว = null
   */
  function addFiles(files: File[]): number | null {
    if (files.length === 0) return null
    if (files.length > MAX_FILES_PER_PICK) return files.length
    const added = files.map((file): UploadItem => {
      const problem = checkFile(file)
      return {
        key: nextKeyRef.current++,
        file,
        kind: fileKindOf(file.name),
        status: problem ? 'invalid' : 'queued',
        problem,
        error: null,
        retryable: false,
        loaded: 0,
        sent: false,
        duplicateOf: null,
        keepBoth: false,
        replaceId: null,
        result: null,
      }
    })
    setHaltReason(null)
    commit([...itemsRef.current, ...added])
    void pump()
    return null
  }

  /** เอาแถวที่รอคิวออก */
  function remove(key: number) {
    commit(itemsRef.current.filter((item) => !(item.key === key && item.status === 'queued')))
  }

  /** ยกเลิกไฟล์ที่กำลังส่ง (เฉพาะก่อนส่งครบทุกไบต์) */
  function cancel(key: number) {
    const item = itemsRef.current.find((entry) => entry.key === key)
    if (currentRef.current?.key === key && item && !item.sent) currentRef.current.controller.abort()
  }

  /** ลองส่งแถวที่ไม่สำเร็จเพราะเน็ต / เซิร์ฟเวอร์อีกครั้ง (กฬ1) */
  function retry(key: number) {
    const item = itemsRef.current.find((entry) => entry.key === key)
    if (!item || item.status !== 'failed' || !item.retryable) return
    setHaltReason(null)
    patch(key, { status: 'queued', error: null, loaded: 0, sent: false })
    void pump()
  }

  /** "หยุดไฟล์ที่เหลือ" (กอ1): ล้างคิว + หยุดไฟล์ที่กำลังส่ง ถ้ายังส่งไม่ครบ */
  function stopAll() {
    cancelQueued()
    const current = currentRef.current
    const item = current && itemsRef.current.find((entry) => entry.key === current.key)
    if (current && item && !item.sent) current.controller.abort()
  }

  // ---- ไฟล์ชื่อซ้ำที่รอเลือก (ชซ1) — ทุกคำสั่งทำได้เฉพาะแถวที่ยังรอเลือกอยู่ ----

  /** แถวที่รอเลือก ; ไม่ใช่ = undefined (กดซ้ำ / หน้าต่างเปลี่ยนไปแล้ว → ไม่ทำอะไร) */
  const waiting = (key: number) =>
    itemsRef.current.find((entry) => entry.key === key && entry.status === 'duplicate')

  /** "ยืนยัน": อัปโหลดเป็นรายการใหม่ เก็บทั้ง 2 ไฟล์ */
  function keepBoth(key: number) {
    if (!waiting(key)) return
    patch(key, { status: 'queued', keepBoth: true })
    void pump()
  }

  /** "แทนที่": เปลี่ยนไฟล์ของรายการเดิม (หัวข้อ / ลำดับ / การเผยแพร่ / สวิตช์ดาวน์โหลดคงเดิม ; ไฟล์เดิมถูกลบ) */
  function replace(key: number) {
    const item = waiting(key)
    if (!item?.duplicateOf) return
    patch(key, { status: 'queued', replaceId: item.duplicateOf.id })
    void pump()
  }

  /**
   * "เปลี่ยนชื่อ": ตรวจชื่อใหม่ (ส่วนชื่อ — นามสกุลคงเดิม) แล้วส่งไฟล์เดิมในชื่อนั้น
   * ชื่อนี้กลายเป็นหัวข้อ + ชื่อตอนดาวน์โหลด (backend ตั้งจากชื่อไฟล์ที่ได้รับ — ไม่ต้องแก้ backend)
   * @returns ปัญหาของชื่อ (ไม่ส่ง) ; ส่งเข้าคิวแล้ว = null
   */
  function rename(key: number, stem: string): RenameProblem | null {
    const item = waiting(key)
    if (!item) return null
    const { ext } = splitName(item.file.name)
    const problem = renameProblem(stem, ext, knownContents())
    if (problem) return problem
    const file = new File([item.file], stem.trim() + ext, {
      type: item.file.type,
      lastModified: item.file.lastModified,
    })
    // ไม่ตั้ง keepBoth: ถึงคิวแล้วตรวจอีกรอบ เผื่อมีไฟล์ชื่อนี้เพิ่มเข้ามาระหว่างรอ
    patch(key, { status: 'queued', file, duplicateOf: null })
    void pump()
    return null
  }

  /** "ยกเลิก": ไม่อัปโหลดไฟล์นี้ */
  function skip(key: number) {
    if (!waiting(key)) return
    patch(key, { status: 'cancelled' })
  }

  /** ล้างรายการ (ปุ่ม "อัปโหลดไฟล์อื่นเพิ่ม") — ทำได้เมื่อไม่มีไฟล์กำลังส่ง */
  function reset() {
    if (runningRef.current) return
    setHaltReason(null)
    commit([])
  }

  const uploading = items.find((item) => item.status === 'uploading')
  return {
    items,
    running,
    haltReason,
    /** มีอะไรให้ "หยุดไฟล์ที่เหลือ" ไหม (มีคิว หรือไฟล์ที่กำลังส่งยังส่งไม่ครบ) */
    canStop:
      items.some((item) => item.status === 'queued' || item.status === 'duplicate') ||
      (uploading !== undefined && !uploading.sent),
    /** ช่องเปลี่ยนชื่อใช้หาชื่อตั้งต้น / ตรวจชื่อซ้ำ (รายการเดียวกับที่คิวใช้เทียบ) */
    knownContents,
    addFiles,
    remove,
    cancel,
    retry,
    stopAll,
    reset,
    keepBoth,
    replace,
    rename,
    skip,
  }
}
