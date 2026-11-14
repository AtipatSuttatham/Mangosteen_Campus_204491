/**
 * ส่วน "การเผยแพร่" ของแท็บตั้งค่า (ขั้น 3.6) — แสดงเฉพาะวิชาที่ยังไม่ปิด
 *
 * - เผยแพร่: ทำทันที (ผู้เรียนเห็นวิชา + ใช้รหัสเข้าร่วมได้)
 * - ยกเลิกเผยแพร่: ยืนยันก่อน ปุ่มม่วง (ผู้ใช้เลือกแบบ ง1 — ผู้เรียนจะมองไม่เห็นวิชาชั่วคราว)
 */
import { useTranslation } from 'react-i18next'
import { Button, ConfirmDialog, StatusBadge } from '../../../components/ui'
import { EyeIcon, EyeOffIcon } from '../icons'
import { useCoursePage } from '../useCoursePage'
import { Hint, ResultLine, Section } from './SettingsSection'
import { useConfirmStep, type SettingsActions } from './useSettingsActions'

export function PublishSection({ actions, className }: { actions: SettingsActions; className: string }) {
  const { t } = useTranslation()
  const { course } = useCoursePage()
  const dialog = useConfirmStep()
  const published = course.is_published

  /** ยืนยันยกเลิกเผยแพร่ — ผลขึ้นในส่วนนี้ */
  function confirmUnpublish() {
    return actions.runInDialog(dialog, async () => {
      await actions.apply('unpublish')
      actions.showResult({ section: 'publish', tone: 'ok', text: t('courseSettings.unpublishedNotice') })
    })
  }

  return (
    <>
      <Section
        title={t('courseSettings.publishTitle')}
        body={t('courseSettings.publishBody')}
        className={className}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3.5">
          <StatusBadge
            tone={published ? 'ok' : 'mute'}
            icon={published ? <EyeIcon /> : <EyeOffIcon />}
            className="w-fit"
          >
            {published ? t('coursePage.published') : t('courses.draft')}
          </StatusBadge>
          <span className="text-sm leading-[1.6] text-ink-muted">
            {published ? t('courseSettings.publishedNote') : t('courseSettings.draftNote')}
          </span>
          {published ? (
            <Button
              variant="secondary"
              disabled={actions.running}
              onClick={dialog.show}
              className="lg:ml-auto"
            >
              {t('courseSettings.unpublish')}
            </Button>
          ) : (
            <Button
              disabled={actions.running}
              onClick={() => void actions.runNow('publish', 'publish', t('courseSettings.publishedNotice'))}
              className="lg:ml-auto"
            >
              {t('courseSettings.publish')}
            </Button>
          )}
        </div>
        {published && <Hint>{t('courseSettings.unpublishHint')}</Hint>}
        <ResultLine result={actions.resultFor('publish')} />
      </Section>

      {dialog.open && (
        <ConfirmDialog
          tone="primary"
          title={t('courseSettings.unpublishTitle', { name: course.name })}
          description={[t('courseSettings.unpublishHint')]}
          confirmLabel={t('courseSettings.unpublish')}
          pendingLabel={t('courseSettings.unpublishing')}
          pending={actions.running}
          error={dialog.error}
          onConfirm={() => void confirmUnpublish()}
          onCancel={dialog.close}
        />
      )}
    </>
  )
}
