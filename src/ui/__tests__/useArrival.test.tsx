// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { useArrival } from '../hooks/useArrival'

let restore: () => void
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); restore() })

describe('useArrival', () => {
  it('flips true 1650 ms after the flag is set, and false when it clears', () => {
    restore = stubReducedMotion(false)
    const { result, rerender } = renderHook(({ p }) => useArrival(p), { initialProps: { p: false } })
    expect(result.current).toBe(false)
    rerender({ p: true })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(1649) })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(true)
    rerender({ p: false })
    expect(result.current).toBe(false)
  })

  it('is true at once when the flag was set on mount', () => {
    restore = stubReducedMotion(false)
    const { result } = renderHook(() => useArrival(true))
    expect(result.current).toBe(true)
  })

  it('is true at once under reduced motion', () => {
    restore = stubReducedMotion(true)
    const { result, rerender } = renderHook(({ p }) => useArrival(p), { initialProps: { p: false } })
    rerender({ p: true })
    expect(result.current).toBe(true)
  })
})
