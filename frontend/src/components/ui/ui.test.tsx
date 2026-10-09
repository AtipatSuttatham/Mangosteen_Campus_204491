/**
 * test ของคอมโพเนนต์พื้นฐาน (Button / TextField / Card / StatusBadge / Logo)
 * ตรวจพฤติกรรมและการเข้าถึง (โปรแกรมอ่านหน้าจอ / แป้นพิมพ์) — หน้าตาตรวจด้วยตาที่หน้า /dev/components
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, Card, Logo, StatusBadge, TextField } from './index'

describe('Button', () => {
  it('ค่าเริ่มต้นเป็นปุ่มแบบ primary และ type="button" (ไม่ส่งฟอร์มโดยไม่ตั้งใจ)', () => {
    render(<Button>บันทึก</Button>)

    const button = screen.getByRole('button', { name: 'บันทึก' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toContain('bg-brand')
  })

  it('แต่ละแบบใช้สีตาม canvas', () => {
    render(
      <>
        <Button variant="secondary">ยกเลิก</Button>
        <Button variant="text">แก้ไข</Button>
        <Button variant="danger-text">ระงับ</Button>
      </>,
    )

    expect(screen.getByRole('button', { name: 'ยกเลิก' }).className).toContain('border-line-strong')
    expect(screen.getByRole('button', { name: 'แก้ไข' }).className).toContain('text-brand')
    expect(screen.getByRole('button', { name: 'ระงับ' }).className).toContain('text-bad')
  })

  it('กดแล้วเรียก onClick ; ถ้า disabled กดไม่ได้', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onLocked = vi.fn()
    render(
      <>
        <Button onClick={onSave}>บันทึก</Button>
        <Button onClick={onLocked} disabled>
          ล็อก
        </Button>
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await user.click(screen.getByRole('button', { name: 'ล็อก' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onLocked).not.toHaveBeenCalled()
  })
})

describe('TextField', () => {
  it('ป้ายชื่อผูกกับช่องกรอก (หาช่องจากชื่อป้ายได้) และพิมพ์ได้', async () => {
    const user = userEvent.setup()
    render(<TextField label="รหัสผ่าน" type="password" />)

    const input = screen.getByLabelText('รหัสผ่าน')
    await user.type(input, 'secret')

    expect(input).toHaveValue('secret')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('มี error → ขอบแดง, aria-invalid, ข้อความ error ผูกกับช่อง และถูกประกาศ (role=alert)', () => {
    render(<TextField label="อีเมล" error="รูปแบบไม่ถูกต้อง" />)

    const input = screen.getByLabelText('อีเมล')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('รูปแบบไม่ถูกต้อง')
    expect(input.className).toContain('border-danger')
    expect(screen.getByRole('alert')).toHaveTextContent('รูปแบบไม่ถูกต้อง')
  })

  it('หลายช่องในหน้าเดียวได้รหัสไม่ซ้ำกัน', () => {
    render(
      <>
        <TextField label="ชื่อ" />
        <TextField label="นามสกุล" />
      </>,
    )

    expect(screen.getByLabelText('ชื่อ').id).not.toBe(screen.getByLabelText('นามสกุล').id)
  })
})

describe('Card', () => {
  it('เป็น div ตามค่าเริ่มต้น หรือ element อื่นที่กำหนด', () => {
    render(
      <>
        <Card data-testid="plain">เนื้อหา</Card>
        <Card as="form" aria-label="ฟอร์มตัวอย่าง" />
      </>,
    )

    expect(screen.getByTestId('plain').tagName).toBe('DIV')
    expect(screen.getByTestId('plain').className).toContain('rounded-card')
    expect(screen.getByRole('form', { name: 'ฟอร์มตัวอย่าง' }).tagName).toBe('FORM')
  })
})

describe('StatusBadge', () => {
  it.each([
    ['warn', 'bg-warn-soft'],
    ['ok', 'bg-ok-soft'],
    ['bad', 'bg-bad-soft'],
    ['mute', 'bg-mute-soft'],
  ] as const)('สี %s ใช้พื้น %s', (tone, expected) => {
    render(<StatusBadge tone={tone}>สถานะ</StatusBadge>)

    const badge = screen.getByText('สถานะ')
    expect(badge).toHaveAttribute('data-tone', tone)
    expect(badge.className).toContain(expected)
  })
})

describe('Logo', () => {
  it('ไม่มีชื่อระบบ → ตรามีชื่อเรียกสำหรับโปรแกรมอ่านหน้าจอ', () => {
    render(<Logo />)

    expect(screen.getByRole('img', { name: 'Mangosteen Campus' })).toBeInTheDocument()
  })

  it('มีชื่อระบบ → แสดงชื่อ และตราเป็นการตกแต่ง (ไม่อ่านซ้ำ)', () => {
    render(<Logo withWordmark />)

    expect(screen.getByText('Mangosteen Campus')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('หลายโลโก้ในหน้าเดียว → mask ไม่ชนกัน (รหัสไม่ซ้ำ)', () => {
    const { container } = render(
      <>
        <Logo size={34} />
        <Logo />
      </>,
    )

    const ids = [...container.querySelectorAll('mask')].map((mask) => mask.id)
    expect(ids).toHaveLength(6)
    expect(new Set(ids).size).toBe(6)
  })
})
