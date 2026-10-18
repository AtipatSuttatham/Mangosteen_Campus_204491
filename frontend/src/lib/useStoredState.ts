/**
 * ค่าในหน้าจอที่จำไว้ในเบราว์เซอร์ (localStorage) — ขั้น 3.5
 * ใช้กับ "ความสะดวกของผู้ใช้แต่ละเครื่อง" เท่านั้น เช่น กลุ่มภาคเรียนไหนพับ/เปิดอยู่
 * (ผู้ใช้เลือกแบบ 2ก — คนละเครื่องคนละค่า ไม่ต้องแก้ backend)
 *
 * ปลอดภัยเสมอ: อ่าน/เขียนไม่ได้ (โหมดส่วนตัว, ปิด storage, ข้อมูลเสีย) → ใช้ค่าเริ่มต้น หน้ายังทำงานปกติ
 * ห้ามใช้เก็บข้อมูลสำคัญหรือข้อมูลลับ (ไม่เก็บ token — ดู auth/session.ts)
 */
import { useCallback, useState } from 'react'

/** คำนำหน้าชื่อของทุกค่าในระบบนี้ (กันชนกับเว็บอื่นที่ใช้โดเมนเดียวกันตอนพัฒนา) */
const PREFIX = 'mangosteen:'

/** อ่านค่าจาก localStorage — อ่านไม่ได้ / ไม่มี / ข้อมูลเสีย → fallback */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** เขียนค่าลง localStorage — เขียนไม่ได้ก็ข้ามไปเงียบ ๆ (ค่ายังอยู่ในหน้าจอจนปิดหน้า) */
export function writeStored<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage ใช้ไม่ได้ — ไม่ต้องทำอะไร
  }
}

/**
 * เหมือน useState แต่จำค่าไว้ในเบราว์เซอร์ (อ่านครั้งเดียวตอนเปิดหน้า ; เปลี่ยนเมื่อไรเขียนทันที)
 * setValue รับได้ทั้งค่าใหม่ และฟังก์ชัน (ค่าเดิม) => ค่าใหม่
 */
export function useStoredState<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, fallback))
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
        writeStored(key, resolved)
        return resolved
      })
    },
    [key],
  )
  return [value, update]
}
