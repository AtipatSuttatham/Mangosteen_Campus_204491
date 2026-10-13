/**
 * ให้โฟกัสของแป้นพิมพ์ "วนอยู่ใน" หน้าต่างซ้อน (dialog / เมนูลิ้นชัก) ตามมาตรฐานการเข้าถึง
 *
 *   - เปิดแล้วโฟกัสไปที่ตัวที่กำหนด (initialFocusRef) — ไม่กำหนด = สิ่งแรกที่กดได้ในหน้าต่าง
 *   - กด Tab ที่ตัวสุดท้าย → กลับไปตัวแรก ; Shift+Tab ที่ตัวแรก → ไปตัวสุดท้าย
 *   - ปิดแล้วคืนโฟกัสให้ปุ่มที่กดเปิด (restoreFocus — ค่าเริ่มต้น true)
 *
 * ใช้ร่วมกันระหว่าง Dialog / ConfirmDialog (ขั้น 2.6) และเมนูลิ้นชักบนมือถือ (ขั้น 1.3 — ย้ายโค้ดออกมาเป็นของกลาง)
 *
 * วิธีใช้:
 *   const onKeyDown = useFocusTrap(panelRef, { initialFocusRef: firstFieldRef })
 *   <div ref={panelRef} onKeyDown={onKeyDown}>…</div>
 */
import { useCallback, useEffect, type KeyboardEvent, type RefObject } from 'react'

/** สิ่งที่กด/โฟกัสได้ในหน้าต่าง (ใช้หาตัวแรก/ตัวสุดท้ายของการวน Tab) */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type FocusTrapOptions = {
  /** ตัวที่ได้โฟกัสเมื่อเปิด (เช่น ช่องกรอกแรก / ปุ่ม "ยกเลิก") */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** ปิดแล้วคืนโฟกัสให้ตัวที่โฟกัสอยู่ก่อนเปิดหรือไม่ (เมนูลิ้นชักให้ AppShell คืนเอง จึงปิดไว้) */
  restoreFocus?: boolean
}

/** คืนตัวจัดการแป้นพิมพ์ (onKeyDown) ที่ทำให้ Tab วนอยู่ในกล่อง containerRef */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { initialFocusRef, restoreFocus = true }: FocusTrapOptions = {},
) {
  // เปิด: โฟกัสตัวแรก ; ปิด (component หายไป): คืนโฟกัสให้ตัวเดิม
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const target =
      initialFocusRef?.current ??
      containerRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      containerRef.current
    target?.focus()
    return () => {
      // ตัวเดิมอาจถูกลบไปแล้ว (เช่น แถวในตารางที่โหลดใหม่) → ไม่ต้องคืน
      if (restoreFocus && previous?.isConnected) previous.focus()
    }
  }, [containerRef, initialFocusRef, restoreFocus])

  // Tab ที่ตัวสุดท้าย / Shift+Tab ที่ตัวแรก = วนกลับ (ไม่หลุดไปหน้าด้านหลัง)
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Tab' || !containerRef.current) return
      const items = [...containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        // ไม่มีอะไรให้กดเลย → อยู่ที่เดิม
        event.preventDefault()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [containerRef],
  )
}
