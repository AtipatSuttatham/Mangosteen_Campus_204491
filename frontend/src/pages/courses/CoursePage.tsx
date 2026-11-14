/**
 * หน้ารายวิชาของผู้สอน /courses/:courseId (UC-07, UC-08 — ขั้น 3.6)
 * หน้าตาตาม board "หน้ารายวิชา แท็บผู้เรียน" และ "แท็บตั้งค่า" แถวก้อน 3 ใน design canvas
 *
 *   ‹ รายวิชาของฉัน
 *   ┌ หัวรายวิชา (CourseHeader) ───────────────────────────┐
 *   │ [204111] Python พื้นฐาน [เผยแพร่แล้ว]    รหัสเข้าร่วม … │
 *   │ ผู้เรียน 42 │ ตั้งค่า                                    │
 *   └──────────────────────────────────────────────────┘
 *   ✓ แถบข้อความหลังทำรายการ
 *   <แท็บที่เปิดอยู่>   ← StudentsTab / SettingsTab แสดงตรง <Outlet />
 *
 * - ข้อมูลวิชาโหลดที่นี่จุดเดียว แล้วส่งให้แท็บผ่าน useCoursePage()
 * - ไม่มีวิชานี้ หรือไม่มีสิทธิ์ → backend ตอบ 404 เหมือนกัน → "ไม่พบรายวิชา" (ไม่บอกว่าวิชามีอยู่จริงไหม)
 * - ผู้ดูแลระบบ (ขั้น 3.8): หน้าเดียวกับผู้สอน ทำแทนได้ทุกอย่าง + แถบส้ม "กำลังจัดการแทนผู้สอน" เหนือปุ่มกลับ
 *   (ตาม board) ; ปุ่มกลับไป "จัดการรายวิชา"
 */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { fetchCourse } from '../../api/courses'
import { errorMessage } from '../../api/errors'
import { Button, Card } from '../../components/ui'
import { ManagingBanner, Notice, StateMessage, type NoticeValue } from './courseBits'
import { courseKey } from './courseCache'
import { CourseHeader } from './CourseHeader'
import { BackIcon } from './icons'
import type { CoursePageContext } from './useCoursePage'

/** isAdmin: ผู้ดูแลระบบจัดการแทนผู้สอน (CourseRoutes ส่งมาจากบทบาทของผู้ที่เข้าสู่ระบบ — ขั้น 3.8) */
export default function CoursePage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useTranslation()
  const { courseId } = useParams()
  const id = Number(courseId)
  const validId = Number.isInteger(id) && id > 0
  const { pathname } = useLocation()

  // แถบข้อความใต้หัวรายวิชา — อยู่จนกว่าจะมีข้อความใหม่หรือเปลี่ยนแท็บ
  const [notice, setNotice] = useState<NoticeValue | null>(null)
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setNotice(null)
  }

  const { data, error, isPending, refetch } = useQuery({
    queryKey: courseKey(id),
    queryFn: () => fetchCourse(id),
    enabled: validId,
  })

  const notFound = !validId || (error instanceof ApiError && error.status === 404)
  const context: CoursePageContext | null = data ? { course: data, isAdmin, notify: setNotice } : null

  return (
    <div className="flex flex-col gap-3.5 lg:gap-[18px]">
      {/* แถบส้ม: แสดงตั้งแต่กำลังโหลด (ปุ่มกลับไม่กระโดดลงตอนข้อมูลมา) ;
          ไม่พบรายวิชา / โหลดไม่สำเร็จ = ไม่มีอะไรให้จัดการแทน จึงไม่แสดง */}
      {isAdmin && !notFound && (isPending || data) && (
        <ManagingBanner>{t('coursePage.managingBanner')}</ManagingBanner>
      )}
      <Link
        to="/courses"
        className={
          '-ml-1.5 inline-flex h-9 w-fit items-center gap-1 rounded-control px-1.5 text-[14.5px] font-semibold ' +
          'text-brand no-underline hover:bg-track focus-visible:outline-2 focus-visible:outline-accent'
        }
      >
        <BackIcon />
        {isAdmin ? t('coursePage.backAdmin') : t('coursePage.back')}
      </Link>

      {notFound ? (
        <Card>
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-display text-xl font-semibold text-ink">{t('coursePage.notFoundTitle')}</p>
              <p className="m-0 mt-1">{t('coursePage.notFoundBody')}</p>
            </div>
          </StateMessage>
        </Card>
      ) : isPending ? (
        <Card>
          <StateMessage>
            <p className="m-0" role="status">
              {t('coursePage.loading')}
            </p>
          </StateMessage>
        </Card>
      ) : !context ? (
        <Card>
          <StateMessage>
            <div role="alert">
              <p className="m-0 font-semibold text-ink">{t('coursePage.loadFailed')}</p>
              <p className="m-0">{errorMessage(error instanceof ApiError ? error.code : 'unknown')}</p>
            </div>
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('coursePage.retry')}
            </Button>
          </StateMessage>
        </Card>
      ) : (
        <>
          <CourseHeader course={context.course} />
          {notice && <Notice notice={notice} />}
          {/* key = รหัสวิชา: เปลี่ยนวิชาโดยตรง (ย้อนกลับ / พิมพ์ที่อยู่ ขณะข้อมูลวิชาใหม่อยู่ในแคช) → แท็บถูกสร้างใหม่
              ค่าที่ค้างในแท็บ (ผู้สอนที่เลือกไว้, ป้ายผลลัพธ์, ฟอร์ม) จึงไม่ติดไปวิชาอื่น */}
          <Outlet key={context.course.id} context={context} />
        </>
      )}
    </div>
  )
}
