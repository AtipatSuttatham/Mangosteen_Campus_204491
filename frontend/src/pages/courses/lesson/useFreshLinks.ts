/**
 * ลิงก์ไฟล์ที่ยังใช้ได้ (ขั้น 4.7 ก — ผู้ใช้เลือกแบบ ขง1)
 *
 * ทำไมต้องมี: ตอน deploy ลิงก์ไฟล์ (`file_link` / `download_link`) เป็นลิงก์ชั่วคราวของ B2 ใช้ได้ราว 1 ชั่วโมง (กค1)
 * และระบบไม่โหลดข้อมูลใหม่เองเมื่อกลับมาที่แท็บ (refetchOnWindowFocus: false) — ผู้เรียนที่เปิดหน้าทิ้งไว้นาน
 * จะกด "ดาวน์โหลด" แล้วได้หน้า error ของ B2 หรือวิดีโอโหลดต่อไม่ได้
 *
 * วิธีแก้ (ขอลิงก์ใหม่เฉพาะเมื่อจำเป็น — ไม่โหลดใหม่ตามเวลา เพราะวิดีโอที่กำลังเล่นจะถูกเปลี่ยนลิงก์กลางคัน):
 * - ปุ่ม เปิด / ดาวน์โหลด ถามก่อนว่าข้อมูลเก่ากว่า 50 นาทีไหม (`isStale`) ถ้าใช่ขอรายการใหม่ก่อน (`refresh`)
 * - ตัวเล่นวิดีโอ / เสียง / รูป โหลดไม่ได้ → ขอรายการใหม่ 1 ครั้งแล้วใช้ลิงก์ใหม่ (MediaBox / LessonMedia)
 * - ขอซ้อนกันหลายจุดพร้อมกัน (เช่น วิดีโอ 3 ตัว error พร้อมกัน) → ส่งคำขอจริงครั้งเดียว ทุกจุดรอผลเดียวกัน
 * - ระหว่างหน้ากำลังโหลดรายการอยู่แล้ว → รอผลนั้น ไม่ยกเลิกแล้วส่งใหม่
 *
 * ส่วนแสดงผลรับค่าผ่าน context — หน้าผู้เรียนกับแท็บผู้สอน (ขั้น 4.7 ข) ต่อกับแคชของตัวเองได้โดยไม่แก้ส่วนแสดงผล
 * ไม่มี provider (เช่นใน test ที่ไม่สนใจเรื่องนี้) = ลิงก์ไม่หมดอายุ และขอใหม่ไม่ได้
 */
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef } from 'react'
import type { StudentContent } from '../../../api/content'

/** ข้อมูลเก่ากว่านี้ถือว่าลิงก์อาจหมดอายุแล้ว (ลิงก์ของ B2 อายุราว 60 นาที — เผื่อเวลาเดินทาง / นาฬิกาเพี้ยน) */
export const LINK_FRESH_MS = 50 * 60 * 1000

/** หาเนื้อหาจากรหัส (ในข้อมูลชุดใหม่) ; ไม่พบ = ถูกลบ / ยกเลิกเผยแพร่ไปแล้ว */
export type ContentLookup = (contentId: number) => StudentContent | undefined

export type FreshLinks = {
  /** ข้อมูลที่ถืออยู่เก่าจนลิงก์อาจหมดอายุแล้วไหม */
  isStale: () => boolean
  /** ขอรายการใหม่จาก backend → ตัวหาเนื้อหาในข้อมูลชุดใหม่ ; ไม่สำเร็จ = null */
  refresh: () => Promise<ContentLookup | null>
}

/** ค่าเมื่อไม่มี provider: ไม่หมดอายุ ขอใหม่ไม่ได้ */
const NO_REFRESH: FreshLinks = { isStale: () => false, refresh: () => Promise.resolve(null) }

export const FreshLinksContext = createContext<FreshLinks>(NO_REFRESH)

/** ส่วนแสดงผลเรียกใช้ */
export function useLinks(): FreshLinks {
  return useContext(FreshLinksContext)
}

type Source<T> = {
  /** เวลาที่ได้ข้อมูลชุดปัจจุบัน (ms — `dataUpdatedAt` ของ useQuery) */
  updatedAt: number
  /** ขอข้อมูลใหม่ (`refetch` ของ useQuery) */
  refetch: (options?: { cancelRefetch?: boolean }) => Promise<{ data?: T; isError: boolean }>
  /** ดึงเนื้อหาทุกชิ้นออกจากข้อมูล (หน่วย → เนื้อหา) */
  contentsOf: (data: T) => StudentContent[]
}

/** สร้างค่าให้ FreshLinksContext จาก useQuery ของหน้า */
export function useFreshLinks<T>({ updatedAt, refetch, contentsOf }: Source<T>): FreshLinks {
  // คำขอที่กำลังรอผล — ใช้ร่วมกันทุกจุดที่ขอพร้อมกัน
  const pendingRef = useRef<Promise<ContentLookup | null> | null>(null)
  // อ่านค่าล่าสุดเสมอ (ฟังก์ชันที่คืนไปถูกเรียกทีหลังได้ เช่น หลังวิดีโอ error)
  const sourceRef = useRef({ updatedAt, refetch, contentsOf })
  useLayoutEffect(() => {
    sourceRef.current = { updatedAt, refetch, contentsOf }
  })

  const isStale = useCallback(() => Date.now() - sourceRef.current.updatedAt > LINK_FRESH_MS, [])

  const refresh = useCallback(() => {
    if (!pendingRef.current) {
      const { refetch: run, contentsOf: pick } = sourceRef.current
      // cancelRefetch: false — กำลังโหลดอยู่แล้ว (เช่น หลังกดเลื่อน / เผยแพร่) → รอผลนั้นแทนการยกเลิกแล้วส่งใหม่
      // (ค่าเริ่มต้นของ TanStack ยกเลิกคำขอเดิม: ส่งคำขอเกิน และปุ่มที่รอผลคำขอเดิมกลับมากดได้ก่อนข้อมูลใหม่มาถึง
      //  — แก้หลังตรวจขั้น 4.7) ; ข้อมูลที่ได้จากการโหลดที่ทำอยู่เป็นชุดใหม่ ลิงก์จึงใช้ได้เหมือนกัน
      pendingRef.current = run({ cancelRefetch: false })
        .then((result): ContentLookup | null => {
          if (result.isError || !result.data) return null
          const byId = new Map(pick(result.data).map((content) => [content.id, content]))
          return (contentId) => byId.get(contentId)
        })
        .catch(() => null)
        .finally(() => {
          pendingRef.current = null
        })
    }
    return pendingRef.current
  }, [])

  return useMemo(() => ({ isStale, refresh }), [isStale, refresh])
}
