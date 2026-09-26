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

/**
 * A gap longer than this (ms) between two reveal frames, or between mount and the first frame, means the window was
 * hidden and frames stopped: the reveal skips to its end instead of playing every beat it missed at once.
 */
export const MAX_FRAME_GAP = 250

export interface RevealClock {
  /** Milliseconds since mount, at most `end`. */
  elapsed: number
  /** Jumps `elapsed` to `end` and stops the clock. */
  skip: () => void
  /** True once `skip` was called, or once a frame came more than MAX_FRAME_GAP after the one before. */
  skipped: boolean
}

/**
 * Counts the milliseconds since mount on `revealClock`, one frame at a time, and stops asking for frames once it reaches
 * `end` or is skipped. A frame more than MAX_FRAME_GAP after the previous one (or after mount) skips. The pending frame
 * is cancelled on unmount. `end` of 0 (a reduced-motion plan) never ticks.
 */
export function useRevealClock(end: number): RevealClock {
  const [elapsed, setElapsed] = useState(0)
  const [skipped, setSkipped] = useState(false)
  const done = skipped || elapsed >= end

  const skip = useCallback(() => {
    setSkipped(true)
    setElapsed(end)
  }, [end])

  useEffect(() => {
    if (done) return
    const start = revealClock.now()
    let last = start
    let id = 0
    const frame = () => {
      const now = revealClock.now()
      if (now - last > MAX_FRAME_GAP) {
        skip()
        return
      }
      last = now
      const t = Math.min(end, Math.max(0, now - start))
      setElapsed(t)
      if (t < end) id = revealClock.raf(frame)
    }
    id = revealClock.raf(frame)
    return () => revealClock.caf(id)
  }, [done, end, skip])

  return { elapsed, skip, skipped }
}
