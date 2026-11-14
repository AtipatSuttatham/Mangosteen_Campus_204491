/**
 * แท็บ "ค้นหาทีละคน" ของหน้าต่างเพิ่มผู้เรียน ตาม board "เพิ่มผู้เรียน ① ค้นหาทีละคน" (ขั้น 3.6)
 *
 *   ค้นหาผู้เรียน [สม                    ]
 *   (สร) สมใจ รักเรียน 670510009 …                      [✓ เพิ่มแล้ว]
 *   (สศ) สมศักดิ์ มีสุข 670510114 …                          [เพิ่ม]
 *   (สพ) สมพร แก้วใส … เคยถูกถอน…                       [เพิ่มกลับ]
 *
 * ค้นหลังหยุดพิมพ์ 0.3 วินาที ; ต้องพิมพ์อย่างน้อย 2 ตัวอักษร ; กดเพิ่มแล้วเพิ่มทันที
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { Course } from '../../api/courses'
import { addStudents, searchCandidates, type Candidate } from '../../api/enrollments'
import { errorMessage } from '../../api/errors'
import { Button, DialogBody, DialogFooter, SearchInput, StatusBadge } from '../../components/ui'
import { initials } from '../../lib/names'
import { candidatesKey } from './courseCache'
import { CheckIcon } from './icons'
import { useRefreshCourse } from './useCoursePage'

/** เวลารอหลังหยุดพิมพ์ก่อนค้นหา (มิลลิวินาที) */
const SEARCH_DELAY_MS = 300
/** จำนวนตัวอักษรขั้นต่ำ / สูงสุดของคำค้น (ตรงกับ backend) */
const MIN_SEARCH = 2
const MAX_SEARCH = 100

type AddBySearchProps = {
  course: Course
  /** แท็บนี้เปิดอยู่หรือไม่ (ปิดอยู่ = ไม่แสดง แต่คำค้นยังอยู่) */
  active: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onDone: () => void
}

export function AddBySearch({ course, active, inputRef, onDone }: AddBySearchProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const hintId = useId()
  const refresh = useRefreshCourse(course.id)
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  // คนที่เพิ่มในหน้าต่างนี้แล้ว (แสดงป้าย "เพิ่มแล้ว" แทนปุ่ม)
  const [addedIds, setAddedIds] = useState<number[]>([])
  const [addingId, setAddingId] = useState<number | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(text.trim()), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [text])

  const searching = term.length >= MIN_SEARCH
  const { data, isFetching, error: searchError } = useQuery({
    queryKey: [...candidatesKey(course.id), term],
    queryFn: () => searchCandidates(course.id, term),
    enabled: searching,
    placeholderData: keepPreviousData,
  })

  /** กด "เพิ่ม" / "เพิ่มกลับ" */
  async function add(candidate: Candidate) {
    setAddingId(candidate.id)
    setError(undefined)
    try {
      const result = await addStudents(course.id, [candidate.student_or_staff_id ?? candidate.email])
      const failed = result.failed[0]
      if (failed) {
        setError(t(`addStudents.failure.${failed.reason}`))
      } else if (result.already.length === 0) {
        setAddedIds((current) => [...current, candidate.id])
      }
      // มีคนอื่นเพิ่มไปก่อนแล้ว (already) → ไม่ขึ้น "เพิ่มแล้ว" ; ผลค้นหาที่โหลดใหม่ขึ้นป้าย "อยู่ในรายวิชาแล้ว" เอง
      await refresh()
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : 'unknown'))
      await refresh()
    } finally {
      setAddingId(null)
    }
  }

  if (!active) return null

  return (
    <>
      <DialogBody className="pt-3! lg:pt-[18px]!">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-[15px] font-semibold">
            {t('addStudents.searchLabel')}
          </label>
          <SearchInput
            ref={inputRef}
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby={hintId}
            autoComplete="off"
            maxLength={MAX_SEARCH}
            className="w-full"
          />
          <p id={hintId} className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
            {t('addStudents.searchHint')}
          </p>
        </div>

        {error && (
          <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
            {error}
          </p>
        )}
        {searchError && (
          <p role="alert" className="m-0 text-[14.5px] leading-[1.55] text-danger">
            {errorMessage(searchError instanceof ApiError ? searchError.code : 'unknown')}
          </p>
        )}

        {searching && data && data.length === 0 && !isFetching && (
          <p role="status" className="m-0 text-[15px] text-ink-muted">
            {t('addStudents.noResults')}
          </p>
        )}
        {searching && !data && isFetching && (
          <p role="status" className="m-0 text-[15px] text-ink-muted">
            {t('addStudents.searching')}
          </p>
        )}
        {searching && data && data.length > 0 && (
          <ul
            aria-label={t('addStudents.resultsLabel')}
            className="m-0 list-none divide-y divide-line-soft rounded-xl border border-line bg-surface p-0"
          >
            {data.map((candidate) => {
              const added = addedIds.includes(candidate.id)
              const dropped = candidate.enrollment_status === 'dropped' && !added
              return (
                <li key={candidate.id} className="flex items-center gap-3.5 px-4 py-3">
                  <div
                    aria-hidden="true"
                    className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-track font-display text-sm font-semibold text-brand"
                  >
                    {initials(candidate)}
                  </div>
                  <div className="min-w-0 grow">
                    <div className="font-semibold">
                      {candidate.first_name} {candidate.last_name}
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-[13.5px] leading-[1.6] wrap-anywhere text-ink-muted">
                      <span>{candidate.student_or_staff_id}</span>
                      <span>{candidate.email}</span>
                    </div>
                    {dropped && (
                      <div className="mt-0.5 text-[13.5px] leading-[1.55] text-ink-muted">
                        {t('addStudents.readdHint')}
                      </div>
                    )}
                  </div>
                  {added ? (
                    <StatusBadge tone="ok" icon={<CheckIcon />}>
                      {t('addStudents.addedFlag')}
                    </StatusBadge>
                  ) : candidate.enrollment_status === 'active' ? (
                    <StatusBadge tone="mute">{t('addStudents.inCourse')}</StatusBadge>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={addingId !== null}
                      onClick={() => void add(candidate)}
                      aria-label={t(dropped ? 'addStudents.readdLabel' : 'addStudents.addLabel', {
                        name: `${candidate.first_name} ${candidate.last_name}`,
                      })}
                      className="h-10!"
                    >
                      {dropped ? t('addStudents.readd') : t('addStudents.add')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DialogBody>
      <DialogFooter mobileColumns="grid-cols-1">
        <Button onClick={onDone}>{t('addStudents.done')}</Button>
      </DialogFooter>
    </>
  )
}
