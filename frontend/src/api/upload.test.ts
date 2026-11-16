/**
 * test ของตัวส่งไฟล์แบบมีความคืบหน้า (uploadWithProgress — ขั้น 4.6)
 * ไม่ส่งไฟล์จริง: แทนที่ XMLHttpRequest ด้วยตัวปลอมที่กำหนดได้ว่าจะตอบอะไร
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as session from '../auth/session'
import { ApiError } from './client'
import { UploadAbortedError, uploadWithProgress } from './upload'

vi.mock('../auth/session', () => ({
  getAccessToken: vi.fn(),
  refreshSession: vi.fn(),
  notifySessionExpired: vi.fn(),
}))
const auth = vi.mocked(session)

/** สิ่งที่ตัวปลอมจะทำเมื่อถูกสั่ง send — แต่ละคำขอดึงจากคิวนี้ตามลำดับ */
type Script =
  | { kind: 'respond'; status: number; body?: unknown; progress?: [number, number][] }
  | { kind: 'fail' }
  | { kind: 'hang' }

let scripts: Script[] = []
let sent: FakeXhr[] = []

/** XMLHttpRequest ปลอม: จำ header / ที่อยู่ไว้ตรวจ แล้วทำตามคิว scripts */
class FakeXhr {
  method = ''
  url = ''
  headers: Record<string, string> = {}
  withCredentials = false
  status = 0
  responseText = ''
  body: unknown = null
  upload: {
    onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null
  } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  abort() {
    this.onabort?.()
  }
  send(body: unknown) {
    this.body = body
    sent.push(this)
    const script = scripts.shift() ?? { kind: 'hang' }
    queueMicrotask(() => {
      if (script.kind === 'fail') {
        this.onerror?.()
      } else if (script.kind === 'respond') {
        for (const [loaded, total] of script.progress ?? []) {
          this.upload.onprogress?.({ lengthComputable: true, loaded, total })
        }
        this.status = script.status
        this.responseText = script.body === undefined ? '' : JSON.stringify(script.body)
        this.onload?.()
      }
    })
  }
}

const form = () => {
  const data = new FormData()
  data.append('file', new File(['x'], 'บท.pdf', { type: 'application/pdf' }))
  return data
}

beforeEach(() => {
  scripts = []
  sent = []
  vi.resetAllMocks()
  auth.getAccessToken.mockReturnValue('token-1')
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadWithProgress', () => {
  it('ส่ง POST ไปที่ /api/v1/... พร้อม token + cookie และรายงานความคืบหน้า', async () => {
    scripts = [
      {
        kind: 'respond',
        status: 200,
        body: { id: 12 },
        progress: [
          [50, 100],
          [100, 100],
        ],
      },
    ]
    const onProgress = vi.fn()
    const data = form()

    const result = await uploadWithProgress<{ id: number }>('/courses/5/contents/12/file/', data, {
      onProgress,
    })

    expect(result).toEqual({ id: 12 })
    const xhr = sent[0]!
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('/api/v1/courses/5/contents/12/file/')
    expect(xhr.withCredentials).toBe(true)
    expect(xhr.headers.Authorization).toBe('Bearer token-1')
    // ไม่ตั้ง Content-Type เอง (เบราว์เซอร์ใส่ multipart + เส้นคั่นให้)
    expect(xhr.headers['Content-Type']).toBeUndefined()
    expect(xhr.body).toBe(data)
    expect(onProgress.mock.calls).toEqual([[{ loaded: 50, total: 100 }], [{ loaded: 100, total: 100 }]])
  })

  it('backend ตอบ error รูปแบบกลาง → ApiError พร้อมรหัสและข้อมูลประกอบ', async () => {
    scripts = [{ kind: 'respond', status: 400, body: { code: 'content_file_too_large', max_bytes: 100 } }]

    const error = await uploadWithProgress('/x/', form()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('content_file_too_large')
    expect((error as ApiError).body).toMatchObject({ max_bytes: 100 })
  })

  it('เน็ตหลุดกลางทาง → ApiError network_error', async () => {
    scripts = [{ kind: 'fail' }]

    const error = await uploadWithProgress('/x/', form()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('network_error')
  })

  it('บัตรหมดอายุ (401) → แลกบัตรใหม่แล้วส่งซ้ำด้วย token ใหม่', async () => {
    scripts = [
      { kind: 'respond', status: 401, body: { code: 'not_authenticated' } },
      { kind: 'respond', status: 200, body: { id: 1 } },
    ]
    auth.refreshSession.mockImplementation(async () => {
      auth.getAccessToken.mockReturnValue('token-2')
      return { access: 'token-2' } as Awaited<ReturnType<typeof session.refreshSession>>
    })

    await expect(uploadWithProgress('/x/', form())).resolves.toEqual({ id: 1 })
    expect(sent).toHaveLength(2)
    expect(sent[1]!.headers.Authorization).toBe('Bearer token-2')
    expect(auth.notifySessionExpired).not.toHaveBeenCalled()
  })

  it('แลกบัตรไม่ได้ → แจ้งถูกให้ออกจากระบบ และโยน ApiError เดิม', async () => {
    scripts = [{ kind: 'respond', status: 401, body: { code: 'not_authenticated' } }]
    auth.refreshSession.mockResolvedValue(null)

    const error = await uploadWithProgress('/x/', form()).catch((caught: unknown) => caught)

    expect((error as ApiError).status).toBe(401)
    expect(auth.notifySessionExpired).toHaveBeenCalledOnce()
  })

  it('สั่งยกเลิกกลางทาง → UploadAbortedError', async () => {
    scripts = [{ kind: 'hang' }]
    const controller = new AbortController()

    const pending = uploadWithProgress('/x/', form(), { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toBeInstanceOf(UploadAbortedError)
  })

  it('สั่งยกเลิกไว้ก่อนเริ่ม → ไม่ส่งเลย', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(uploadWithProgress('/x/', form(), { signal: controller.signal })).rejects.toBeInstanceOf(
      UploadAbortedError,
    )
    expect(sent).toHaveLength(0)
  })
})
