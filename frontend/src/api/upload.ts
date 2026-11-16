/**
 * ตัวส่งไฟล์ที่รายงานความคืบหน้าได้ (ขั้น 4.6 — ข้อตกลงก้อน 4 "ตัวช่วยอัปโหลดใช้ XHR")
 *
 * ทำไมไม่ใช้ apiFetch: fetch ของเบราว์เซอร์ยังบอกไม่ได้ว่าส่งไฟล์ไปแล้วกี่ไบต์
 * แต่ XMLHttpRequest (XHR) บอกได้ผ่าน xhr.upload.onprogress → ใช้ทำแถบความคืบหน้า
 *
 * ทำงานแบบเดียวกับ apiFetch ทุกอย่างที่เหลือ:
 *   - ต่อที่อยู่เป็น /api/v1/... ส่ง cookie ไปด้วย แนบ access token
 *   - ได้ 401 (บัตรหมดอายุ) → แลกบัตรใหม่ 1 ครั้งแล้วส่งไฟล์ซ้ำ (ความคืบหน้าเริ่มนับใหม่) ;
 *     แลกไม่ได้ → แจ้ง "ถูกให้ออกจากระบบกลางคัน"
 *   - error ทุกกรณีเป็น ApiError รูปแบบเดียวกัน (ใช้ readResponse ตัวเดียวกับ apiFetch)
 * เพิ่มเติม: ยกเลิกกลางทางได้ด้วย AbortSignal → โยน UploadAbortedError
 *
 * ใช้ใน: เปลี่ยนไฟล์ในหน้าต่างแก้ไขเนื้อหา (ขั้น 4.6 ก) และอัปโหลดหลายไฟล์ (ขั้น 4.6 ข)
 */
import { getAccessToken, notifySessionExpired, refreshSession } from '../auth/session'
import { API_BASE, ApiError, readResponse } from './client'

/** ความคืบหน้า: ส่งไปแล้วกี่ไบต์ จากทั้งหมดกี่ไบต์ */
export type UploadProgress = { loaded: number; total: number }

export type UploadOptions = {
  /** เรียกทุกครั้งที่เบราว์เซอร์ส่งข้อมูลไปได้อีกช่วงหนึ่ง */
  onProgress?: (progress: UploadProgress) => void
  /** สั่งยกเลิกการส่ง (เช่น ผู้ใช้กด "หยุดอัปโหลด") */
  signal?: AbortSignal
}

/** ผู้ใช้สั่งยกเลิกการส่งเอง — ไม่ใช่ข้อผิดพลาด หน้าจอไม่ต้องขึ้นข้อความแดง */
export class UploadAbortedError extends Error {
  constructor() {
    super('Upload aborted')
    this.name = 'UploadAbortedError'
  }
}

/** ผลดิบของการส่ง 1 ครั้ง */
type RawResult = { status: number; text: string }

/** ส่ง FormData 1 ครั้งด้วย XHR (แนบ access token ล่าสุด) */
function sendOnce(path: string, form: FormData, { onProgress, signal }: UploadOptions): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAbortedError())
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}${path}`)
    // ส่ง cookie ไปด้วยเสมอ (refresh token อยู่ใน httpOnly cookie) — เหมือน credentials: 'include'
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')
    const token = getAccessToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    // ไม่ตั้ง Content-Type เอง — เบราว์เซอร์ใส่ multipart พร้อมเส้นคั่นให้

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total })
    }
    const stop = () => xhr.abort()
    signal?.addEventListener('abort', stop, { once: true })
    const cleanup = () => signal?.removeEventListener('abort', stop)

    xhr.onload = () => {
      cleanup()
      resolve({ status: xhr.status, text: xhr.responseText })
    }
    // ไม่มีคำตอบกลับมาเลย (backend ปิดอยู่ / เน็ตหลุดกลางทาง)
    xhr.onerror = () => {
      cleanup()
      reject(new ApiError(0, 'network_error'))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new UploadAbortedError())
    }
    xhr.send(form)
  })
}

/**
 * ส่งไฟล์ (FormData) ไปที่ backend แบบ POST พร้อมรายงานความคืบหน้า
 * @param path ที่อยู่หลัง /api/v1 เช่น '/courses/5/contents/12/file/'
 * @returns ข้อมูล JSON ที่ backend ตอบ
 * @throws ApiError เมื่อไม่สำเร็จ ; UploadAbortedError เมื่อถูกยกเลิก
 */
export async function uploadWithProgress<T>(
  path: string,
  form: FormData,
  options: UploadOptions = {},
): Promise<T> {
  let result = await sendOnce(path, form, options)

  // บัตรรายวันหมดอายุ → แลกใหม่ 1 ครั้ง แล้วส่งไฟล์เดิมซ้ำ
  if (result.status === 401) {
    const refreshed = await refreshSession()
    if (refreshed) {
      result = await sendOnce(path, form, options)
    } else {
      notifySessionExpired()
    }
  }

  return readResponse<T>(result.status, result.text)
}
