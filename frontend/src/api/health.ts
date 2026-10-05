/**
 * ฟังก์ชันเรียก endpoint ตรวจสุขภาพระบบของ backend: GET /api/health/
 */

/** ผลการตรวจสุขภาพระบบที่หน้าจอนำไปแสดง */
export type HealthResult = {
  /** true = backend ทำงานและเชื่อมฐานข้อมูลได้ (HTTP 2xx) */
  ok: boolean
  /** ข้อมูล JSON ที่ backend ตอบกลับมา (null = ติดต่อ backend ไม่ได้ / ไม่ใช่ JSON) */
  body: unknown
}

/**
 * เรียก backend เพื่อตรวจสุขภาพระบบ
 * - ตอนพัฒนา คำขอ /api จะถูก Vite ส่งต่อไปที่ backend (ดู vite.config.ts)
 * - ไม่โยน error ออกไป: ทุกกรณีคืนค่าเป็น HealthResult เพื่อให้หน้าจอแสดงผลได้เสมอ
 */
export async function fetchHealth(): Promise<HealthResult> {
  try {
    const response = await fetch('/api/health/')
    // อ่านคำตอบเป็น JSON ถ้าอ่านไม่ได้ (เช่น ได้หน้า HTML กลับมา) ให้ถือว่าไม่มีข้อมูล
    const body: unknown = await response.json().catch(() => null)
    return { ok: response.ok, body }
  } catch {
    // ติดต่อ backend ไม่ได้เลย (เช่น ยังไม่เปิด backend / เครือข่ายขัดข้อง)
    return { ok: false, body: null }
  }
}
