/**
 * test ของคอมโพเนนต์พื้นฐานขั้น 3.5: ป้ายรหัสวิชา (CourseBadge) และส่วนที่พับ/เปิดได้ (Collapsible)
 * + ป้ายรหัสวิชาเมื่อรหัสยาว (ขั้น 3.6 รอบ 3)
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Collapsible } from './Collapsible'
import { CourseBadge } from './CourseBadge'
import { badgeFontSize, badgeLines } from './courseBadgeText'

describe('CourseBadge', () => {
  it.each(['published', 'draft', 'closed'] as const)('แสดงรหัสวิชาและบอกสถานะ %s', (state) => {
    const { container } = render(<CourseBadge code="204111" state={state} />)

    expect(screen.getByText('204111')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('data-state', state)
  })

  it('ลายกลีบเลี้ยงเฉพาะวิชาที่เผยแพร่ ; กุญแจเฉพาะวิชาที่ปิด (ยกเว้นขนาดเล็ก)', () => {
    const svgCount = (ui: React.ReactElement) => render(ui).container.querySelectorAll('svg').length

    expect(svgCount(<CourseBadge code="1" state="published" />)).toBe(1)
    expect(svgCount(<CourseBadge code="2" state="draft" />)).toBe(0)
    expect(svgCount(<CourseBadge code="3" state="closed" />)).toBe(1)
    expect(svgCount(<CourseBadge code="4" state="closed" size="sm" />)).toBe(0)
  })

  // ขั้น 3.6 รอบ 3 (แบบ ต1): รหัสยาวไม่ถูกตัดทิ้ง
  it('รหัสยาวแบ่ง 2 บรรทัด ตัวอักษรเล็กลง และชี้แล้วเห็นรหัสเต็ม', () => {
    const { container } = render(<CourseBadge code="CS204111-SEC001-2569" state="published" />)
    const badge = container.firstElementChild as HTMLElement

    expect(screen.getByText('CS204111-')).toBeInTheDocument()
    expect(screen.getByText('SEC001-2569')).toBeInTheDocument()
    expect(badge).toHaveAttribute('title', 'CS204111-SEC001-2569')
    expect(parseFloat(badge.style.fontSize)).toBeLessThan(16.5)
  })
})

describe('badgeLines / badgeFontSize', () => {
  it('ไม่เกิน 9 ตัวอยู่บรรทัดเดียว ; 6 ตัวใช้ขนาดเดิม ; 8 ตัวเล็กลง', () => {
    expect(badgeLines('204111')).toEqual(['204111'])
    expect(badgeLines('CS2041119')).toEqual(['CS2041119'])
    expect(badgeFontSize(['204111'], 'lg')).toBe(22)
    expect(badgeFontSize(['204111'], 'md')).toBe(16.5)
    expect(badgeFontSize(['CS204111'], 'md')).toBeLessThan(16.5)
  })

  it('10 ตัวขึ้นไป: ตัดที่ขีดใกล้กลาง ; ไม่มีขีดตัดครึ่ง ; ขีดไกลกลางเกินไปตัดครึ่ง', () => {
    expect(badgeLines('204111-SEC01')).toEqual(['204111-', 'SEC01'])
    expect(badgeLines('ABCDEFGHIJKL')).toEqual(['ABCDEF', 'GHIJKL'])
    expect(badgeLines('A-BCDEFGHIJKLMNOP')).toEqual(['A-BCDEFGH', 'IJKLMNOP'])
  })

  it('ตัวอักษรไม่เล็กกว่าขนาดเล็กสุดของแต่ละป้าย', () => {
    const lines = badgeLines('ABCDEFGHIJKLMNOPQRST')
    expect(badgeFontSize(lines, 'lg')).toBeGreaterThanOrEqual(12)
    expect(badgeFontSize(lines, 'md')).toBeGreaterThanOrEqual(9.5)
    expect(badgeFontSize(lines, 'sm')).toBeGreaterThanOrEqual(8.5)
  })
})

/** Collapsible ที่ถือสถานะเอง (เหมือนหน้าที่ใช้จริง) */
function Harness({ initiallyOpen }: { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <Collapsible title="ปีการศึกษา 2569 ภาคเรียนที่ 1" trailing="3 รายวิชา" open={open} onToggle={() => setOpen(!open)}>
      <p>เนื้อหาในกลุ่ม</p>
    </Collapsible>
  )
}

describe('Collapsible', () => {
  it('หัวเป็นปุ่มใน h2 ที่บอกสถานะ — กดแล้วพับ / เปิดเนื้อหา', async () => {
    const user = userEvent.setup()
    render(<Harness initiallyOpen />)
    const button = screen.getByRole('button', { name: /ปีการศึกษา 2569 ภาคเรียนที่ 1/ })

    expect(screen.getByRole('heading', { level: 2 })).toContainElement(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('เนื้อหาในกลุ่ม')).toBeInTheDocument()

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('เนื้อหาในกลุ่ม')).not.toBeInTheDocument()
  })

  it('ใช้แป้นพิมพ์ได้ (Tab แล้ว Enter) และข้อความท้ายหัวเป็นส่วนหนึ่งของชื่อปุ่ม', async () => {
    const user = userEvent.setup()
    render(<Harness initiallyOpen={false} />)

    await user.tab()
    await user.keyboard('{Enter}')

    const button = screen.getByRole('button', { name: /3 รายวิชา/ })
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('เนื้อหาในกลุ่ม')).toBeInTheDocument()
  })
})
