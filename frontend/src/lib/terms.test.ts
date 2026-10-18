/**
 * test ของตัวช่วยปีการศึกษา / ภาคเรียน (lib/terms.ts — ขั้น 3.5)
 */
import { describe, expect, it } from 'vitest'
import { currentTerm, groupByTerm, termKey } from './terms'

describe('currentTerm — ภาคเรียนปัจจุบันตามปฏิทินไทย (ปีการศึกษาเริ่ม มิ.ย.)', () => {
  it.each([
    ['2026-06-01T03:00:00Z', 2569, 1],
    ['2026-10-18T03:00:00Z', 2569, 1],
    ['2026-11-02T03:00:00Z', 2569, 2],
    ['2027-02-15T03:00:00Z', 2569, 2],
    ['2027-04-20T03:00:00Z', 2569, 3],
    ['2027-06-10T03:00:00Z', 2570, 1],
  ])('%s → ปี %i ภาค %i', (iso, year, semester) => {
    expect(currentTerm(new Date(iso))).toEqual({ academic_year: year, semester })
  })

  it('ใช้เวลาประเทศไทย: 31 พ.ค. 17:30 UTC = 1 มิ.ย. เวลาไทย → ภาค 1', () => {
    expect(currentTerm(new Date('2026-05-31T17:30:00Z'))).toEqual({
      academic_year: 2569,
      semester: 1,
    })
  })
})

describe('groupByTerm', () => {
  it('จัดกลุ่มตามภาค โดยคงลำดับเดิม (ภาคล่าสุดก่อน)', () => {
    const items = [
      { id: 1, academic_year: 2569, semester: 1 as const },
      { id: 2, academic_year: 2569, semester: 1 as const },
      { id: 3, academic_year: 2568, semester: 2 as const },
    ]

    const groups = groupByTerm(items)

    expect(groups.map((group) => group.key)).toEqual(['2569-1', '2568-2'])
    expect(groups[0]?.items.map((item) => item.id)).toEqual([1, 2])
    expect(groups[1]?.term).toEqual({ academic_year: 2568, semester: 2 })
  })

  it('ไม่มีรายการ → ไม่มีกลุ่ม', () => {
    expect(groupByTerm([])).toEqual([])
  })

  it('termKey', () => {
    expect(termKey({ academic_year: 2569, semester: 3 })).toBe('2569-3')
  })
})
