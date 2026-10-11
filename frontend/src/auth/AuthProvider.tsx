/**
 * "สมอง" ของการเข้าสู่ระบบฝั่งหน้าเว็บ — ครอบทั้งแอปไว้ (Root.tsx)
 * อ้างอิงลำดับการทำงาน: docs/api.md §6.3 และการตัดสินใจขั้น 1.4 ใน CLAUDE.md
 *
 * หน้าที่:
 *   1. เปิดหน้าเว็บ → แลกบัตรจาก cookie ทันที → รู้ว่าเข้าสู่ระบบอยู่หรือไม่ (ไม่ต้อง login ซ้ำ)
 *   2. login() / logout() ให้หน้าจอเรียกใช้
 *   3. ถูกให้ออกจากระบบกลางคัน (apiFetch แลกบัตรไม่ได้) → สถานะเป็น "ไม่ได้เข้าสู่ระบบ"
 *      พร้อมธง sessionExpired ให้หน้าเข้าสู่ระบบแสดง "หมดเวลาการใช้งาน"
 *   4. ออกจากระบบในแท็บหนึ่ง → บอกแท็บอื่นผ่าน BroadcastChannel ให้ออกจากระบบทันที
 *   5. ทุกครั้งที่ออกจากระบบ ล้างข้อมูลที่แคชไว้ (TanStack Query) — คนถัดไปไม่เห็นข้อมูลเก่า
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, type User } from '../api/auth'
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext'
import { onSessionExpired, refreshSession, setAccessToken } from './session'

/** ชื่อช่องสื่อสารระหว่างแท็บ (ใช้ร่วมกันทุกแท็บของเว็บนี้) */
export const AUTH_CHANNEL_NAME = 'mangosteen-auth'

/** ข้อความที่ส่งระหว่างแท็บ */
type AuthMessage = { type: 'logout' }

type State = { status: AuthStatus; user: User | null; sessionExpired: boolean }

/** เปิดช่องสื่อสารระหว่างแท็บ (เบราว์เซอร์ที่ไม่รองรับ → ไม่มีช่อง ทำงานต่อได้ตามปกติ) */
function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL_NAME)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>({
    status: 'loading',
    user: null,
    sessionExpired: false,
  })
  // ใช้อ่านสถานะล่าสุดในตัวฟังเหตุการณ์ (ไม่ต้องสมัครฟังใหม่ทุกครั้งที่สถานะเปลี่ยน)
  const statusRef = useRef<AuthStatus>(state.status)
  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  /** เปลี่ยนเป็น "ไม่ได้เข้าสู่ระบบ" + ล้างบัตรและข้อมูลที่แคชไว้ */
  const signOutLocally = useCallback(
    (sessionExpired: boolean) => {
      setAccessToken(null)
      queryClient.clear()
      setState({ status: 'anonymous', user: null, sessionExpired })
    },
    [queryClient],
  )

  // 1) เปิดหน้าเว็บ → แลกบัตรจาก cookie
  useEffect(() => {
    let active = true
    refreshSession()
      .then((result) => {
        if (!active) return
        setState(
          result
            ? { status: 'authenticated', user: result.user, sessionExpired: false }
            : { status: 'anonymous', user: null, sessionExpired: false },
        )
      })
      .catch(() => {
        // ติดต่อ backend ไม่ได้ → แสดงหน้าเข้าสู่ระบบ (กด login แล้วจะเห็น error ติดต่อไม่ได้)
        if (active) setState({ status: 'anonymous', user: null, sessionExpired: false })
      })
    return () => {
      active = false
    }
  }, [])

  // 3) ถูกให้ออกจากระบบกลางคัน — แสดง "หมดเวลา" เฉพาะคนที่เข้าสู่ระบบอยู่จริง
  useEffect(
    () =>
      onSessionExpired(() => {
        if (statusRef.current === 'authenticated') signOutLocally(true)
      }),
    [signOutLocally],
  )

  // 4) แท็บอื่นออกจากระบบ → แท็บนี้ออกด้วยทันที
  const channelRef = useRef<BroadcastChannel | null>(null)
  useEffect(() => {
    const channel = openChannel()
    channelRef.current = channel
    if (!channel) return
    channel.onmessage = (event: MessageEvent<AuthMessage>) => {
      if (event.data?.type === 'logout' && statusRef.current === 'authenticated') {
        signOutLocally(false)
      }
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [signOutLocally])

  // 2) เข้าสู่ระบบ / ออกจากระบบ
  const login = useCallback(async (identifier: string, password: string) => {
    const result = await apiLogin(identifier, password)
    setAccessToken(result.access)
    setState({ status: 'authenticated', user: result.user, sessionExpired: false })
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ติดต่อ backend ไม่ได้ก็ยังออกจากระบบฝั่งหน้าเว็บ (cookie หมดอายุเองภายใน 7 วัน)
    }
    signOutLocally(false)
    channelRef.current?.postMessage({ type: 'logout' } satisfies AuthMessage)
  }, [signOutLocally])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
