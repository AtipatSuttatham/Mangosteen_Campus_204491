/**
 * หน้าต่างเพิ่มผู้เรียน (UC-08 — ขั้น 3.6) ตาม board "เพิ่มผู้เรียน ①–④" ในแถวก้อน 3
 *
 *   เพิ่มผู้เรียน
 *   [ค้นหาทีละคน | วางรายการหรือเลือกไฟล์]
 *   <AddBySearch> หรือ <AddByList>
 *
 * - ทั้ง 2 แท็บเปิดค้างไว้ในหน่วยความจำ → สลับแท็บแล้วรายการที่กรอกไม่หาย
 * - หน้าต่างกว้าง 640px ; ตอนแสดงตารางตรวจรายการกว้าง 880px ; มือถือเต็มจอ
 * - ระหว่างรอผล ปิดหน้าต่าง / สลับแท็บไม่ได้
 * - ปิดหน้าต่างแล้วแจ้งจำนวนคนที่เพิ่มรวมทั้งหมด (onClose) → หน้ารายวิชาแสดงแถบเขียว
 */
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Course } from '../../api/courses'
import { Dialog, DialogHeader } from '../../components/ui'
import { AddByList } from './AddByList'
import { AddBySearch } from './AddBySearch'
import { Segmented } from './courseBits'

type AddStudentsDialogProps = {
  course: Course
  /** ปิดหน้าต่าง พร้อมจำนวนคนที่เพิ่มและเพิ่มกลับสำเร็จทั้งหมด */
  onClose: (total: number) => void
}

export function AddStudentsDialog({ course, onClose }: AddStudentsDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'search' | 'list'>('search')
  const [wide, setWide] = useState(false)
  const [busy, setBusy] = useState(false)
  const [total, setTotal] = useState(0)

  const requestClose = () => {
    if (!busy) onClose(total)
  }
  const handleAdded = (count: number) => setTotal((current) => current + count)

  return (
    <Dialog
      labelledBy={titleId}
      onClose={requestClose}
      size={wide && tab === 'list' ? 'xl' : 'lg'}
      initialFocusRef={searchRef}
    >
      <DialogHeader
        titleId={titleId}
        title={t('addStudents.title')}
        subtitle={t('addStudents.subtitle', { name: course.name, code: course.code })}
        onClose={requestClose}
        closeDisabled={busy}
      />
      <div className="px-4 pt-4 lg:px-7 lg:pt-5">
        <Segmented
          label={t('addStudents.methodLabel')}
          value={tab}
          onChange={setTab}
          disabled={busy}
          options={[
            { value: 'search', label: t('addStudents.tabSearch') },
            { value: 'list', label: t('addStudents.tabList') },
          ]}
          className="grid grid-cols-[auto_minmax(0,1fr)] lg:inline-flex"
        />
      </div>
      <AddBySearch
        course={course}
        active={tab === 'search'}
        inputRef={searchRef}
        onAdded={handleAdded}
        onDone={requestClose}
      />
      <AddByList
        course={course}
        active={tab === 'list'}
        onAdded={handleAdded}
        onDone={requestClose}
        onBusyChange={setBusy}
        onWideChange={setWide}
      />
    </Dialog>
  )
}
