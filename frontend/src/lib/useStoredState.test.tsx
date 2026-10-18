/**
 * test ของค่าที่จำไว้ในเบราว์เซอร์ (lib/useStoredState.ts — ขั้น 3.5)
 * สำคัญที่สุด: storage ใช้ไม่ได้ / ข้อมูลเสีย → ใช้ค่าเริ่มต้น หน้ายังทำงานปกติ
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readStored, useStoredState, writeStored } from './useStoredState'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('readStored / writeStored', () => {
  it('เขียนแล้วอ่านกลับได้ (มีคำนำหน้าชื่อ mangosteen:)', () => {
    writeStored('demo', { a: true })

    expect(readStored('demo', {})).toEqual({ a: true })
    expect(window.localStorage.getItem('mangosteen:demo')).toBe('{"a":true}')
  })

  it('ไม่มีค่า / ข้อมูลเสีย → ค่าเริ่มต้น', () => {
    window.localStorage.setItem('mangosteen:broken', '{not json')

    expect(readStored('missing', 'x')).toBe('x')
    expect(readStored('broken', 'y')).toBe('y')
  })

  it('storage ใช้ไม่ได้ (โยน error) → อ่านได้ค่าเริ่มต้น และเขียนไม่ทำให้หน้าพัง', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(readStored('demo', 1)).toBe(1)
    expect(() => writeStored('demo', 2)).not.toThrow()
  })
})

describe('useStoredState', () => {
  it('เริ่มจากค่าที่จำไว้ และเปลี่ยนแล้วจำทันที (รับฟังก์ชันได้)', () => {
    writeStored('count', 5)
    const { result } = renderHook(() => useStoredState('count', 0))

    expect(result.current[0]).toBe(5)
    act(() => result.current[1]((prev) => prev + 1))

    expect(result.current[0]).toBe(6)
    expect(readStored('count', 0)).toBe(6)
  })

  it('storage ใช้ไม่ได้ → ยังเปลี่ยนค่าในหน้าจอได้ตามปกติ', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useStoredState('flag', false))

    act(() => result.current[1](true))

    expect(result.current[0]).toBe(true)
  })
})
