/**
 * test ของหน้าเข้าสู่ระบบ (LoginPage) — พฤติกรรมของฟอร์มตาม board "เข้าสู่ระบบ" + "กรอกผิด"
 * ใช้ "สมอง" ปลอม (AuthContext) แทนของจริง เพื่อกำหนดผลของ login() ได้เองในแต่ละข้อ
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import LoginPage from './LoginPage'

const ID_LABEL = 'รหัสนักศึกษา/รหัสพนักงาน หรืออีเมล'
const WRONG = 'รหัสหรืออีเมล หรือรหัสผ่านไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง'

/** วาดหน้าเข้าสู่ระบบด้วย login() ที่กำหนดเอง */
function renderLogin(login: AuthContextValue['login'], sessionExpired = false) {
  const value: AuthContextValue = {
    status: 'anonymous',
    user: null,
    sessionExpired,
    login,
    logout: vi.fn(),
  }
  render(
    <AuthContext.Provider value={value}>
      <LoginPage />
    </AuthContext.Provider>,
  )
}

/** กรอกฟอร์มแล้วกดปุ่มเข้าสู่ระบบ */
async function fillAndSubmit(identifier: string, password: string) {
  const user = userEvent.setup()
  if (identifier) await user.type(screen.getByLabelText(ID_LABEL), identifier)
  if (password) await user.type(screen.getByLabelText('รหัสผ่าน'), password)
  await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))
  return user
}

describe('LoginPage', () => {
  it('แสดงข้อความตาม wireframe: หัวข้อ แผงม่วง ป้ายช่อง ปุ่มแสดงรหัส', () => {
    renderLogin(vi.fn())

    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
    expect(screen.getByText('ห้องเรียนของคุณ อยู่ที่นี่ครบทุกวิชา')).toBeInTheDocument()
    expect(screen.getByLabelText(ID_LABEL)).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'แสดงรหัสผ่าน' })).toBeInTheDocument()
  })

  it('ไม่กรอก → ข้อความใต้ทั้ง 2 ช่อง และไม่เรียก login()', async () => {
    const login = vi.fn()
    renderLogin(login)

    await fillAndSubmit('', '')

    expect(await screen.findAllByText('กรุณากรอกข้อมูลช่องนี้')).toHaveLength(2)
    expect(login).not.toHaveBeenCalled()
  })

  it('ส่งรหัสที่ตัดช่องว่างหัวท้ายแล้ว และรหัสผ่านตามที่พิมพ์', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    renderLogin(login)

    await fillAndSubmit('  690000001 ', ' pass word ')

    expect(login).toHaveBeenCalledWith('690000001', ' pass word ')
  })

  it('รหัสผิด → ขอบแดงทั้ง 2 ช่อง + ข้อความเดียวใต้ช่องรหัสผ่าน (ตาม board กรอกผิด)', async () => {
    renderLogin(vi.fn().mockRejectedValue(new ApiError(400, 'invalid_credentials')))

    await fillAndSubmit('690000001', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent(WRONG)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    const idInput = screen.getByLabelText(ID_LABEL)
    const passwordInput = screen.getByLabelText('รหัสผ่าน')
    expect(idInput).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
    // ช่องรหัสก็ถูกอ่านคู่กับข้อความ error (โปรแกรมอ่านหน้าจอ)
    expect(idInput).toHaveAccessibleDescription(WRONG)
  })

  it('พิมพ์แก้หลังกรอกผิด → ข้อความ error หายไป', async () => {
    renderLogin(vi.fn().mockRejectedValue(new ApiError(400, 'invalid_credentials')))
    const user = await fillAndSubmit('690000001', 'wrong')
    await screen.findByRole('alert')

    await user.type(screen.getByLabelText('รหัสผ่าน'), 'x')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText(ID_LABEL)).not.toHaveAttribute('aria-invalid')
  })

  it.each([
    ['account_disabled', 'บัญชีนี้ถูกระงับการใช้งาน ไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ'],
    ['network_error', 'ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ'],
  ])('backend ตอบ %s → ข้อความภาษาไทยที่ตรงกัน', async (code, message) => {
    renderLogin(vi.fn().mockRejectedValue(new ApiError(0, code)))

    await fillAndSubmit('690000001', 'pw')

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('ระหว่างรอผล → ปุ่มกดไม่ได้ และขึ้น "กำลังเข้าสู่ระบบ…" (กันกดซ้ำ)', async () => {
    const login = vi.fn(() => new Promise<void>(() => {}))
    renderLogin(login)

    await fillAndSubmit('690000001', 'pw')

    const button = await screen.findByRole('button', { name: 'กำลังเข้าสู่ระบบ…' })
    expect(button).toBeDisabled()
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('กดส่งหลายครั้งเร็วกว่าที่หน้าจอวาดใหม่ทัน → เรียก login() ครั้งเดียว', async () => {
    const login = vi.fn(() => new Promise<void>(() => {}))
    renderLogin(login)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(ID_LABEL), '690000001')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'pw')
    const form = screen.getByRole('button', { name: 'เข้าสู่ระบบ' }).closest('form')!

    // ส่งฟอร์ม 3 ครั้งติดกันในจังหวะเดียว (เหมือนกด Enter ค้าง / ดับเบิลคลิกเร็วมาก)
    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.submit(form)

    await screen.findByRole('button', { name: 'กำลังเข้าสู่ระบบ…' })
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('แถบ "หมดเวลา" หายไปเมื่อกดเข้าสู่ระบบใหม่ (ไม่ซ้อนกับข้อความ error รอบใหม่)', async () => {
    renderLogin(vi.fn().mockRejectedValue(new ApiError(400, 'invalid_credentials')), true)
    expect(screen.getByRole('status')).toBeInTheDocument()

    await fillAndSubmit('690000001', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent(WRONG)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ถูกให้ออกจากระบบกลางคัน → แถบ "หมดเวลาการใช้งาน"', () => {
    renderLogin(vi.fn(), true)

    expect(screen.getByRole('status')).toHaveTextContent(
      'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง',
    )
  })
})
