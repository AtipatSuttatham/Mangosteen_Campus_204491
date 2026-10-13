/**
 * หน้าจัดการบัญชีผู้ใช้ /users (UC-04 — ขั้น 2.5) เฉพาะผู้ดูแลระบบ
 * หน้าตาตาม board "รายชื่อผู้ใช้" + "รายชื่อผู้ใช้ (มือถือ)" ใน design canvas (ผู้ใช้อนุมัติ 2026-10-12)
 * แสดงภายในโครงหน้าจอ (AppShell) — sidebar / แถบมือถือ อยู่ที่โครง
 *
 *   จัดการบัญชีผู้ใช้
 *   ทั้งหมด 248 บัญชี
 *   ┌ การ์ด (จอใหญ่) ─────────────────────────────────────────────────────┐
 *   │ [ค้นหาชื่อ รหัส หรืออีเมล]  บทบาท [ทุกบทบาท ⌄]  สถานะ [ทุกสถานะ ⌄]   │  ← ตัวกรอง (UserFilterBar)
 *   │ ตาราง (UsersTable)                                                   │  ← มือถือ: การ์ดทีละคน (UsersCards)
 *   │ แสดง 1–20 จาก 248 บัญชี        [‹ ก่อนหน้า] หน้า 1 จาก 13 [ถัดไป ›] │  ← Pagination
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * ข้อมูล: GET /api/v1/admin/users/ ผ่าน TanStack Query ; ตัวกรองเก็บในที่อยู่ (useUserFilters)
 * ระหว่างโหลดหน้าถัดไปยังแสดงหน้าเดิมไว้ (ไม่กระพริบ)
 * ปุ่ม "เพิ่มผู้ใช้" (ขั้น 2.6) เปิดหน้าต่าง CreateUserDialog ; ปุ่ม "แก้ไข" ในแถว/การ์ด เปิด EditUserDialog ; ปุ่ม "นำเข้าจาก CSV" ยังไม่แสดง — มาในขั้น 2.7
 * (ผู้ใช้เลือกข้อ 1.ก ขั้น 2.5: แสดงเฉพาะสิ่งที่ทำงานได้แล้ว)
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ADMIN_USERS_PAGE_SIZE, fetchAdminUsers, type AdminUser } from '../../../api/adminUsers'
import { ApiError } from '../../../api/client'
import { errorMessage } from '../../../api/errors'
import { useAuth } from '../../../auth/AuthContext'
import { Button, Pagination } from '../../../components/ui'
import { CreateUserDialog } from './CreateUserDialog'
import { EditUserDialog } from './EditUserDialog'
import { PlusIcon } from './icons'
import { UserFilterBar } from './UserFilterBar'
import { UsersCards } from './UsersCards'
import { UsersTable } from './UsersTable'
import { useUserFilters } from './useUserFilters'

/** ตัวเลขแบบมีจุลภาคคั่นหลักพัน เช่น 1,248 */
const formatCount = (value: number) => value.toLocaleString('th-TH')

