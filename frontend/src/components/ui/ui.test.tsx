/**
 * test ของคอมโพเนนต์พื้นฐาน (Button / TextField / PasswordField / Card / StatusBadge / Logo / Avatar)
 * ตรวจพฤติกรรมและการเข้าถึง (โปรแกรมอ่านหน้าจอ / แป้นพิมพ์) — หน้าตาตรวจด้วยตาที่หน้า /dev/components
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  Avatar,
  Button,
  buttonClassName,
  Card,
  Logo,
  PasswordField,
  StatusBadge,
  TextField,
} from './index'

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

describe('TextField — แบบ "กรอกผิด" หลายช่อง (ขั้น 1.5)', () => {
  it('invalid → ขอบแดง + aria-invalid โดยไม่มีข้อความของตัวเอง ; ผูกกับข้อความ error ภายนอกได้', () => {
    render(
      <>
        <TextField label="รหัส" invalid errorDescribedBy="shared-error" />
        <p id="shared-error">รหัสหรือรหัสผ่านไม่ถูกต้อง</p>
      </>,
    )

    const input = screen.getByLabelText('รหัส')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.className).toContain('border-danger')
    expect(input).toHaveAccessibleDescription('รหัสหรือรหัสผ่านไม่ถูกต้อง')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ส่ง ref ได้ (ใช้กับ React Hook Form)', () => {
    const ref = { current: null as HTMLInputElement | null }
    render(<TextField label="อีเมล" ref={ref} />)

    expect(ref.current).toBe(screen.getByLabelText('อีเมล'))
  })
})

describe('PasswordField', () => {
  it('ซ่อนรหัสเป็นค่าเริ่มต้น ; กด "แสดง" → เห็นรหัส ; กด "ซ่อน" → กลับเป็นจุด', async () => {
    const user = userEvent.setup()
    render(<PasswordField label="รหัสผ่าน" defaultValue="secret" />)
    const input = screen.getByLabelText('รหัสผ่าน')

    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'แสดงรหัสผ่าน' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('ปุ่มแสดง/ซ่อนไม่ส่งฟอร์ม', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label="รหัสผ่าน" />
      </form>,
    )

    await user.click(screen.getByRole('button', { name: 'แสดงรหัสผ่าน' }))
    expect(onSubmit).not.toHaveBeenCalled()
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

describe('buttonClassName', () => {
  it('ลิงก์ใช้หน้าตาเดียวกับปุ่มแบบเดียวกันได้', () => {
    render(
      <a href="/profile" className={buttonClassName('secondary')}>
        ดูข้อมูลส่วนตัว
      </a>,
    )

    const link = screen.getByRole('link', { name: 'ดูข้อมูลส่วนตัว' })
    expect(link.className).toContain('border-line-strong')
    expect(link.className).toContain('focus-visible:outline-accent')
  })
})

describe('Avatar', () => {
  const user = { first_name: 'สมใจ', last_name: 'รักเรียน', email: 'student@example.com' }

  it('ยังไม่มีรูป → แสดงตัวอักษรย่อ และเป็นการตกแต่ง (โปรแกรมอ่านหน้าจอข้าม)', () => {
    const { container } = render(<Avatar user={{ ...user, avatar_url: null }} size={38} />)

    const circle = container.firstElementChild as HTMLElement
    expect(circle).toHaveTextContent('สร')
    expect(circle).toHaveAttribute('aria-hidden', 'true')
    expect(circle.style.width).toBe('38px')
  })

  it('แบบ ring (แถบบัตรประจำตัว) → ขอบเขียว + พื้นม่วงเข้ม และตัวอักษรตามสัดส่วนวงใหญ่', () => {
    const { container } = render(
      <Avatar user={{ ...user, avatar_url: null }} size={128} variant="ring" />,
    )

    const circle = container.firstElementChild as HTMLElement
    expect(circle.className).toContain('border-accent')
    expect(circle.className).toContain('bg-brand-hover')
    expect(circle.style.fontSize).toBe('41px')
  })

  it('มีรูป → แสดงรูปแทนตัวอักษรย่อ', () => {
    const { container } = render(
      <Avatar user={{ ...user, avatar_url: '/media/avatars/3.webp' }} size={36} />,
    )

    const image = container.querySelector('img')
    expect(image).toHaveAttribute('src', '/media/avatars/3.webp')
    expect(container).not.toHaveTextContent('สร')
  })
})

describe('TextField — คำแนะนำใต้ช่อง (hint)', () => {
  it('แสดงคำแนะนำและผูกกับช่อง ; มี error → error แทนที่คำแนะนำ', () => {
    const { rerender } = render(<TextField label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัว" />)

    expect(screen.getByLabelText('รหัสผ่านใหม่')).toHaveAccessibleDescription('อย่างน้อย 8 ตัว')

    rerender(<TextField label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัว" error="รหัสผ่านสั้นเกินไป" />)

    expect(screen.queryByText('อย่างน้อย 8 ตัว')).not.toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่านใหม่')).toHaveAccessibleDescription('รหัสผ่านสั้นเกินไป')
  })
})
