// A number that rolls to its new value instead of jumping, for the HUD's money and fans.
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../motion'

/** Where the roll reads time and asks for frames. Tests replace these with a stubbed frame queue. */
export const rollClock: {
  now: () => number
  raf: (cb: FrameRequestCallback) => number
  caf: (id: number) => void
} = {
  now: () => performance.now(),
  raf: (cb) => window.requestAnimationFrame(cb),
  caf: (id) => window.cancelAnimationFrame(id),
}

export const ROLL_MS = 500

/** The first render shows `value`; later changes ease from what is shown to `value` over `ms` (instant under reduced motion). */
export function useRolledNumber(value: number, ms = ROLL_MS): number {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  const instant = prefersReducedMotion() || ms <= 0

  useEffect(() => {
    const from = shownRef.current
    if (from === value) return
    if (instant) {
      shownRef.current = value
      return
    }
    const start = rollClock.now()
    let id = 0
    const frame = () => {
      const k = Math.min(1, (rollClock.now() - start) / ms)
      const eased = 1 - (1 - k) ** 3
      const next = k >= 1 ? value : Math.round(from + (value - from) * eased)
      shownRef.current = next
      setShown(next)
      if (k < 1) id = rollClock.raf(frame)
    }
    id = rollClock.raf(frame)
    return () => rollClock.caf(id)
  }, [value, ms, instant])

  return instant ? value : shown
}
