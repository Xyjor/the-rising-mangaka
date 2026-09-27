// Drives the presentation clock (src/state/clock.ts) once per animation frame while the sim clock is running, and
// keeps it in sync with the sim's own day and log. Nothing here touches the persisted store beyond reading from it.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { advanceClock, markLogSeen, syncClockToDay } from '../../state/clock'
import { useStore } from '../../state/store'
import type { Speed } from '../../state/store'

/** Where the clock loop reads time and asks for frames. Tests replace these with a stubbed frame queue. */
export const clockLoop: {
  now: () => number
  raf: (cb: FrameRequestCallback) => number
  caf: (id: number) => void
} = {
  now: () => performance.now(),
  raf: (cb) => window.requestAnimationFrame(cb),
  caf: (id) => window.cancelAnimationFrame(id),
}

/** While `running`, advances the presentation clock by real elapsed time every frame, at `speed`. */
export function useClockLoop(running: boolean, speed: Speed): void {
  useEffect(() => {
    if (!running || speed === 0) return
    let last = clockLoop.now()
    let id = 0
    const frame = () => {
      const now = clockLoop.now()
      advanceClock(now - last, speed)
      last = now
      id = clockLoop.raf(frame)
    }
    id = clockLoop.raf(frame)
    return () => clockLoop.caf(id)
  }, [running, speed])
}

/** Keeps the presentation clock's day, and the unread-log watermark, aligned with the sim's game state. */
export function useClockSync(): void {
  const day = useStore((s) => s.game?.day ?? 0)
  const nextLogId = useStore((s) => s.game?.nextLogId ?? 0)
  const worldSeed = useStore((s) => s.game?.worldSeed)
  const saveLoads = useStore((s) => s.saveLoads)
  const lastMark = useRef<{ worldSeed: number | undefined; saveLoads: number } | null>(null)

  useLayoutEffect(() => {
    syncClockToDay(day)
  }, [day])

  useLayoutEffect(() => {
    const prev = lastMark.current
    if (prev && prev.worldSeed === worldSeed && prev.saveLoads === saveLoads) return
    lastMark.current = { worldSeed, saveLoads }
    markLogSeen(nextLogId)
  }, [worldSeed, saveLoads, nextLogId])
}
