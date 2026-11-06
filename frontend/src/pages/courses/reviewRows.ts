/**
 * ลำดับแถวในตารางตรวจรายการ (ขั้น 3.6 — ผู้ใช้เลือกแบบ ฎ1)
 * แยกจากไฟล์หน้าจอเพราะไฟล์ component ควร export แต่ component (กฎ react-refresh ของ ESLint)
 */
import type { PreviewResult, PreviewRow } from '../../api/enrollments'

/** ลำดับการแสดง: เพิ่มไม่ได้ → เพิ่มกลับ → อยู่แล้ว → จะเพิ่ม */
const RESULT_ORDER: Record<PreviewResult, number> = {
  not_found: 0,
  not_student: 0,
  suspended: 0,
  reactivate: 1,
  already: 2,
  add: 3,
}

/** เรียงแถวตามความสำคัญ (ผลเดียวกันคงลำดับเดิม) */
export function sortRows(rows: PreviewRow[]): PreviewRow[] {
  return [...rows].sort((a, b) => RESULT_ORDER[a.result] - RESULT_ORDER[b.result])
}
