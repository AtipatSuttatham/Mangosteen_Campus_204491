/**
 * test ของ Markdown (ขั้น 3.7): แสดงรูปแบบพื้นฐาน + ปลอดภัยกับข้อความที่ผู้ใช้กรอก
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('แสดงตัวหนา รายการ และหัวข้อ (หัวข้อ # ลดเป็น h3 ไม่แทรกลำดับหัวข้อของหน้า)', () => {
    render(<Markdown text={'# หัวข้อ\n\nข้อความ **สำคัญ**\n\n- ข้อ 1\n- ข้อ 2'} />)

    expect(screen.getByRole('heading', { level: 3, name: 'หัวข้อ' })).toBeInTheDocument()
    expect(screen.getByText('สำคัญ').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('ไม่แสดง HTML ดิบ (script / img onerror ไม่ถูกสร้าง)', () => {
    const { container } = render(
      <Markdown text={'ก่อน <script>alert(1)</script> <img src=x onerror="alert(2)"> หลัง'} />,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('ก่อน')
    expect(container).toHaveTextContent('หลัง')
  })

  it('ลิงก์ปกติเปิดแท็บใหม่ ; ลิงก์ javascript: ถูกล้าง', () => {
    render(<Markdown text={'[เว็บ](https://example.com) [อันตราย](javascript:alert(1))'} />)

    const safe = screen.getByRole('link', { name: 'เว็บ' })
    expect(safe).toHaveAttribute('href', 'https://example.com')
    expect(safe).toHaveAttribute('target', '_blank')
    expect(safe).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('อันตราย').closest('a')?.getAttribute('href') ?? '').not.toMatch(/javascript/i)
  })

  it('บล็อกโค้ด: โค้ดข้างในไม่มีระยะ / พื้นของโค้ดในบรรทัด (บรรทัดแรกไม่ถูกดันเข้า — ขั้น 4.7)', () => {
    const { container } = render(<Markdown text={'ใช้ `print` แบบนี้\n\n```\nscore = 72\n```'} />)

    const block = container.querySelector('pre')!
    expect(block.className).toMatch(/\[&>code\]:p-0/)
    expect(block.className).toMatch(/\[&>code\]:bg-transparent/)
    expect(block.querySelector('code')).toHaveTextContent('score = 72')
    // โค้ดในบรรทัดยังมีพื้นตามเดิม
    expect(screen.getByText('print')).toHaveClass('bg-canvas')
  })

  it('headingLevel: # / ## ใช้ระดับที่กำหนด และ ### ลงไปเป็นระดับถัดไป (ไม่เกิน h6)', () => {
    render(<Markdown text={'# ใหญ่\n\n### เล็ก'} headingLevel={5} />)

    expect(screen.getByRole('heading', { name: 'ใหญ่' }).tagName).toBe('H5')
    expect(screen.getByRole('heading', { name: 'เล็ก' }).tagName).toBe('H6')
  })
})
