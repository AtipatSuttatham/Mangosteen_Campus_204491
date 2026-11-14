/**
 * ส่วน "ผู้สอน" ของแท็บตั้งค่า — เฉพาะผู้ดูแลระบบ (ขั้น 3.8)
 *
 * เลือกผู้สอนใหม่ในช่อง → "เปลี่ยนผู้สอน" → หน้าต่างยืนยัน (ผู้ใช้เลือกแบบ ว1 — ผู้สอนเดิมหลุดจากวิชาทันที)
 * ใช้ได้แม้วิชาปิดแล้ว ; ปุ่มกดได้เมื่อเลือกคนอื่นที่รับวิชาได้ (บัญชีผู้สอนที่ใช้งานได้)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { updateCourse } from '../../../api/courses'
import { fieldErrorsMessage } from '../../../api/errors'
import { Button, ConfirmDialog } from '../../../components/ui'
import { teacherName, useAdminTeachers } from '../adminCourseData'
import { ADMIN_TEACHERS_KEY, afterTeacherChanged, courseKey } from '../courseCache'
import { TeacherSelect } from '../TeacherSelect'
import { useCoursePage } from '../useCoursePage'
import { ResultLine, Section } from './SettingsSection'
import { apiMessage, useConfirmStep, type SettingsActions } from './useSettingsActions'

export function TeacherSection({ actions, className }: { actions: SettingsActions; className: string }) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const queryClient = useQueryClient()
  const dialog = useConfirmStep()
  // ส่วนนี้แสดงเฉพาะผู้ดูแลระบบ → โหลดรายชื่อผู้สอนได้เสมอ (ผู้สอนเรียก API นี้ไม่ได้)
  const teachers = useAdminTeachers()
  // ผู้สอนที่เลือกในช่อง (null = ยังไม่แตะ → แสดงผู้สอนปัจจุบัน)
  const [pickedTeacher, setPickedTeacher] = useState<string | null>(null)
  const teacherValue = pickedTeacher ?? String(course.teacher.id)
  const teacherChanged = teacherValue !== String(course.teacher.id)
  const pickedRow = teachers.data?.find((item) => String(item.id) === teacherValue)

  /** ยืนยันในหน้าต่างแล้วเปลี่ยนผู้สอน — ผลขึ้นในส่วนนี้ */
  function confirmChange() {
    return actions.runInDialog(
      dialog,
      async () => {
        try {
          const updated = await updateCourse(course.id, { teacher: Number(teacherValue) })
          queryClient.setQueryData(courseKey(course.id), updated)
          setPickedTeacher(null)
          await afterTeacherChanged(queryClient)
          actions.showResult({
            section: 'teacher',
            tone: 'ok',
            text: t('courseSettings.teacherChangedNotice', { name: teacherName(updated.teacher) }),
          })
        } catch (caught) {
          // ไม่สำเร็จ → รายชื่อผู้สอนอาจเก่า (เช่น คนที่เลือกเพิ่งถูกระงับ) โหลดใหม่ด้วย
          await queryClient.invalidateQueries({ queryKey: ADMIN_TEACHERS_KEY })
          throw caught
        }
      },
      // ผู้สอนที่เลือกใช้ไม่ได้แล้ว → teacher_not_assignable ; อื่น ๆ → ข้อความรวม
      (caught) =>
        (caught instanceof ApiError ? fieldErrorsMessage(caught.fields.teacher) : undefined) ??
        apiMessage(caught),
    )
  }

  return (
    <>
      <Section title={t('courseSettings.teacherTitle')} body={t('courseSettings.teacherBody')} className={className}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-2.5">
          <div className="min-w-0 grow">
            <TeacherSelect
              label={t('courseSettings.teacherLabel')}
              value={teacherValue}
              onChange={(value) => {
                setPickedTeacher(value)
                actions.clearResult()
              }}
              current={course.teacher}
              hint={t('courseSettings.teacherChangeHint')}
              disabled={actions.running}
            />
          </div>
          {/* จอใหญ่: ปุ่มอยู่ระดับเดียวกับช่อง (เว้นที่ให้ป้ายชื่อด้านบน) */}
          <Button
            variant="secondary"
            disabled={actions.running || !teacherChanged || !pickedRow?.assignable}
            onClick={dialog.show}
            className="shrink-0 lg:mt-[30px] lg:h-[46px]"
          >
            {t('courseSettings.changeTeacher')}
          </Button>
        </div>
        <ResultLine result={actions.resultFor('teacher')} />
      </Section>

      {dialog.open && pickedRow && (
        <ConfirmDialog
          tone="primary"
          title={t('courseSettings.changeTeacherTitle', { name: teacherName(pickedRow) })}
          description={[
            t('courseSettings.changeTeacherBody', { name: teacherName(course.teacher) }),
            t('courseSettings.changeTeacherBody2'),
          ]}
          confirmLabel={t('courseSettings.changeTeacher')}
          pendingLabel={t('courseSettings.changingTeacher')}
          pending={actions.running}
          error={dialog.error}
          onConfirm={() => void confirmChange()}
          onCancel={dialog.close}
        />
      )}
    </>
  )
}
