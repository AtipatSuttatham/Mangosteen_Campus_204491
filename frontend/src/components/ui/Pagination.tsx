/**
 * แถบเปลี่ยนหน้าของรายการแบบแบ่งหน้า — หน้าตาตาม <nav aria-label="แบ่งหน้า"> ใน board "รายชื่อผู้ใช้"
 * (จอใหญ่) และ "รายชื่อผู้ใช้ (มือถือ)" (ขั้น 2.5) ; ใช้ซ้ำได้กับทุกรายการที่แบ่งหน้า (docs/api.md §2)
 *
 *   จอใหญ่:  แสดง 1–20 จาก 248 บัญชี                [‹ ก่อนหน้า]  หน้า 1 จาก 13  [ถัดไป ›]
 *   มือถือ:  [‹ ก่อนหน้า]          หน้า 1 จาก 13          [ถัดไป ›]      (ไม่มีข้อความสรุปด้านซ้าย)
 *
 * - หน้าแรกกด "ก่อนหน้า" ไม่ได้ / หน้าสุดท้ายกด "ถัดไป" ไม่ได้
 * - มีหน้าเดียว → ไม่มีปุ่ม (เหลือแค่ข้อความสรุป ถ้ามี)
 * - summary: ข้อความสรุปด้านซ้าย (ข้อความจาก th.ts ที่ผู้ใช้ประกอบเอง เช่น "แสดง 1–20 จาก 248 บัญชี")
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

type PaginationProps = {
  /** หน้าปัจจุบัน (เริ่มที่ 1) */
  page: number
  /** จำนวนหน้าทั้งหมด */
  pageCount: number
  /** เรียกเมื่อกดเปลี่ยนหน้า พร้อมเลขหน้าใหม่ */
  onPageChange: (page: number) => void
  /** ข้อความสรุปด้านซ้าย (แสดงเฉพาะจอใหญ่) */
  summary?: ReactNode
  className?: string
}

/** ลูกศรซ้าย/ขวาในปุ่ม (ตกแต่งอย่างเดียว) */
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}

/** แถบเปลี่ยนหน้า */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  summary,
  className = '',
}: PaginationProps) {
  const { t } = useTranslation()
  const hasPages = pageCount > 1

  return (
    <nav
      aria-label={t('pagination.label')}
      className={`flex items-center justify-between gap-3 ${className}`}
    >
      {summary && <div className="hidden text-sm leading-[1.6] text-ink-muted lg:block">{summary}</div>}
      {hasPages && (
        <div className="flex flex-1 items-center justify-between gap-2 lg:flex-none lg:justify-end">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="lg:h-10"
          >
            <Chevron direction="left" />
            {t('pagination.previous')}
          </Button>
          <span className="px-1.5 text-sm leading-[1.6] text-ink-muted">
            {t('pagination.pageOf', { page, total: pageCount })}
          </span>
          <Button
            variant="secondary"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className="lg:h-10"
          >
            {t('pagination.next')}
            <Chevron direction="right" />
          </Button>
        </div>
      )}
    </nav>
  )
}
