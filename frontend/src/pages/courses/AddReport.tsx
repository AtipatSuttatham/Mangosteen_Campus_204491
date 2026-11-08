/**
 * รายงานผลหลังกดเพิ่มผู้เรียน ตาม board "เพิ่มผู้เรียน ② ผลหลังกดเพิ่ม" (ขั้น 3.6 — ผู้ใช้เลือกแบบ ซ1)
 *
 *   ✓ เพิ่มผู้เรียน 39 คนแล้ว                      ← รวมคนที่เพิ่มกลับ (ตรงกับตัวเลขบนปุ่ม — แบบ ธ1)
 *     รวมเพิ่มกลับ 1 คนที่เคยถูกถอน (660510150 สมหญิง ดวงดี)
 *     อยู่ในรายวิชาแล้ว 1 คน (660510221 กันต์พงษ์ วิไลรัตน์)
 *     รายการซ้ำ 1 รายการ นับครั้งเดียว
 *   ⚠ เพิ่มไม่ได้ 3 รายการ
 *     • 670519999 ไม่พบผู้ใช้นี้
 *
 * แสดงบรรทัดรองเฉพาะกลุ่มที่มี ; ระบุชื่อเฉพาะกลุ่มที่มีคนเดียว (หลายคนแสดงแค่จำนวน)
 */
import { useTranslation } from 'react-i18next'
import type { AddStudentsResult } from '../../api/enrollments'
import { CheckIcon, WarnIcon } from './icons'

type Row = AddStudentsResult['added'][number]

/** ตัวแปรของข้อความกลุ่มที่มีคนเดียว */
function person({ student }: Row) {
  return {
    id: student.student_or_staff_id ?? student.email,
    name: `${student.first_name} ${student.last_name}`,
  }
}

export function AddReport({ report }: { report: AddStudentsResult & { duplicates: number } }) {
  const { t } = useTranslation()
  const { added, reactivated, already, failed, duplicates } = report
  const hasSuccessBox = added.length + reactivated.length + already.length + duplicates > 0
  // จำนวนรวม = คนใหม่ + คนที่เพิ่มกลับ — ตรงกับตัวเลขบนปุ่ม "เพิ่มผู้เรียน N คน" (ขั้น 3.6 รอบ 3 แบบ ธ1)
  const joined = added.length + reactivated.length
  const [onlyReactivated] = reactivated
  const [onlyAlready] = already

  return (
    <>
      {hasSuccessBox && (
        <div role="status" className="flex flex-col gap-0.5 rounded-[10px] bg-ok-soft px-3.5 py-3 text-ok">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <CheckIcon />
            {joined > 0 ? t('addStudents.reportAdded', { total: joined }) : t('addStudents.reportNoneAdded')}
          </div>
          <ul className="m-0 mt-0.5 list-none pl-[26px] text-sm leading-[1.7]">
            {reactivated.length > 0 && (
              <li>
                {reactivated.length === 1 && onlyReactivated
                  ? t('addStudents.reportReactivatedOne', person(onlyReactivated))
                  : t('addStudents.reportReactivated', { total: reactivated.length })}
              </li>
            )}
            {already.length > 0 && (
              <li>
                {already.length === 1 && onlyAlready
                  ? t('addStudents.reportAlreadyOne', person(onlyAlready))
                  : t('addStudents.reportAlready', { total: already.length })}
              </li>
            )}
            {duplicates > 0 && <li>{t('addStudents.reportDuplicates', { total: duplicates })}</li>}
          </ul>
        </div>
      )}
      {failed.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-bad-soft px-3.5 py-3 text-bad">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <WarnIcon />
            {t('addStudents.reportFailed', { total: failed.length })}
          </div>
          <ul className="m-0 mt-1 list-disc pl-[26px] text-sm leading-[1.7] text-ink">
            {failed.map((item) => (
              <li key={item.identifier}>
                <span className="font-semibold">{item.identifier}</span>{' '}
                {t(`addStudents.failure.${item.reason}`)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
