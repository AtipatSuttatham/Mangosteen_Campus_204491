/**
 * หน้านำเข้าผู้ใช้จาก CSV /users/import (UC-04 — ขั้น 2.7) เฉพาะผู้ดูแลระบบ
 * หน้าตาตาม board "นำเข้า CSV" 4 board ใน design canvas (ผู้ใช้อนุมัติ 2026-10-12) ; มือถือใช้ได้ (ข้อ 3.ก)
 *
 *   ‹ จัดการบัญชีผู้ใช้
 *   นำเข้าผู้ใช้จาก CSV
 *   (1) เลือกไฟล์ ── (2) ตรวจข้อมูล ── (3) รับรหัสผ่าน
 *   [เนื้อหาของขั้นปัจจุบัน]
 *
 * ลำดับ (docs/api.md §7.4):
 *   ① เลือกไฟล์ → หน้าเว็บตรวจนามสกุล/ขนาดก่อน → POST import/validate/ (ยังไม่สร้าง)
 *        ไฟล์ผิดทั้งไฟล์ (อ่านไม่ออก / ขาดคอลัมน์ …) → อยู่ขั้น ① พร้อมข้อความ
 *   ② รายงาน: มีแถวผิด → ตารางปัญหา ; ถูกทุกแถว → สรุป + ตัวอย่าง → "นำเข้า N บัญชี"
 *        → ส่ง**ไฟล์เดิมซ้ำ**ไป POST import/ (server ตรวจใหม่แล้วสร้างทั้งไฟล์)
 *        มีคนเพิ่มข้อมูลซ้ำแทรกระหว่างตรวจกับนำเข้า (csv_invalid) → กลับไปตารางปัญหาพร้อมข้อความ
 *   ③ ผลการนำเข้า + ดาวน์โหลดไฟล์รหัสผ่าน (รหัสอยู่ในหน่วยความจำของหน้านี้เท่านั้น)
 *        ยังไม่ดาวน์โหลดแล้วจะออก (เมนู / ย้อนกลับ / ลิงก์ / ออกจากระบบ / ปิดแท็บ) → ถามยืนยันก่อน
 *        (useLeaveGuard — ผู้ใช้เลือกข้อ 2.ก)
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  csvInvalidReport,
  importUsers,
  validateUserImport,
  type CsvReport,
  type ImportResult,
} from '../../../../api/adminUsers'
import { ApiError } from '../../../../api/client'
import { errorMessage } from '../../../../api/errors'
import { ConfirmDialog } from '../../../../components/ui'
import { downloadCsv, passwordCsv, passwordFileName } from '../../../../lib/csvFiles'
import { useLeaveGuard } from '../../../../lib/useLeaveGuard'
import { BackIcon } from '../icons'
import { DoneStep } from './DoneStep'
import { ImportStepper } from './ImportStepper'
import { ReviewStep } from './ReviewStep'
import { UploadStep } from './UploadStep'

/** ขนาดไฟล์สูงสุด (เท่ากับ backend — csv_too_large) */
const MAX_FILE_BYTES = 1024 * 1024

/** สถานะของหน้า: อยู่ขั้นไหน + ข้อมูลของขั้นนั้น */
type PageState =
  | { step: 'upload'; checkingName: string | null; error?: string }
  | { step: 'review'; file: File; report: CsvReport; importing: boolean; notice?: string }
  | { step: 'done'; file: File; result: ImportResult; downloaded: boolean }

/** ข้อความไทยของ error (ห้ามแสดง detail — ใช้รหัสเสมอ) */
const messageOf = (caught: unknown) => errorMessage(caught instanceof ApiError ? caught.code : 'unknown')

