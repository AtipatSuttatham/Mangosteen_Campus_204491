/**
 * test ของหน้าต่างซ้อน Dialog / ConfirmDialog (ขั้น 2.6)
 * ตรวจพฤติกรรมตามมาตรฐานการเข้าถึง: โฟกัส, Esc, Tab วน, พื้นมืดไม่ปิด, ล็อกการเลื่อนหน้า
 * — หน้าตาตรวจด้วยตาที่หน้า /dev/components
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState, type ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, ConfirmDialog, Dialog, DialogBody, DialogFooter, DialogHeader, TextField } from './index'

/** หน้าทดสอบ: ปุ่มเปิดหน้าต่าง + หน้าต่างแบบฟอร์ม (ช่องกรอก 1 ช่อง + ปุ่มยกเลิก/บันทึก) */
function DialogHarness({ onClose, focusField = false }: { onClose?: () => void; focusField?: boolean }) {
  const [open, setOpen] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)
  const close = () => {
    onClose?.()
    setOpen(false)
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>เปิดหน้าต่าง</Button>
      {open && (
        <Dialog
          labelledBy="harness-title"
          onClose={close}
          initialFocusRef={focusField ? fieldRef : undefined}
        >
          <DialogHeader
            titleId="harness-title"
            title="รีเซ็ตรหัสผ่าน"
            subtitle="กันต์พงษ์ วิไลรัตน์"
            onClose={close}
          />
          <DialogBody>
            <TextField ref={fieldRef} label="รหัสผ่านใหม่" />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={close}>
              ยกเลิก
            </Button>
            <Button>บันทึก</Button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog', () => {
  it('เปิดแล้วเป็นหน้าต่างซ้อนที่มีชื่อตามหัวข้อ และโฟกัสอยู่ข้างใน (ปุ่ม ✕)', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    await user.click(screen.getByRole('button', { name: 'เปิดหน้าต่าง' }))

    const dialog = screen.getByRole('dialog', { name: 'รีเซ็ตรหัสผ่าน' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('button', { name: 'ปิด' })).toHaveFocus()
  })

  it('initialFocusRef: เปิดแล้วโฟกัสที่ตัวที่กำหนด (เช่น ช่องกรอกแรก)', async () => {
    const user = userEvent.setup()
    render(<DialogHarness focusField />)

    await user.click(screen.getByRole('button', { name: 'เปิดหน้าต่าง' }))

    expect(screen.getByLabelText('รหัสผ่านใหม่')).toHaveFocus()
  })

  it('Esc ปิดหน้าต่าง แล้วโฟกัสกลับไปที่ปุ่มที่กดเปิด', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<DialogHarness onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'เปิดหน้าต่าง' })

    await user.click(opener)
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('ปุ่ม ✕ ปิดหน้าต่างได้ แต่แตะพื้นมืดด้านหลังไม่ปิด (กันข้อมูลที่กรอกหาย)', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    await user.click(screen.getByRole('button', { name: 'เปิดหน้าต่าง' }))
    await user.click(screen.getByTestId('dialog-backdrop'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ปิด' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ปุ่ม Tab วนอยู่ในหน้าต่าง: ตัวสุดท้าย → ตัวแรก และ Shift+Tab ตัวแรก → ตัวสุดท้าย', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    await user.click(screen.getByRole('button', { name: 'เปิดหน้าต่าง' }))
    const dialog = screen.getByRole('dialog')
    const closeButton = within(dialog).getByRole('button', { name: 'ปิด' })
    const saveButton = within(dialog).getByRole('button', { name: 'บันทึก' })

    saveButton.focus()
    await user.tab()
    expect(closeButton).toHaveFocus()

    await user.tab({ shift: true })
    expect(saveButton).toHaveFocus()
  })

  it('ระหว่างเปิด หน้าด้านหลังเลื่อนไม่ได้ — ปิดแล้วคืนค่าเดิม', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    await user.click(screen.getByRole('button', { name: 'เปิดหน้าต่าง' }))
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('')
  })
})

describe('ConfirmDialog', () => {
  /** วาดหน้าต่างยืนยันแบบระงับบัญชี */
  function renderConfirm(props: Partial<ComponentProps<typeof ConfirmDialog>> = {}) {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="ระงับบัญชี วิชัย ทองมา?"
        description={['ผู้ใช้จะออกจากระบบทันที', 'ข้อมูลและคะแนนของผู้ใช้ยังอยู่ครบ']}
        confirmLabel="ระงับบัญชี"
        pendingLabel="กำลังระงับ…"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />,
    )
    return { onConfirm, onCancel }
  }

  it('เป็น alertdialog ที่มีชื่อ + คำอธิบาย และโฟกัสที่ "ยกเลิก" ก่อน', () => {
    renderConfirm()

    const dialog = screen.getByRole('alertdialog', { name: 'ระงับบัญชี วิชัย ทองมา?' })
    expect(dialog).toHaveAccessibleDescription(/ผู้ใช้จะออกจากระบบทันที/)
    expect(within(dialog).getByRole('button', { name: 'ยกเลิก' })).toHaveFocus()
  })

  it('ปุ่มยืนยันเป็นปุ่มแดงทึบ — กดแล้วเรียก onConfirm ; ยกเลิก / Esc เรียก onCancel', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = renderConfirm()

    const confirm = screen.getByRole('button', { name: 'ระงับบัญชี' })
    expect(confirm.className).toContain('bg-bad')
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('ระหว่างกำลังทำ: ปุ่มยืนยันขึ้นข้อความรอและกดไม่ได้ ; ยกเลิก / Esc ไม่ปิด', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderConfirm({ pending: true })

    expect(screen.getByRole('button', { name: 'กำลังระงับ…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    await user.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('ทำไม่สำเร็จ: แสดงข้อความ error ในหน้าต่าง', () => {
    renderConfirm({ error: 'ต้องเหลือผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'ต้องเหลือผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน',
    )
  })
})