export default function UsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const { filters, isFiltered, changeFilters, changePage, clearFilters } = useUserFilters()
  // หัวข้อของหน้า — เลื่อนกลับมาที่นี่หลังเปลี่ยนหน้า (บนมือถือปุ่มเปลี่ยนหน้าอยู่ท้ายรายการ)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // หน้าต่างที่เปิดอยู่ (null = ไม่มี)
  const [dialog, setDialog] = useState<
    { type: 'create' } | { type: 'edit'; user: AdminUser } | null
  >(null)
  const closeDialog = () => setDialog(null)
  // ปุ่มในแต่ละแถว/การ์ด → เปิดหน้าต่างของบัญชีนั้น
  const rowActions = {
    onEdit: (user: AdminUser) => setDialog({ type: 'edit', user }),
  }

  const query = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => fetchAdminUsers(filters),
    // ระหว่างโหลดชุดใหม่ ยังแสดงชุดเดิม (ไม่กระพริบเป็นหน้าว่าง)
    placeholderData: keepPreviousData,
  })
  const { data, error, isPending, isFetching, refetch } = query

  // ขอหน้าที่ไม่มีอยู่ (เช่น ลิงก์เก่า ?page=99 หรือรายการหดลง) → backend ตอบ 404 → กลับไปหน้า 1
  const pageNotFound = error instanceof ApiError && error.status === 404 && filters.page > 1
  useEffect(() => {
    if (pageNotFound) changePage(1, { replace: true })
  }, [pageNotFound, changePage])

  const pageCount = data ? Math.max(1, Math.ceil(data.count / ADMIN_USERS_PAGE_SIZE)) : 1
  const firstIndex = (filters.page - 1) * ADMIN_USERS_PAGE_SIZE + 1

  /** เปลี่ยนหน้า แล้วเลื่อนกลับไปหัวหน้า */
  const goToPage = (page: number) => {
    changePage(page)
    headingRef.current?.scrollIntoView?.({ block: 'start' })
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-[18px]">
      {/* หัวหน้า: จอใหญ่ = หัวข้อซ้าย ปุ่มขวา ; มือถือ = ปุ่มอยู่ใต้หัวข้อ (ตาม board) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1 lg:gap-0">
          <h1
            ref={headingRef}
            className="m-0 scroll-mt-20 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]"
          >
            {t('adminUsers.title')}
          </h1>
          {/* จำนวนบัญชี: ไม่กรอง = "ทั้งหมด N บัญชี" ; กรองอยู่ = "พบ N บัญชี" (กันเข้าใจผิดว่าระบบมีแค่นั้น) */}
          <p className="m-0 min-h-[1.6em] text-sm leading-[1.6] text-ink-muted" aria-live="polite">
            {data &&
              t(isFiltered ? 'adminUsers.found' : 'adminUsers.total', {
                total: formatCount(data.count),
              })}
          </p>
        </div>
        {/* มือถือ: ปุ่มครึ่งแถว (อีกครึ่งเป็นที่ของ "นำเข้า CSV" ในขั้น 2.7) */}
        <div className="grid grid-cols-2 gap-2 lg:flex lg:gap-2.5">
          <Button onClick={() => setDialog({ type: 'create' })} className="px-3 lg:px-5">
            <PlusIcon />
            {t('adminUsers.addUser')}
          </Button>
        </div>
      </div>

      {/* จอใหญ่: ทั้งหมดอยู่ในการ์ดเดียว ; มือถือ: ตัวกรอง / รายการ / แถบเปลี่ยนหน้า วางเรียงกันเฉย ๆ */}
      <section
        aria-label={t('adminUsers.listLabel')}
        className="flex flex-col gap-4 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface"
      >
        <UserFilterBar filters={filters} onChange={changeFilters} />

        {isPending ? (
          <StateMessage>
            <p className="m-0" role="status">
              {t('adminUsers.loading')}
            </p>
          </StateMessage>
        ) : !data ? (
          // โหลดไม่สำเร็จ (และไม่มีข้อมูลเดิมให้แสดง) → บอกสาเหตุ + ปุ่มลองใหม่
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-semibold text-ink">{t('adminUsers.loadFailed')}</p>
              <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
            </div>
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('adminUsers.retry')}
            </Button>
          </StateMessage>
        ) : data.results.length === 0 ? (
          <StateMessage>
            <div>
              <p className="m-0 font-semibold text-ink">{t('adminUsers.empty')}</p>
              {isFiltered && <p className="m-0">{t('adminUsers.emptyHint')}</p>}
            </div>
            {isFiltered && (
              <Button variant="secondary" onClick={clearFilters}>
                {t('adminUsers.clearFilters')}
              </Button>
            )}
          </StateMessage>
        ) : (
          // aria-busy + จางลงเล็กน้อย ระหว่างโหลดหน้าถัดไป (ยังเห็นข้อมูลเดิม)
          <div
            aria-busy={isFetching || undefined}
            className={isFetching ? 'opacity-60 motion-safe:transition-opacity' : ''}
          >
            {/* จอใหญ่ = ตาราง ; จอเล็ก = การ์ด (สลับที่ 1024px — จุดเดียวกับ sidebar ↔ เมนูมือถือ) */}
            <UsersTable
              users={data.results}
              currentUserId={currentUser?.id ?? 0}
              actions={rowActions}
            />
            <UsersCards
              users={data.results}
              currentUserId={currentUser?.id ?? 0}
              actions={rowActions}
            />
          </div>
        )}

        {data && data.results.length > 0 && (
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={goToPage}
            summary={t('adminUsers.range', {
              from: formatCount(firstIndex),
              to: formatCount(firstIndex + data.results.length - 1),
              total: formatCount(data.count),
            })}
            className="lg:border-t lg:border-line lg:py-3 lg:pr-4 lg:pl-6"
          />
        )}
      </section>

      {dialog?.type === 'create' && <CreateUserDialog onClose={closeDialog} />}
      {dialog?.type === 'edit' && (
        <EditUserDialog
          user={dialog.user}
          isSelf={dialog.user.id === currentUser?.id}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

/** กล่องข้อความสถานะ (กำลังโหลด / ไม่พบ / ผิดพลาด) — มือถือเป็นการ์ดของตัวเอง จอใหญ่อยู่ในการ์ดใหญ่ */
function StateMessage({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        'flex flex-col items-start gap-4 rounded-card border border-line bg-surface px-5 py-8 ' +
        'text-[15px] leading-[1.6] text-ink-muted lg:rounded-none lg:border-0 lg:px-6 lg:py-12'
      }
    >
      {children}
    </div>
  )
}
