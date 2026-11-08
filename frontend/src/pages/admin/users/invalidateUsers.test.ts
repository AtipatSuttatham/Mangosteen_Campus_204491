/** test ของ invalidateUserLists: แก้บัญชีแล้วต้องล้างทั้งรายชื่อผู้ใช้และรายชื่อผู้สอนของหน้ารายวิชา (ขั้น 3.8 รอบเก็บงาน) */
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ADMIN_TEACHERS_KEY, ADMIN_TERMS_KEY } from '../../courses/adminCourseData'
import { invalidateUserLists } from './invalidateUsers'

describe('invalidateUserLists', () => {
  it('ล้างรายชื่อผู้ใช้ทุกหน้า + รายชื่อผู้สอน ; ไม่แตะข้อมูลอื่น', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['admin-users', { page: 2 }], { count: 0 })
    queryClient.setQueryData(ADMIN_TEACHERS_KEY, [])
    queryClient.setQueryData(ADMIN_TERMS_KEY, [])

    await invalidateUserLists(queryClient)

    const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated
    expect(invalidated(['admin-users', { page: 2 }])).toBe(true)
    expect(invalidated(ADMIN_TEACHERS_KEY)).toBe(true)
    expect(invalidated(ADMIN_TERMS_KEY)).toBe(false)
  })
})