export default function CsvImportPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [state, setState] = useState<PageState>({ step: 'upload', checkingName: null })
  // นำเข้าแล้วแต่ยังไม่ดาวน์โหลดไฟล์รหัสผ่าน = ออกแล้วรหัสหาย → เฝ้าประตู
  const leave = useLeaveGuard(state.step === 'done' && !state.downloaded)

  /** ① ได้ไฟล์ → ตรวจในหน้าเว็บก่อน แล้วส่งให้ backend ตรวจ */
  async function checkFile(file: File) {
    if (!/\.csv$/i.test(file.name)) {
      setState({ step: 'upload', checkingName: null, error: t('csvImport.notCsv') })
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setState({ step: 'upload', checkingName: null, error: errorMessage('csv_too_large') })
      return
    }
    setState({ step: 'upload', checkingName: file.name })
    try {
      const report = await validateUserImport(file)
      setState({ step: 'review', file, report, importing: false })
    } catch (caught) {
      setState({ step: 'upload', checkingName: null, error: messageOf(caught) })
    }
  }

  /** ② กด "นำเข้า N บัญชี" → ส่งไฟล์เดิมซ้ำ */
  async function runImport() {
    if (state.step !== 'review') return
    const { file, report } = state
    setState({ ...state, importing: true, notice: undefined })
    try {
      const result = await importUsers(file)
      // รายชื่อในหน้า /users โหลดใหม่ (บัญชีใหม่ขึ้นทันทีเมื่อกลับไป)
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setState({ step: 'done', file, result, downloaded: false })
    } catch (caught) {
      const newReport = csvInvalidReport(caught)
      setState(
        newReport
          ? // ข้อมูลในระบบเปลี่ยนระหว่างตรวจกับนำเข้า → แสดงรายงานใหม่ (ไม่มีบัญชีใดถูกสร้าง)
            { step: 'review', file, report: newReport, importing: false, notice: t('csvImport.changedSinceCheck') }
          : { step: 'review', file, report, importing: false, notice: messageOf(caught) },
      )
    }
  }

  /** ③ ดาวน์โหลดไฟล์รหัสผ่าน (สร้างในหน้าเว็บ) */
  function downloadPasswords() {
    if (state.step !== 'done') return
    downloadCsv(
      passwordFileName(state.file.name, t('csvImport.passwordFileSuffix')),
      passwordCsv(state.result.users),
    )
    setState({ ...state, downloaded: true })
  }

  const chooseAgain = () => setState({ step: 'upload', checkingName: null })
  const currentStep = state.step === 'upload' ? 1 : state.step === 'review' ? 2 : 3

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-col gap-4 lg:gap-[22px]">
        <div>
          <Link
            to="/users"
            className="-ml-1 inline-flex items-center gap-1 text-[14.5px] font-semibold no-underline"
          >
            <BackIcon />
            {t('csvImport.back')}
          </Link>
          <h1 className="m-0 mt-1.5 font-display text-[26px] leading-[1.35] font-semibold lg:text-[32px]">
            {t('csvImport.title')}
          </h1>
        </div>
        <ImportStepper current={currentStep} />
      </div>

      {state.step === 'upload' && (
        <UploadStep
          onFile={(file) => void checkFile(file)}
          checkingName={state.checkingName}
          error={state.error}
        />
      )}
      {state.step === 'review' && (
        <ReviewStep
          fileName={state.file.name}
          report={state.report}
          onChooseAgain={chooseAgain}
          onImport={() => void runImport()}
          importing={state.importing}
          notice={state.notice}
        />
      )}
      {state.step === 'done' && (
        <DoneStep
          fileName={state.file.name}
          result={state.result}
          downloaded={state.downloaded}
          onDownload={downloadPasswords}
        />
      )}

      {/* จะออกก่อนดาวน์โหลด → ถามยืนยัน (โฟกัส "อยู่ต่อ" ก่อน) */}
      {leave.asking && (
        <ConfirmDialog
          title={t('csvImport.leaveTitle')}
          description={[t('csvImport.downloadWarningBody')]}
          confirmLabel={t('csvImport.leaveConfirm')}
          cancelLabel={t('csvImport.leaveStay')}
          onConfirm={leave.proceed}
          onCancel={leave.stay}
        />
      )}
    </div>
  )
}
