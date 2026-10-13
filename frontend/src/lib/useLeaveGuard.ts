/**
 * ตัวเฝ้าประตู: ถามยืนยันก่อนออกจากหน้าที่มีงานค้าง (ขั้น 2.7 — ผู้ใช้เลือกข้อ 2.ก)
 * ใช้ครั้งแรกในหน้านำเข้า CSV: ยังไม่ดาวน์โหลดไฟล์รหัสผ่าน = ออกแล้วรหัสหาย ; ใช้ซ้ำได้ในก้อนหลัง
 *
 * กันได้ทุกทางออก:
 *   🅰 ปิดแท็บ / รีเฟรช / พิมพ์ที่อยู่ใหม่   → หน้าต่างถามของเบราว์เซอร์เอง (beforeunload — เปลี่ยนข้อความไม่ได้)
 *   🅱 เมนู / ลิงก์ / ปุ่มย้อนกลับ ←          → useBlocker ของ React Router (ต้องใช้ data router — router.tsx)
 *   🅲 ปุ่ม "ออกจากระบบ"                   → ถาม "ทะเบียนตัวเฝ้า" ก่อน (requestLeave) — เพราะออกจากระบบแล้ว
 *                                          ยามหน้าประตูถอดหน้านี้ทิ้งทันที ตัวกันของ router จึงจับไม่ทัน
 * 🅱 และ 🅲 เปิดหน้าต่างยืนยันอันเดียวกันของหน้านั้น (ConfirmDialog) → "อยู่ต่อ" / "ออกจากหน้านี้"
 *
 * วิธีใช้:
 *   const leave = useLeaveGuard(ยังมีงานค้าง)
 *   {leave.asking && <ConfirmDialog … onConfirm={leave.proceed} onCancel={leave.stay} />}
 */
import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router'

/** ตัวเฝ้าที่ทำงานอยู่ตอนนี้ (มีได้ทีละหน้า) — รับ "สิ่งที่จะทำถ้าผู้ใช้ยืนยันว่าออก" */
let activeGuard: ((leave: () => void) => void) | null = null

/**
 * ขอออก (เช่น ปุ่ม "ออกจากระบบ"): ไม่มีหน้าใดเฝ้าอยู่ → ทำทันที ;
 * มี → ให้หน้านั้นถามยืนยันก่อน แล้วค่อยทำเมื่อผู้ใช้กด "ออกจากหน้านี้"
 */
export function requestLeave(leave: () => void): void {
  if (activeGuard) activeGuard(leave)
  else leave()
}

/** ถามยืนยันก่อนออกจากหน้า ขณะที่ active เป็นจริง */
export function useLeaveGuard(active: boolean) {
  // 🅱 การเปลี่ยนหน้าภายในเว็บ
  const blocker = useBlocker(active)
  // 🅲 สิ่งที่รอทำหลังผู้ใช้ยืนยัน (จากปุ่มออกจากระบบ)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  // ลงทะเบียนตัวเฝ้า (🅲) ระหว่างที่มีงานค้าง
  useEffect(() => {
    if (!active) return
    const guard = (leave: () => void) => setPendingLeave(() => leave)
    activeGuard = guard
    return () => {
      if (activeGuard === guard) activeGuard = null
    }
  }, [active])

  // 🅰 ปิดแท็บ / รีเฟรช: เบราว์เซอร์ถามด้วยหน้าต่างของตัวเอง
  useEffect(() => {
    if (!active) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // เบราว์เซอร์รุ่นเก่าต้องตั้งค่านี้ถึงจะถาม (ข้อความที่แสดงเป็นของเบราว์เซอร์เอง)
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  /** ผู้ใช้ยืนยันว่าออก */
  const proceed = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed()
    const leave = pendingLeave
    setPendingLeave(null)
    leave?.()
  }, [blocker, pendingLeave])

  /** ผู้ใช้เลือกอยู่ต่อ */
  const stay = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset()
    setPendingLeave(null)
  }, [blocker])

  return { asking: blocker.state === 'blocked' || pendingLeave !== null, proceed, stay }
}
