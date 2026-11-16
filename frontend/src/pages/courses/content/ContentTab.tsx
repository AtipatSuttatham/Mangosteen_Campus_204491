/**
 * แท็บเนื้อหาของผู้สอน /courses/:courseId (แท็บแรก — ขั้น 4.5 แบบ กช1)
 * หน้าตาตาม board "แท็บเนื้อหา (ผู้สอน)" จอใหญ่ + มือถือ แถวก้อน 4 ใน design canvas
 *
 *   หน่วยการเรียน                                  [+ เพิ่มหน่วยการเรียน]
 *   6 หน่วย   เผยแพร่แล้ว 4 หน่วย
 *   ┌ › ① ก้าวแรกกับ Python … ┐   ← ModuleCard (พับ / เปิด, ปุ่ม ↑ ↓ แก้ไข เผยแพร่ ลบ)
 *   ┌ ⌄ ③ โครงสร้างควบคุม…   ┐
 *   │   แถวเนื้อหา …          │   ← ContentRow
 *
 * - ผู้สอนเจ้าของ: จัดการหน่วยครบ + เลื่อน / เผยแพร่ / ลบแถวเนื้อหา
 * - ผู้ดูแลระบบ (กง1) และรายวิชาที่ปิดแล้ว: ดูอย่างเดียว (ไม่มีปุ่ม) + ข้อความบอกเหตุผล
 *   (backend ตรวจซ้ำเสมอ: ผู้ดูแลระบบ 403 content_read_only / วิชาที่ปิด 409 course_closed)
 * - ขั้น 4.6 ก: เขียนข้อความ / เพิ่มลิงก์ (ปุ่มท้ายหน่วยที่เปิด) + แก้ไขเนื้อหา (ปุ่มในแถว)
 *   อัปโหลดหลายไฟล์มาในขั้น 4.6 ข ; ดูตัวอย่างเนื้อหามาในขั้น 4.7 (ผู้ใช้เลือกแบบ กฟ1)
 *   — ยังไม่แสดงปุ่มที่ยังทำงานไม่ได้
 * - ย้ายเนื้อหาไปหน่วยอื่น (ช่อง "อยู่ในหน่วย") → เปิดหน่วยปลายทางให้เห็น + โฟกัสหัวข้อ
 *   (ปุ่ม "แก้ไข" ที่เปิดหน้าต่างย้ายไปอยู่หน่วยอื่นแล้ว โฟกัสจึงกลับไปที่เดิมไม่ได้)
 * - หน่วยที่เปิดอยู่จำไว้เฉพาะระหว่างอยู่ในหน้า ; เริ่มต้นพับทุกหน่วย ; หน่วยที่เพิ่งสร้างเปิดให้ทันที
 * - ลบสำเร็จ → โฟกัสหัวข้อ "หน่วยการเรียน" (ปุ่ม "ลบ" ที่เปิดหน้าต่างหายไปพร้อมแถวแล้ว — แก้หลังตรวจขั้น 4.5 กภ1)
 */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import {
  deleteContent,
  deleteModule,
  fetchModules,
  moveContent,
  moveModule,
  runContentAction,
  runModuleAction,
  type Content,
  type Module,
} from '../../../api/content'
import { errorMessage } from '../../../api/errors'
import { Button, Card, ConfirmDialog } from '../../../components/ui'
import { StateMessage } from '../courseBits'
import { modulesKey } from '../courseCache'
import { InfoIcon, PlusIcon } from '../icons'
import { useConfirmStep } from '../settings/useSettingsActions'
import { useCoursePage } from '../useCoursePage'
import { ContentEditDialog } from './ContentEditDialog'
import { LinkDialog } from './LinkDialog'
import { ModuleCard } from './ModuleCard'
import { ModuleDialog } from './ModuleDialog'
import { TextContentDialog } from './TextContentDialog'
import { useContentActions } from './useContentActions'

/** หน้าต่างเพิ่ม / แก้หน่วยที่เปิดอยู่ */
type ModuleDialogState = { mode: 'create' } | { mode: 'edit'; module: Module }
/** หน้าต่างเพิ่ม / แก้เนื้อหาที่เปิดอยู่ (ขั้น 4.6 ก) — เก็บแค่รหัส แล้วหาข้อมูลล่าสุดจากรายการ */
type ContentDialogState =
  { mode: 'text'; moduleId: number } | { mode: 'link'; moduleId: number } | { mode: 'edit'; content: Content }
/** สิ่งที่กำลังยืนยันลบ */
type DeleteTarget = { kind: 'module'; module: Module } | { kind: 'content'; content: Content }

