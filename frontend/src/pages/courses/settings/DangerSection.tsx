/**
 * การ์ดขอบแดงท้ายแท็บตั้งค่า (ขั้น 3.6) — แสดงอย่างใดอย่างหนึ่ง:
 *
 * - วิชาเผยแพร่แล้ว → "ปิดรายวิชา" (ยืนยันด้วยปุ่มแดง ตาม board "ยืนยันปิดรายวิชา")
 *   สำเร็จแล้วการ์ดนี้หายไป → ผลขึ้นแถบด้านบน + เลื่อนหน้าขึ้นไปให้เห็นกล่อง "ปิดรายวิชาแล้ว"
 * - ยังไม่เผยแพร่และไม่เคยมีผู้เรียน (can_delete จาก backend) → "ลบรายวิชา"
 *   สำเร็จ → กลับหน้ารายวิชาของฉันพร้อมแถบเขียว ; backend ตรวจซ้ำตอนลบ (course_not_deletable)
 *
 * SettingsTab ตัดสินว่าจะแสดงการ์ดนี้ไหม (ยังไม่ปิด และ ปิดได้หรือลบได้)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { deleteCourse } from '../../../api/courses'
import { Button, ConfirmDialog } from '../../../components/ui'
import { afterCourseDeleted } from '../courseCache'
import { useCoursePage } from '../useCoursePage'
import { Section } from './SettingsSection'
import { useConfirmStep, type SettingsActions } from './useSettingsActions'

export function DangerSection({ actions }: { actions: SettingsActions }) {
  const { t } = useTranslation()
  const { course, notify } = useCoursePage()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const dialog = useConfirmStep()
  // เผยแพร่แล้ว = ปิดได้ ; ยังไม่เผยแพร่ = ลบ
  const closing = course.is_published
  // หน้าต่างที่เปิด จำไว้ตอนกดปุ่ม — ถ้าลบไม่สำเร็จเพราะวิชาเพิ่งถูกเผยแพร่ หน้าต่างลบ (พร้อมข้อความ error)
  // ต้องยังเป็นหน้าต่างลบ ไม่กลายเป็นหน้าต่างปิดรายวิชาตามข้อมูลที่โหลดใหม่
  const [kind, setKind] = useState<'close' | 'delete'>('close')
  const openDialog = () => {
    setKind(closing ? 'close' : 'delete')
    dialog.show()
  }

  /** ยืนยันปิดรายวิชา — ส่วนนี้หายไปหลังปิด จึงใช้แถบด้านบน + เลื่อนขึ้น */
  function confirmClose() {
    return actions.runInDialog(dialog, async () => {
      await actions.apply('close')
      notify({ tone: 'ok', text: t('courseSettings.closedNotice') })
      window.scrollTo({ top: 0 })
    })
  }

  /** ยืนยันลบรายวิชา แล้วกลับหน้ารายวิชาของฉันพร้อมแถบเขียว */
  function confirmDelete() {
    return actions.runInDialog(dialog, async () => {
      await deleteCourse(course.id)
      await afterCourseDeleted(queryClient, course.id)
      const notice = t('courseSettings.deletedNotice', { code: course.code, name: course.name })
      await navigate('/courses', { state: { notice } })
    })
  }

  return (
    <>
      <div className="lg:rounded-card lg:border lg:border-bad-line lg:bg-surface">
        <Section
          danger
          title={closing ? t('courseSettings.closeTitle') : t('courseSettings.deleteTitle')}
          body={closing ? t('courseSettings.closeBody') : t('courseSettings.deleteBody')}
        >
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:gap-4">
            <p className="m-0 grow text-sm leading-[1.6] text-ink-muted">
              {closing ? t('courseSettings.closeNote') : t('courseSettings.deleteNote')}
            </p>
            <Button variant="danger" disabled={actions.running} onClick={openDialog} className="shrink-0">
              {closing ? t('courseSettings.close') : t('courseSettings.delete')}
            </Button>
          </div>
        </Section>
      </div>

      {dialog.open &&
        (kind === 'close' ? (
          <ConfirmDialog
            title={t('courseSettings.closeConfirmTitle', { name: course.name })}
            description={[
              t('courseSettings.closeConfirm1', { total: course.student_count }),
              t('courseSettings.closeConfirm2'),
              t('courseSettings.closeConfirm3'),
            ]}
            confirmLabel={t('courseSettings.close')}
            pendingLabel={t('courseSettings.closing')}
            pending={actions.running}
            error={dialog.error}
            onConfirm={() => void confirmClose()}
            onCancel={dialog.close}
          />
        ) : (
          <ConfirmDialog
            title={t('courseSettings.deleteConfirmTitle', { name: course.name })}
            description={[t('courseSettings.deleteConfirm')]}
            confirmLabel={t('courseSettings.delete')}
            pendingLabel={t('courseSettings.deleting')}
            pending={actions.running}
            error={dialog.error}
            onConfirm={() => void confirmDelete()}
            onCancel={dialog.close}
          />
        ))}
    </>
  )
}
