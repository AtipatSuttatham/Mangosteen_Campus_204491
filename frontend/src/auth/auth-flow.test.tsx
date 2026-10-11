/**
 * test การเข้าสู่ระบบแบบครบเส้นทาง: AuthProvider + ยามหน้าประตู + router + หน้าชั่วคราว
 * ไม่เรียก backend จริง: แทนที่ fetch ด้วย "backend ปลอม" ที่ตอบตามที่อยู่
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AppRoutes } from '../router'
import { AUTH_CHANNEL_NAME, AuthProvider } from './AuthProvider'
import { RequireAuth } from './guards'
import { setAccessToken } from './session'

/** ผู้ใช้ตัวอย่าง (ข้อมูลสมมติ) */
const STUDENT = {
  id: 3,
  email: 'student@example.com',
  student_or_staff_id: '690000001',
  role: 'student' as const,
  first_name: 'สมใจ',
  last_name: 'รักเรียน',
  avatar_url: null,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
const UNAUTHORIZED = () => json({ code: 'authentication_failed', detail: 'x' }, 401)

/**
 * backend ปลอม
 * - hasSession: มี cookie ที่ใช้แลกบัตรได้ไหม
 * - meExpired: GET me/ ตอบ 401 (จำลองบัตรหมดอายุกลางคัน)
 */
function fakeBackend(options: { hasSession: boolean; meExpired?: boolean }) {
  let hasSession = options.hasSession
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push(url)
    if (url.endsWith('/auth/refresh/')) {
      return hasSession ? json({ access: 'access-1', user: STUDENT }) : UNAUTHORIZED()
    }
    if (url.endsWith('/auth/login/')) {
      const body = JSON.parse(String(init?.body)) as { identifier: string; password: string }
      if (body.identifier === '690000001' && body.password === 'correct-pass') {
        hasSession = true
        return json({ access: 'access-1', user: STUDENT })
      }
      return json({ code: 'invalid_credentials', detail: 'x' }, 400)
    }
    if (url.endsWith('/auth/logout/')) {
      hasSession = false
      return new Response(null, { status: 204 })
    }
    if (url.endsWith('/auth/me/')) {
      if (options.meExpired) {
        hasSession = false
        return UNAUTHORIZED()
      }
      return json(STUDENT)
    }
    return json({ code: 'not_found', detail: 'x' }, 404)
  })
  return { calls }
}

/** ช่องสื่อสารระหว่างแท็บแบบปลอม — เก็บทุกช่องที่เปิดไว้ ส่งข้อความหาได้ */
class FakeChannel {
  static instances: FakeChannel[] = []
  readonly name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  posted: unknown[] = []
  constructor(name: string) {
    this.name = name
    FakeChannel.instances.push(this)
  }
  postMessage(data: unknown) {
    this.posted.push(data)
  }
  close() {}
  /** จำลองข้อความที่มาจากแท็บอื่น */
  receive(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}

/** วาดแอปที่ที่อยู่ที่กำหนด (ใช้ router จริงของแอป) */
function renderApp(path: string, routes = <AppRoutes />) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>{routes}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** กรอกและส่งฟอร์มเข้าสู่ระบบ */
async function submitLogin(identifier: string, password: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('รหัสนักศึกษา/รหัสพนักงาน หรืออีเมล'), identifier)
  await user.type(screen.getByLabelText('รหัสผ่าน'), password)
  await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))
}

beforeEach(() => {
  FakeChannel.instances = []
  vi.stubGlobal('BroadcastChannel', FakeChannel)
})

afterEach(() => {
  setAccessToken(null)
  vi.unstubAllGlobals()
})

