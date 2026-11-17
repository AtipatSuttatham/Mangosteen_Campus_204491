/**
 * คิวอัปโหลดหลายไฟล์ของหน้าต่าง "อัปโหลดไฟล์" (ขั้น 4.6 ข — ข้อตกลงก้อน 4 กญ1)
 * แยกส่วน "ทำงาน" ออกจากหน้าตา (UploadFilesDialog.tsx) ให้อ่านและทดสอบง่าย
 *
 * วงจรของไฟล์ 1 แถว:
 *
 *   เลือก / ลากมา ─┬─ ตรวจในหน้าเว็บไม่ผ่าน (fileRules — กย1) ──→ invalid (แดง ไม่ส่ง)
 *                 └─ ผ่าน → queued ("รอคิว" + เอาออก)
 *                              │ ถึงคิว (ส่งทีละไฟล์ตามลำดับในรายการ)
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
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { uploadContentFile } from '../../../api/content'
import { UploadAbortedError } from '../../../api/upload'
import { uploadErrorMessage } from './contentNames'
import { checkFile, fileKindOf, type FileKind, type FileProblem } from './fileRules'

/** เลือก / ลากได้ครั้งละไม่เกินกี่ไฟล์ (กญ1 + กห1) */
export const MAX_FILES_PER_PICK = 20

export type UploadStatus = 'invalid' | 'queued' | 'uploading' | 'done' | 'failed' | 'cancelled'

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
}

/** ไม่สำเร็จเพราะเน็ต / เซิร์ฟเวอร์ (ไม่ใช่เพราะตัวไฟล์หรือสิทธิ์) → ลองส่งใหม่แล้วอาจผ่าน */
function isRetryable(caught: unknown): boolean {
  if (!(caught instanceof ApiError)) return true
  return caught.status === 0 || caught.status >= 500 || caught.code === 'throttled'
}

/** คำตอบที่ทำให้ไฟล์ที่เหลือไม่ผ่านแน่ ๆ: หลุดจากระบบ / หมดสิทธิ์ / หน่วยถูกลบ / วิชาถูกปิด */
function stopsQueue(caught: unknown): boolean {
  if (!(caught instanceof ApiError)) return false
  return [401, 403, 404].includes(caught.status) || caught.code === 'course_closed'
}

/**
 * คิวอัปโหลดของหน่วยหนึ่ง
 * @param onChanged เรียกเมื่อเนื้อหาในหน่วยอาจเปลี่ยน (สำเร็จ / ยกเลิก) — ใช้โหลดรายการใหม่
 */
export function useUploadQueue(courseId: number, moduleId: number, onChanged: () => void) {
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
  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

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
  /** แถวที่รอคิวทั้งหมด → ยกเลิก */
  const cancelQueued = () =>
    commit(
      itemsRef.current.map((item) => (item.status === 'queued' ? { ...item, status: 'cancelled' } : item)),
    )

  /** ส่งไฟล์ 1 แถว */
  async function uploadOne(item: UploadItem) {
    const controller = new AbortController()
    currentRef.current = { key: item.key, controller }
    patch(item.key, { status: 'uploading', loaded: 0, sent: false, error: null })
    try {
      await uploadContentFile(courseId, moduleId, item.file, {
        signal: controller.signal,
        onProgress: ({ loaded }) => patch(item.key, { loaded }),
        onSent: () => patch(item.key, { sent: true }),
      })
      patch(item.key, { status: 'done', loaded: item.file.size, sent: true })
      onChangedRef.current()
    } catch (caught) {
      if (caught instanceof UploadAbortedError) {
        patch(item.key, { status: 'cancelled' })
        // เผื่อกดยกเลิกพร้อมกับที่เซิร์ฟเวอร์บันทึกเสร็จพอดี — โหลดรายการให้ตรงกับข้อมูลจริง
        onChangedRef.current()
        return
      }
      const message = uploadErrorMessage(caught, item.file, t)
      patch(item.key, { status: 'failed', error: message, retryable: isRetryable(caught) })
      if (stopsQueue(caught)) {
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
    canStop: items.some((item) => item.status === 'queued') || (uploading !== undefined && !uploading.sent),
    addFiles,
    remove,
    cancel,
    retry,
    stopAll,
    reset,
  }
}
