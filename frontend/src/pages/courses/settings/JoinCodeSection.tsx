/**
 * ส่วน "รหัสเข้าร่วม" ของแท็บตั้งค่า (ขั้น 3.6) — แสดงเฉพาะวิชาที่ยังไม่ปิด
 *
 * - สวิตช์เปิด / ปิดการใช้รหัส: ทำทันที (สวิตช์เปลี่ยนให้เห็นเอง จึงไม่ขึ้นป้าย "สำเร็จ")
 * - รหัสตัวใหญ่ + ปุ่มคัดลอก + "สร้างรหัสใหม่" (ยืนยันก่อน — ผู้ใช้เลือกแบบ ค1 ; รหัสเดิมใช้ไม่ได้ทันที)
 */
import { useTranslation } from 'react-i18next'
import { Button, ConfirmDialog } from '../../../components/ui'
import { CopyButton } from '../../admin/users/CopyButton'
import { RefreshIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'
import { Hint, ResultLine, Section, Switch } from './SettingsSection'
import { useConfirmStep, type SettingsActions } from './useSettingsActions'

export function JoinCodeSection({ actions, className }: { actions: SettingsActions; className: string }) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const dialog = useConfirmStep()
  const labelId = `course-${course.id}-join`
  const enabled = course.join_code_enabled

  /** ยืนยันสร้างรหัสใหม่ — ผลขึ้นในส่วนนี้ */
  function confirmRegenerate() {
    return actions.runInDialog(dialog, async () => {
      await actions.apply('join-code/regenerate')
      actions.showResult({ section: 'join', tone: 'ok', text: t('courseSettings.regeneratedNotice') })
    })
  }

  return (
    <>
      <Section
        title={t('courseSettings.joinTitle')}
        body={t('courseSettings.joinBody')}
        className={className}
      >
        <div className="flex items-center gap-3.5">
          <Switch
            checked={enabled}
            labelledBy={labelId}
            disabled={actions.running}
            onChange={() => void actions.runNow('join', enabled ? 'join-code/disable' : 'join-code/enable')}
          />
          <span id={labelId} className="text-[15px] font-semibold">
            {t('courseSettings.joinSwitch')}
          </span>
        </div>
        {enabled && course.join_code ? (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-canvas px-[18px] py-4">
              <div>
                <div className="text-sm leading-[1.6] text-ink-muted">{t('courseSettings.joinCode')}</div>
                <div className="text-[30px] leading-[1.3] font-semibold tracking-[0.2em] tabular-nums">
                  {course.join_code}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:ml-auto">
                <CopyButton text={course.join_code} className="h-11!" />
                <Button variant="secondary" disabled={actions.running} onClick={dialog.show}>
                  <RefreshIcon />
                  {t('courseSettings.regenerate')}
                </Button>
              </div>
            </div>
            <Hint>{t('courseSettings.regenerateHint')}</Hint>
          </>
        ) : (
          <Hint>{t('courseSettings.joinOffHint')}</Hint>
        )}
        <ResultLine result={actions.resultFor('join')} />
      </Section>

      {dialog.open && (
        <ConfirmDialog
          tone="primary"
          title={t('courseSettings.regenerateTitle')}
          description={[
            t('courseSettings.regenerateBody', { code: course.join_code }),
            t('courseSettings.regenerateBody2'),
          ]}
          confirmLabel={t('courseSettings.regenerate')}
          pendingLabel={t('courseSettings.regenerating')}
          pending={actions.running}
          error={dialog.error}
          onConfirm={() => void confirmRegenerate()}
          onCancel={dialog.close}
        />
      )}
    </>
  )
}
