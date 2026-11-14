/**
 * แท็บตั้งค่าของหน้ารายวิชา (UC-07 — ขั้น 3.6 ; ผู้ดูแลระบบขั้น 3.8) ตาม board "แท็บตั้งค่า" + "ยืนยันปิดรายวิชา" + มือถือ
 *
 * ไฟล์นี้เป็น "สารบัญ" ของแท็บ: บอกว่ามีส่วนอะไร แสดงเมื่อไร เรียงลำดับอย่างไร
 * เนื้อหาของแต่ละส่วนอยู่ในโฟลเดอร์ settings/ (แยกออกในรอบปรับโครงสร้างหลังขั้น 3.8 — เดิมไฟล์เดียว 668 บรรทัด)
 *
 *   ส่วน                    ไฟล์                              แสดงเมื่อ
 *   กล่อง "ปิดรายวิชาแล้ว"   settings/CourseStatusSection.tsx   ผู้สอน + วิชาปิดแล้ว
 *   สถานะรายวิชา (เปิดคืน)  settings/CourseStatusSection.tsx   ผู้ดูแลระบบ + วิชาปิดแล้ว
 *   ผู้สอน (เปลี่ยนผู้สอน)   settings/TeacherSection.tsx        ผู้ดูแลระบบ
 *   ข้อมูลรายวิชา           settings/CourseInfoSection.tsx     เสมอ (วิชาปิดแล้วดูได้อย่างเดียว)
 *   การเผยแพร่              settings/PublishSection.tsx        วิชายังไม่ปิด
 *   รหัสเข้าร่วม             settings/JoinCodeSection.tsx       วิชายังไม่ปิด
 *   ปิด / ลบรายวิชา (แดง)   settings/DangerSection.tsx         วิชายังไม่ปิด และ เผยแพร่แล้ว (ปิด) หรือ ลบได้ (ลบ)
 *
 * ลำดับบนจอ:
 *   จอใหญ่ (ตาม board ผู้ดูแลระบบ): สถานะรายวิชา → ผู้สอน → ข้อมูลรายวิชา → การเผยแพร่ → รหัสเข้าร่วม
 *     อยู่ในการ์ดเดียว คั่นด้วยเส้น ; ปิด / ลบ เป็นการ์ดขอบแดงแยกด้านล่าง
 *   มือถือ (ตาม board มือถือ): การ์ดแยกกัน เรียงด้วยคลาส order-* :
 *     สถานะรายวิชา (first) → การเผยแพร่ (1) → รหัสเข้าร่วม (2) → ผู้สอน, ข้อมูลรายวิชา (3 — เท่ากัน เรียงตามโค้ด)
 *
 * กติกาของปุ่ม (ล็อกปุ่มร่วมกัน / ผลขึ้นในส่วนที่กด / ยืนยันก่อนหรือทำทันที) อยู่ใน settings/useSettingsActions.ts
 */
import { CourseInfoSection } from './settings/CourseInfoSection'
import { ClosedSummary, CourseStatusSection } from './settings/CourseStatusSection'
import { DangerSection } from './settings/DangerSection'
import { JoinCodeSection } from './settings/JoinCodeSection'
import { PublishSection } from './settings/PublishSection'
import { TeacherSection } from './settings/TeacherSection'
import { useSettingsActions } from './settings/useSettingsActions'
import { useCoursePage } from './useCoursePage'

export default function SettingsTab() {
  const { course, isAdmin } = useCoursePage()
  // ล็อกปุ่ม + ป้ายผลล่าสุด ใช้ร่วมกันทุกส่วน
  const actions = useSettingsActions()
  const closed = course.is_closed

  return (
    <>
      {/* ผู้ดูแลระบบเห็นข้อมูลการปิดในส่วน "สถานะรายวิชา" แทน (พร้อมปุ่มเปิดคืน) */}
      {closed && !isAdmin && <ClosedSummary />}

      {/* จอใหญ่: การ์ดเดียว ส่วนต่าง ๆ คั่นด้วยเส้น ; มือถือ: การ์ดแยก เรียงตาม order */}
      <div className="flex flex-col gap-3 lg:gap-0 lg:divide-y lg:divide-line-soft lg:rounded-card lg:border lg:border-line lg:bg-surface">
        {isAdmin && closed && <CourseStatusSection actions={actions} className="order-first lg:order-none" />}
        {isAdmin && <TeacherSection actions={actions} className="order-3 lg:order-none" />}
        <CourseInfoSection className="order-3 lg:order-none" />
        {!closed && <PublishSection actions={actions} className="order-1 lg:order-none" />}
        {!closed && <JoinCodeSection actions={actions} className="order-2 lg:order-none" />}
      </div>

      {/* เผยแพร่แล้ว = ปิดรายวิชาได้ ; ลบได้ = ยังไม่เผยแพร่และไม่เคยมีผู้เรียน */}
      {!closed && (course.is_published || course.can_delete) && <DangerSection actions={actions} />}
    </>
  )
}