export default function ContentTab() {
  const { t } = useTranslation()
  const { course, isAdmin } = useCoursePage()
  const readOnly = isAdmin || course.is_closed
  const actions = useContentActions()
  const confirm = useConfirmStep()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const [openIds, setOpenIds] = useState<ReadonlySet<number>>(() => new Set())
  const [moduleDialog, setModuleDialog] = useState<ModuleDialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [contentDialog, setContentDialog] = useState<ContentDialogState | null>(null)
  /**
   * คำขอโฟกัสหัวข้อหลังย้ายเนื้อหาไปหน่วยอื่น (นับครั้ง) — ทำใน effect หลังหน้าต่างปิดแล้ว
   * เพราะตอนปิด หน้าต่างคืนโฟกัสให้ปุ่ม "แก้ไข" ที่เปิดมัน ซึ่งตอนนี้อยู่หน่วยอื่น (หรือหายไปแล้ว)
   */
  const [headingFocusRequest, setHeadingFocusRequest] = useState(0)
  const handledFocusRef = useRef(0)
  const {
    data: modules,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: modulesKey(course.id),
    queryFn: () => fetchModules(course.id),
  })

  useEffect(() => {
    if (contentDialog || headingFocusRequest === handledFocusRef.current) return
    handledFocusRef.current = headingFocusRequest
    headingRef.current?.focus()
  }, [contentDialog, headingFocusRequest])

  /** หน่วย + ลำดับบนจอ จากรหัส (ไม่พบ = หน่วยถูกลบไปแล้ว) */
  const findModule = (moduleId: number) => {
    const index = modules?.findIndex((module) => module.id === moduleId) ?? -1
    return index >= 0 && modules ? { module: modules[index]!, number: index + 1 } : null
  }

  /** เพิ่ม / แก้เนื้อหาสำเร็จ → ปิดหน้าต่าง ; ย้ายไปหน่วยอื่น → เปิดหน่วยปลายทาง + ขอโฟกัสหัวข้อ */
  const contentSaved = (saved: Content, previousModuleId: number) => {
    setContentDialog(null)
    if (saved.module !== previousModuleId) {
      setOpenIds((current) => new Set(current).add(saved.module))
      setHeadingFocusRequest((count) => count + 1)
    }
  }

  const toggle = (moduleId: number) =>
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })

  const askDelete = (target: DeleteTarget) => {
    setDeleteTarget(target)
    confirm.show()
  }

  /** ยืนยันลบหน่วย / เนื้อหา → แถบเขียว "ลบ … แล้ว" + โฟกัสหัวข้อ (แถวที่ลบหายไปแล้ว) */
  async function confirmDelete() {
    if (!deleteTarget) return
    let deleted: boolean
    if (deleteTarget.kind === 'module') {
      const { module } = deleteTarget
      deleted = await actions.runInDialog(
        confirm,
        () => deleteModule(course.id, module.id),
        t('content.moduleDeleted', { name: module.title }),
      )
    } else {
      const { content } = deleteTarget
      deleted = await actions.runInDialog(
        confirm,
        () => deleteContent(course.id, content.id),
        t('content.contentDeleted', { name: content.title }),
      )
    }
    if (deleted) headingRef.current?.focus()
  }

  // หน่วยของหน้าต่างเนื้อหาที่เปิดอยู่ (แก้ = หน่วยที่เนื้อหาอยู่ ; เพิ่ม = หน่วยที่กดปุ่ม)
  const contentTarget = contentDialog
    ? findModule(contentDialog.mode === 'edit' ? contentDialog.content.module : contentDialog.moduleId)
    : null

  const publishedCount = modules?.filter((module) => module.is_published).length ?? 0
  const addButton = !readOnly && (
    <Button onClick={() => setModuleDialog({ mode: 'create' })} disabled={actions.running}>
      <PlusIcon />
      {t('content.addModule')}
    </Button>
  )

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div>
          {/* tabIndex -1: โฟกัสด้วยโค้ดได้ (หลังลบ) แต่ไม่อยู่ในลำดับ Tab */}
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="m-0 font-display text-[21px] font-semibold outline-none lg:text-[22px]"
          >
            {t('content.heading')}
          </h2>
          {modules && modules.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-x-5 text-sm text-ink-muted">
              <span>{t('content.moduleCount', { count: modules.length })}</span>
              <span>{t('content.publishedCount', { count: publishedCount })}</span>
            </div>
          )}
        </div>
        {modules && modules.length > 0 && addButton && (
          <div className="max-lg:[&>button]:w-full">{addButton}</div>
        )}
      </div>

      {readOnly && (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-mute-soft px-3.5 py-3 text-sm leading-[1.55] text-mute">
          <span className="mt-0.5 shrink-0">
            <InfoIcon />
          </span>
          <p className="m-0">{isAdmin ? t('content.readOnlyAdmin') : t('content.readOnlyClosed')}</p>
        </div>
      )}

      {isPending ? (
        <Card>
          <StateMessage>
            <p className="m-0" role="status">
              {t('content.loading')}
            </p>
          </StateMessage>
        </Card>
      ) : !modules ? (
        <Card>
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-semibold text-ink">{t('content.loadFailed')}</p>
              <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
            </div>
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('content.retry')}
            </Button>
          </StateMessage>
        </Card>
      ) : modules.length === 0 ? (
        <Card>
          <StateMessage>
            <p className="m-0 font-display text-xl font-semibold text-ink">{t('content.emptyTitle')}</p>
            <p className="m-0">{readOnly ? t('content.emptyReadOnly') : t('content.emptyBody')}</p>
            {addButton}
          </StateMessage>
        </Card>
      ) : (
        <ol aria-label={t('content.heading')} className="m-0 flex list-none flex-col gap-2.5 p-0">
          {modules.map((module, index) => (
            <ModuleCard
              key={module.id}
              module={module}
              number={index + 1}
              first={index === 0}
              last={index === modules.length - 1}
              open={openIds.has(module.id)}
              onToggle={() => toggle(module.id)}
              readOnly={readOnly}
              disabled={actions.running}
              onMove={(direction) => void actions.runNow(() => moveModule(course.id, module.id, direction))}
              onTogglePublish={() =>
                void actions.runNow(() =>
                  runModuleAction(course.id, module.id, module.is_published ? 'unpublish' : 'publish'),
                )
              }
              onEdit={() => setModuleDialog({ mode: 'edit', module })}
              onDelete={() => askDelete({ kind: 'module', module })}
              onContentMove={(content, direction) =>
                void actions.runNow(() => moveContent(course.id, content.id, direction))
              }
              onContentTogglePublish={(content) =>
                void actions.runNow(() =>
                  runContentAction(course.id, content.id, content.is_published ? 'unpublish' : 'publish'),
                )
              }
              onContentDelete={(content) => askDelete({ kind: 'content', content })}
              onContentEdit={(content) => setContentDialog({ mode: 'edit', content })}
              onAddText={() => setContentDialog({ mode: 'text', moduleId: module.id })}
              onAddLink={() => setContentDialog({ mode: 'link', moduleId: module.id })}
            />
          ))}
        </ol>
      )}

      {moduleDialog && (
        <ModuleDialog
          module={moduleDialog.mode === 'edit' ? moduleDialog.module : undefined}
          onClose={() => setModuleDialog(null)}
          onSaved={(saved) => {
            // หน่วยที่เพิ่งสร้างเปิดให้ทันที (เห็นว่าอยู่ท้ายรายการ พร้อมใส่เนื้อหา)
            if (moduleDialog.mode === 'create') setOpenIds((current) => new Set(current).add(saved.id))
            setModuleDialog(null)
          }}
        />
      )}

      {/* หน้าต่างเพิ่ม / แก้เนื้อหา (ขั้น 4.6 ก) — หน่วยหายไประหว่างเปิด (มีคนลบ) → ไม่แสดง */}
      {contentDialog?.mode === 'edit' &&
        contentTarget &&
        modules &&
        (contentDialog.content.content_type === 'text' ? (
          <TextContentDialog
            module={contentTarget.module}
            number={contentTarget.number}
            modules={modules}
            content={contentDialog.content}
            onClose={() => setContentDialog(null)}
            onSaved={(saved) => contentSaved(saved, contentTarget.module.id)}
          />
        ) : (
          <ContentEditDialog
            module={contentTarget.module}
            number={contentTarget.number}
            modules={modules}
            content={contentDialog.content}
            onClose={() => setContentDialog(null)}
            onSaved={(saved) => contentSaved(saved, contentTarget.module.id)}
          />
        ))}
      {contentDialog?.mode === 'text' && contentTarget && modules && (
        <TextContentDialog
          module={contentTarget.module}
          number={contentTarget.number}
          modules={modules}
          onClose={() => setContentDialog(null)}
          onSaved={(saved) => contentSaved(saved, contentTarget.module.id)}
        />
      )}
      {contentDialog?.mode === 'link' && contentTarget && (
        <LinkDialog
          module={contentTarget.module}
          number={contentTarget.number}
          onClose={() => setContentDialog(null)}
          onSaved={(saved) => contentSaved(saved, contentTarget.module.id)}
        />
      )}

      {confirm.open && deleteTarget && (
        <ConfirmDialog
          title={
            deleteTarget.kind === 'module'
              ? t('content.deleteModuleTitle', { name: deleteTarget.module.title })
              : t('content.deleteContentTitle', { name: deleteTarget.content.title })
          }
          description={
            deleteTarget.kind === 'module'
              ? [
                  deleteTarget.module.contents.length > 0
                    ? t('content.deleteModuleItems', { count: deleteTarget.module.contents.length })
                    : t('content.deleteModuleNoItems'),
                  t('content.deleteHint'),
                ]
              : [
                  ...(deleteTarget.content.file_link ? [t('content.deleteContentFile')] : []),
                  t('content.deleteHint'),
                ]
          }
          confirmLabel={
            deleteTarget.kind === 'module' ? t('content.deleteModule') : t('content.deleteContent')
          }
          pendingLabel={t('content.deleting')}
          pending={actions.running}
          error={confirm.error}
          onConfirm={() => void confirmDelete()}
          onCancel={confirm.close}
        />
      )}
    </div>
  )
}
