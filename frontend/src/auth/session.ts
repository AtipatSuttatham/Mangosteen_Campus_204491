/**
 * ที่เก็บบัตรผ่าน (access token) และตัวแลกบัตรใหม่ — "ตู้เก็บบัตร" ของหน้าเว็บ
 * อ้างอิงลำดับการทำงาน: docs/api.md §6.3
 *
 * - access token เก็บ**ในหน่วยความจำเท่านั้น** (ตัวแปรในไฟล์นี้) — ไม่เก็บใน localStorage
 *   ปิดแท็บ = หายไป → เปิดใหม่ก็แลกใหม่จาก cookie (refresh token อยู่ใน httpOnly cookie)
 * - การแลกบัตร (refreshSession) ทำ**ครั้งเดียวต่อรอบ**:
 *     • ในแท็บเดียว: คำขอหลายตัวที่ได้ 401 พร้อมกัน รอผลการแลกครั้งเดียวกัน
 *     • ข้ามแท็บ: ใช้กุญแจล็อกของเบราว์เซอร์ (Web Locks API) ให้แท็บแลกทีละแท็บ
 *       เพราะ refresh token ใช้ได้ครั้งเดียว — ถ้า 2 แท็บแลกพร้อมกัน แท็บที่ช้ากว่าจะถูกปฏิเสธ
 *       แท็บที่รอคิวจะส่ง cookie ใบใหม่ที่แท็บแรกได้มา (cookie ใช้ร่วมกันทุกแท็บ) จึงแลกสำเร็จ
 * - เมื่อแลกไม่ได้ระหว่างใช้งาน (บัตรหมดอายุ / ถูกยกเลิก / บัญชีถูกระงับ) จะแจ้งผู้ฟัง
 *   (AuthProvider) ให้พาผู้ใช้ไปหน้าเข้าสู่ระบบ พร้อมข้อความ "หมดเวลาการใช้งาน"
 *
 * ไฟล์นี้เรียก fetch เองตรง ๆ (ไม่ผ่าน apiFetch) เพราะ apiFetch เรียกไฟล์นี้ตอนได้ 401
 */
import type { TokenResponse } from '../api/auth'
import { API_BASE, ApiError } from '../api/client'

/** ชื่อกุญแจล็อกข้ามแท็บ (ใช้ร่วมกันทุกแท็บของเว็บนี้) */
export const REFRESH_LOCK_NAME = 'mangosteen-auth-refresh'

/** access token ปัจจุบัน ; null = ยังไม่มี (ยังไม่เข้าสู่ระบบ / เพิ่งเปิดหน้า) */
let accessToken: string | null = null

/** การแลกบัตรที่กำลังทำอยู่ (ถ้ามี) — คำขอที่มาระหว่างนี้รอผลเดียวกัน */
let refreshInFlight: Promise<TokenResponse | null> | null = null

/** ผู้ฟังเหตุการณ์ "ถูกให้ออกจากระบบกลางคัน" */
const sessionExpiredListeners = new Set<() => void>()

/** access token ปัจจุบัน (apiFetch ใช้แนบไปกับทุกคำขอ) */
export function getAccessToken(): string | null {
  return accessToken
}

/** ตั้ง / ล้าง access token (ตอน login, แลกบัตร, ออกจากระบบ) */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

/**
 * ทำงาน fn ภายใต้กุญแจล็อกข้ามแท็บ
 * เบราว์เซอร์ที่ไม่มี Web Locks (เก่ามาก / บาง test) → ทำงานทันที (ยังกันซ้ำในแท็บเดียวได้)
 */
function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks?.request) {
    return locks.request(REFRESH_LOCK_NAME, fn)
  }
  return fn()
}

/** ส่งคำขอแลกบัตรไปที่ backend 1 ครั้ง */
async function requestRefresh(): Promise<TokenResponse | null> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  } catch {
    // ติดต่อ backend ไม่ได้ — ไม่ใช่ "บัตรหมดอายุ" จึงไม่ล้างการเข้าสู่ระบบ ให้ผู้เรียกจัดการ
    throw new ApiError(0, 'network_error')
  }

  if (response.status === 401 || response.status === 403) {
    // ไม่มี cookie / หมดอายุ / ถูกยกเลิก / บัญชีถูกระงับ → ไม่ได้อยู่ในระบบแล้ว
    accessToken = null
    return null
  }
  if (!response.ok) {
    // backend ขัดข้อง (เช่น 500 / 502 ตอนเซิร์ฟเวอร์กำลังเปิด) ≠ บัตรหมดอายุ → ไม่ล้างการเข้าสู่ระบบ
    throw new ApiError(response.status, response.status >= 500 ? 'server_error' : 'unknown')
  }
  const data = (await response.json()) as TokenResponse
  accessToken = data.access
  return data
}

/**
 * แลกบัตรรายวันใบใหม่ด้วย cookie
 * @returns ข้อมูลใหม่ (access + user) ; null = แลกไม่ได้ (ไม่ได้อยู่ในระบบ)
 * @throws ApiError('network_error') เมื่อติดต่อ backend ไม่ได้
 */
export function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = withCrossTabLock(requestRefresh).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/** สมัครฟังเหตุการณ์ "ถูกให้ออกจากระบบกลางคัน" — คืนฟังก์ชันยกเลิกการฟัง */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

/** แจ้งทุกผู้ฟังว่าถูกให้ออกจากระบบกลางคัน (apiFetch เรียกเมื่อแลกบัตรไม่สำเร็จ) */
export function notifySessionExpired(): void {
  accessToken = null
  for (const listener of sessionExpiredListeners) listener()
}
