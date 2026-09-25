// The Results modal's reveal clock: milliseconds since mount, advanced once per animation frame until the reveal ends,
// with a skip that jumps straight to the end. What happens at each moment is reveal.ts's plan; this only keeps time.
import { useCallback, useEffect, useState } from 'react'

/** Where the reveal clock reads time and asks for frames. Tests replace these with a frozen clock (and restore them). */
export const revealClock: {
  now: () => number
  raf: (cb: FrameRequestCallback) => number
  caf: (id: number) => void
} = {
  now: () => performance.now(),
  raf: (cb) => window.requestAnimationFrame(cb),
  caf: (id) => window.cancelAnimationFrame(id),
}

export interface RevealClock {
  /** Milliseconds since mount, at most `end`. */
  elapsed: number
  /** Jumps `elapsed` to `end` and stops the clock. */
  skip: () => void
  /** True once `skip` was called. */
  skipped: boolean
}

/**
 * Counts the milliseconds since mount on `revealClock`, one frame at a time, and stops asking for frames once it reaches
 * `end` or is skipped. The pending frame is cancelled on unmount. `end` of 0 (a reduced-motion plan) never ticks.
 */
export function useRevealClock(end: number): RevealClock {
  const [elapsed, setElapsed] = useState(0)
  const [skipped, setSkipped] = useState(false)
  const done = skipped || elapsed >= end

  useEffect(() => {
    if (done) return
    const start = revealClock.now()
    let id = 0
    const frame = () => {
      const t = Math.min(end, Math.max(0, revealClock.now() - start))
      setElapsed(t)
      if (t < end) id = revealClock.raf(frame)
    }
    id = revealClock.raf(frame)
    return () => revealClock.caf(id)
  }, [done, end])

  const skip = useCallback(() => {
    setSkipped(true)
    setElapsed(end)
  }, [end])

  return { elapsed, skip, skipped }
}
