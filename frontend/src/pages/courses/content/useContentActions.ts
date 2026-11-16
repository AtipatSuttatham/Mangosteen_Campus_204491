/**
 * กติกากลางของปุ่มในแท็บเนื้อหา (ขั้น 4.5) — แบบเดียวกับ settings/useSettingsActions.ts
 *
 * - ล็อกปุ่มร่วมกัน (running): ระหว่างรอผลของปุ่มใด ปุ่มทุกแถวกดไม่ได้
 *   (กันกด ↑ ↓ / เผยแพร่ ซ้อนกันจนลำดับบนจอสับสน — backend เรียงคำขอให้อยู่แล้ว แต่หน้าจอควรรอผลก่อน)
 * - ทำเสร็จ (สำเร็จหรือไม่) → โหลดรายการหน่วยใหม่เสมอ ให้จอตรงกับข้อมูลจริง
 * - ไม่สำเร็จ → แถบแดงใต้หัวรายวิชา (notify ของหน้ารายวิชา) ; ปุ่มในหน้าต่างยืนยัน → ข้อความในหน้าต่าง
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { refreshModules } from '../courseCache'
import { apiMessage, type ConfirmStep } from '../settings/useSettingsActions'
import { useCoursePage } from '../useCoursePage'

export function useContentActions() {
  const { t } = useTranslation()
  const { course, notify } = useCoursePage()
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)

  /** เริ่มงาน 1 อย่าง: ล็อกปุ่ม + ล้างแถบข้อความเดิม → ทำงาน → โหลดรายการใหม่ → ปลดล็อก */
  async function guarded<T>(task: () => Promise<T>): Promise<T> {
    setRunning(true)
    notify(null)
    try {
      return await task()
    } finally {
      await refreshModules(queryClient, course.id)
      setRunning(false)
    }
  }

  /** ปุ่มที่ทำทันที (เลื่อน / เผยแพร่) — ไม่สำเร็จขึ้นแถบแดง ; สำเร็จไม่ขึ้นแถบ (เห็นผลบนจออยู่แล้ว) */
  function runNow(task: () => Promise<unknown>) {
    return guarded(async () => {
      try {
        await task()
      } catch (caught) {
        notify({ tone: 'bad', text: t('content.actionFailed', { reason: apiMessage(caught) }) })
      }
    })
  }

  /**
   * ปุ่มยืนยันในหน้าต่าง (ลบ) — สำเร็จ: ปิดหน้าต่าง + แถบเขียว ; ไม่สำเร็จ: ข้อความในหน้าต่าง
   * คืนค่า true เมื่อสำเร็จ (หลังโหลดรายการใหม่แล้ว) — ผู้เรียกใช้ย้ายโฟกัส เพราะแถวที่ลบหายไปแล้ว
   */
  function runInDialog(
    dialog: ConfirmStep,
    task: () => Promise<unknown>,
    successText: string,
  ): Promise<boolean> {
    return guarded(async () => {
      dialog.setError(undefined)
      try {
        await task()
        dialog.close()
        notify({ tone: 'ok', text: successText })
        return true
      } catch (caught) {
        dialog.setError(apiMessage(caught))
        return false
      }
    })
  }

  return { running, runNow, runInDialog }
}

/** สิ่งที่การ์ดหน่วย / แถวเนื้อหาได้รับจาก ContentTab */
export type ContentActions = ReturnType<typeof useContentActions>