describe('เปิดหน้าเว็บ', () => {
  it('ระหว่างตรวจบัตร → พื้นว่าง (aria-busy) ไม่แสดงหน้าใดก่อน', async () => {
    // backend ยังไม่ตอบ (ตอบทีหลังด้วย respond) — ต้องให้ตอบก่อนจบข้อ ไม่งั้นการแลกบัตรที่ค้าง
    // จะถูกใช้ต่อในข้อถัดไป (ตัวแลกบัตรรวมคำขอที่กำลังทำอยู่ให้เป็นครั้งเดียว)
    let respond: (response: Response) => void = () => {}
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((resolve) => {
        respond = resolve
      }),
    )

    renderApp('/')

    expect(screen.getByText('กำลังโหลด').parentElement).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()

    respond(UNAUTHORIZED())
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('มี cookie ที่ใช้ได้ → ยังอยู่ในระบบ ไม่ต้อง login ซ้ำ', async () => {
    fakeBackend({ hasSession: true })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'สวัสดี สมใจ' })).toBeInTheDocument()
  })

  it('ไม่มี cookie → ไปหน้าเข้าสู่ระบบ (ไม่มีข้อความหมดเวลา)', async () => {
    fakeBackend({ hasSession: false })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
    expect(screen.queryByText('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง')).not.toBeInTheDocument()
  })

  it('ที่อยู่ที่ไม่มีจริง → พากลับหน้าแรก', async () => {
    fakeBackend({ hasSession: true })

    renderApp('/abc')

    expect(await screen.findByRole('heading', { name: 'สวัสดี สมใจ' })).toBeInTheDocument()
  })
})

describe('เข้าสู่ระบบ', () => {
  it('เข้าหน้าที่ต้อง login → ไปหน้าเข้าสู่ระบบ → login แล้วกลับหน้าเดิม', async () => {
    fakeBackend({ hasSession: false })
    renderApp('/profile')

    await submitLogin('690000001', 'correct-pass')

    expect(await screen.findByRole('heading', { name: 'ข้อมูลส่วนตัว' })).toBeInTheDocument()
    expect(await screen.findByText('student@example.com')).toBeInTheDocument()
  })

  it('รหัสผิด → แสดงข้อความรวมตาม wireframe และยังอยู่หน้าเดิม', async () => {
    fakeBackend({ hasSession: false })
    renderApp('/login')

    await submitLogin('690000001', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'รหัสหรืออีเมล หรือรหัสผ่านไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง',
    )
    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('เข้าสู่ระบบอยู่แล้วแต่เปิด /login → พาไปหน้าแรก', async () => {
    fakeBackend({ hasSession: true })

    renderApp('/login')

    expect(await screen.findByRole('heading', { name: 'สวัสดี สมใจ' })).toBeInTheDocument()
  })
})

describe('ออกจากระบบ / ถูกให้ออก', () => {
  it('กดออกจากระบบ → ไปหน้าเข้าสู่ระบบ และบอกแท็บอื่น', async () => {
    fakeBackend({ hasSession: true })
    renderApp('/')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'ออกจากระบบ' }))

    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
    const channel = FakeChannel.instances.find((c) => c.name === AUTH_CHANNEL_NAME)
    expect(channel?.posted).toContainEqual({ type: 'logout' })
  })

  it('แท็บอื่นออกจากระบบ → แท็บนี้ไปหน้าเข้าสู่ระบบทันที', async () => {
    fakeBackend({ hasSession: true })
    renderApp('/')
    await screen.findByRole('heading', { name: 'สวัสดี สมใจ' })

    FakeChannel.instances.at(-1)?.receive({ type: 'logout' })

    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('บัตรหมดอายุกลางคันและแลกไม่ได้ → หน้าเข้าสู่ระบบพร้อม "หมดเวลาการใช้งาน"', async () => {
    fakeBackend({ hasSession: true, meExpired: true })

    renderApp('/profile')

    expect(
      await screen.findByText('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })
})

describe('ยามหน้าประตูตามบทบาท', () => {
  it('บทบาทไม่ตรง → กลับหน้าแรก', async () => {
    fakeBackend({ hasSession: true })

    renderApp(
      '/admin-only',
      <Routes>
        <Route path="/" element={<h1>หน้าแรกทดสอบ</h1>} />
        <Route
          path="/admin-only"
          element={
            <RequireAuth roles={['admin']}>
              <h1>หน้าผู้ดูแลระบบ</h1>
            </RequireAuth>
          }
        />
      </Routes>,
    )

    expect(await screen.findByRole('heading', { name: 'หน้าแรกทดสอบ' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'หน้าผู้ดูแลระบบ' })).not.toBeInTheDocument(),
    )
  })
})
