/**
 * กติกากลางของปุ่มในแท็บตั้งค่า — ทุกส่วน (เผยแพร่ / รหัสเข้าร่วม / ผู้สอน / ปิด / ลบ / เปิดคืน) ใช้ตัวเดียวกัน
 *
 * - ล็อกปุ่มร่วมกัน (running): ระหว่างรอผลของปุ่มใด ปุ่มทุกส่วนกดไม่ได้ (กันกด 2 คำสั่งซ้อนกันกับวิชาเดียว)
 * - ผลล่าสุดมีได้ทีละ 1 ป้าย (result): กดปุ่มใหม่ → ป้ายเดิมของทุกส่วนหาย แล้วขึ้นป้ายใหม่ในส่วนที่กด
 *   (ขั้น 3.6 รอบ 3 แบบ ท1 — ผลขึ้นในส่วนที่กด ไม่ใช่แถบด้านบน เพราะจอเตี้ยมองไม่เห็นแถบ)
 * - ไม่สำเร็จ → โหลดข้อมูลวิชาใหม่เสมอ (เช่น มีคนปิดวิชาไปก่อน หน้าจอจะเปลี่ยนตามจริง)
 *
 * ฟอร์มข้อมูลรายวิชาไม่ใช้ตัวนี้ (มีสถานะ "กำลังบันทึก" ของฟอร์มเอง — เหมือนก่อนแยกไฟล์)
 * แยกออกจาก SettingsTab.tsx ในรอบปรับโครงสร้างหลังขั้น 3.8 (ไฟล์เดิม 668 บรรทัด)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { runCourseAction, type CourseAction } from '../../../api/courses'
import { errorMessage } from '../../../api/errors'
import { afterCourseAction, courseKey } from '../courseCache'
import { useCoursePage, useRefreshCourse } from '../useCoursePage'

/** ส่วนที่แสดงผลของการกดได้ */
export type SectionKey = 'publish' | 'join' | 'teacher'
/** ผลของการกดล่าสุด 1 ป้าย */
export type SectionResult = { section: SectionKey; tone: 'ok' | 'bad'; text: string }

/** ข้อความภาษาไทยของ error จาก API (ไม่ใช่ error ของ API = ข้อความรวม) */
export function apiMessage(caught: unknown): string {
  return errorMessage(caught instanceof ApiError ? caught.code : 'unknown')
}

/** หน้าต่างยืนยัน 1 บาน: เปิดอยู่ไหม + ข้อความ error ที่แสดงในหน้าต่าง */
export type ConfirmStep = {
  open: boolean
  error: string | undefined
  show: () => void
  /** ปิดหน้าต่างและล้างข้อความ error */
  close: () => void
  setError: (message: string | undefined) => void
}

/** สถานะของหน้าต่างยืนยัน 1 บาน (แต่ละส่วนถือหน้าต่างของตัวเอง) */
export function useConfirmStep(): ConfirmStep {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  return {
    open,
    error,
    show: () => setOpen(true),
    close: () => {
      setOpen(false)
      setError(undefined)
    },
    setError,
  }
}

/** สร้างใน SettingsTab ครั้งเดียว แล้วส่งให้ทุกส่วน (ทุกส่วนจึงเห็นล็อกและป้ายผลเดียวกัน) */
export function useSettingsActions() {
  const { t } = useTranslation()
  const { course, notify } = useCoursePage()
  const refresh = useRefreshCourse(course.id)
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SectionResult | null>(null)

  /** ส่งคำสั่ง แล้วใช้ข้อมูลวิชาล่าสุดที่ backend ส่งกลับมา + ให้รายการวิชาโหลดใหม่ */
  async function apply(action: CourseAction) {
    const updated = await runCourseAction(course.id, action)
    queryClient.setQueryData(courseKey(course.id), updated)
    await afterCourseAction(queryClient)
  }

  /** เริ่มงาน 1 อย่าง: ล็อกปุ่มทุกส่วน + ล้างแถบด้านบนและป้ายผลเดิม → ทำงาน → ปลดล็อก */
  async function run(task: () => Promise<void>) {
    setRunning(true)
    notify(null)
    setResult(null)
    try {
      await task()
    } finally {
      setRunning(false)
    }
  }

  /** ปุ่มที่ทำทันที — ผลขึ้นในส่วนที่กด (ไม่ส่ง noticeText = สำเร็จแล้วไม่ขึ้นป้าย เช่น สวิตช์ที่เห็นผลอยู่แล้ว) */
  function runNow(section: SectionKey, action: CourseAction, noticeText?: string) {
    return run(async () => {
      try {
        await apply(action)
        if (noticeText) setResult({ section, tone: 'ok', text: noticeText })
      } catch (caught) {
        setResult({
          section,
          tone: 'bad',
          text: t('courseSettings.actionFailed', { reason: apiMessage(caught) }),
        })
        await refresh()
      }
    })
  }

  /**
   * ปุ่มยืนยันในหน้าต่าง: สำเร็จ → ปิดหน้าต่าง ; ไม่สำเร็จ → ข้อความในหน้าต่าง (หน้าต่างยังเปิด) + โหลดวิชาใหม่
   * task บอกเองว่าสำเร็จแล้วแสดงผลที่ไหน (ป้ายในส่วน / แถบด้านบน / ไปหน้าอื่น)
   */
  function runInDialog(
    dialog: ConfirmStep,
    task: () => Promise<void>,
    failMessage: (caught: unknown) => string = apiMessage,
  ) {
    return run(async () => {
      dialog.setError(undefined)
      try {
        await task()
        dialog.close()
      } catch (caught) {
        dialog.setError(failMessage(caught))
        await refresh()
      }
    })
  }

  return {
    running,
    /** ป้ายผลของส่วนนี้ (null = ผลล่าสุดไม่ได้อยู่ส่วนนี้ / ไม่มีผล) */
    resultFor: (section: SectionKey) => (result?.section === section ? result : null),
    showResult: setResult,
    clearResult: () => setResult(null),
    apply,
    refresh,
    run,
    runNow,
    runInDialog,
  }
}

/** สิ่งที่แต่ละส่วนได้รับจาก SettingsTab */
export type SettingsActions = ReturnType<typeof useSettingsActions>
