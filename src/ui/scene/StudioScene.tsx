import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getPhase, placeById, studioLook } from '../../sim'
import type { StudioLook } from '../../sim'
import { SPEED_MS, useStore } from '../../state/store'
import { prefersReducedMotion } from '../motion'
import { H, W, render } from './render'
import type { Snapshot } from './render'
import { seasonOf } from './season'
import { NO_EQUIPMENT, SHOWN_TROPHIES, ownedFlags } from './studioArt'

/** Frame budget in ms: about 12 fps is plenty for a 192x108 sprite scene. */
const STEP_MS = 83
/** Under reduced motion only the sky crossfade advances, once a second. */
const STEP_MS_REDUCED = 1000

const EMPTY: never[] = []
/** No game: the bare apartment. One module-level object, so the selector below returns the same thing every call. */
const NO_LOOK: StudioLook = {
  tier: 'apartment', desks: 1, equipment: EMPTY, volumes: 0, animePoster: false, trophies: EMPTY,
}

/** True while something sits over the scene: a modal, a poll result or an offer. The canvas sleeps then. */
function isCovered(): boolean {
  const st = useStore.getState()
  return st.modal !== 'none' || !!st.game?.pendingResult || !!st.game?.pendingOffer
}

export function StudioScene({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const phaseT = useRef(0.2)
  const frame = useRef(0)
  const reduceMotion = useRef(false)

  const phase = useStore((s) => (s.game ? getPhase(s.game) : 'idle'))
  const activity = useStore((s) => s.game?.activity ?? 'rest')
  const progress = useStore((s) => (s.game?.project ? s.game.project.pagesDone / s.game.project.pagesTarget : 0))
  const stamina = useStore((s) => s.game?.player.stamina ?? 100)
  const speed = useStore((s) => s.speed)
  const trip = useStore((s) => s.game?.trip ?? null)
  const assistants = useStore((s) => s.game?.assistants ?? EMPTY)
  const season = useStore((s) => (s.game ? seasonOf(s.game.day) : 'spring'))
  // studioLook builds a new object every call; useShallow hands back the previous one while every field is the same
  // (primitives, and the owned and awards lists by reference), so the snapshot is rebuilt only when the studio changes.
  const look = useStore(useShallow((s) => (s.game ? studioLook(s.game) : NO_LOOK)))
  // a placeholder until the effect below fills it in, which it does before the loop's first frame
  const snap = useRef<Snapshot>({
    phase, activity, progress, stamina, running, speed, away: !!trip, assistants: [], season,
    tier: 'apartment', owned: NO_EQUIPMENT, volumes: 0, animePoster: false, trophies: 0,
  })
  useEffect(() => {
    snap.current = {
      phase, activity, progress, stamina, running, speed, away: !!trip,
      assistants: assistants.map((a) => ({ look: a.look, stamina: a.stamina })),
      season,
      // the studio as flags and counts, so render never walks a list per frame
      tier: look.tier, owned: ownedFlags(look.equipment), volumes: look.volumes, animePoster: look.animePoster,
      trophies: Math.min(SHOWN_TROPHIES, look.trophies.length),
    }
    // Under reduced motion the loop only repaints once a second, so state changes repaint at once.
    // ctxRef is still null on first mount (this effect runs before the loop effect); the loop's first frame covers it.
    if (reduceMotion.current && ctxRef.current) render(ctxRef.current, snap.current, phaseT.current, 0)
  }, [phase, activity, progress, stamina, running, speed, trip, assistants, season, look])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctxRef.current = ctx
    const reduce = prefersReducedMotion()
    reduceMotion.current = reduce
    const step = reduce ? STEP_MS_REDUCED : STEP_MS
    let raf = 0
    let last = performance.now()
    const hidden = () => document.hidden || isCovered()
    const loop = (now: number) => {
      if (hidden()) { raf = 0; return }
      if (now - last < step) { raf = requestAnimationFrame(loop); return }
      const dt = now - last
      last = now
      const s = snap.current
      // Frame increments are scaled so the sprites move at the same on-screen speed as 1 / 0.5 per 60 fps frame.
      if (s.running && s.speed > 0) {
        phaseT.current = (phaseT.current + dt / SPEED_MS[s.speed as 1 | 2 | 3]) % 1
        if (!reduce) frame.current += 5
      } else if (!reduce) {
        frame.current += 2.5
      }
      render(ctx, s, phaseT.current, reduce ? 0 : Math.floor(frame.current))
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      if (!raf && !hidden()) {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    }
    start()
    document.addEventListener('visibilitychange', start)
    const unsub = useStore.subscribe(start)
    return () => {
      cancelAnimationFrame(raf)
      raf = 0
      unsub()
      document.removeEventListener('visibilitychange', start)
      ctxRef.current = null
    }
  }, [])

  const status =
    trip ? `Away at the ${placeById(trip.placeId).name}` :
    activity === 'job' ? 'At the part-time job' :
    phase === 'idle' ? 'Between projects' :
    phase === 'ready' ? 'Ready to pitch' :
    phase === 'submitted' ? 'Waiting for the poll' :
    activity === 'work' ? (stamina <= 0 ? 'Exhausted' : 'Drawing') : 'Resting'
  const showPaused = !running && (phase === 'drawing' || phase === 'submitted' || activity === 'job' || !!trip)

  return (
    <div className="scene-wrap" role="group" aria-label="Studio">
      <canvas ref={ref} width={W} height={H} role="img" aria-label="Pixel-art studio scene" />
      <div className="scene-overlay">
        <span className="chip">{status}</span>
      </div>
      {showPaused && (
        <div className="scene-paused" aria-hidden="true"><span>Paused</span></div>
      )}
    </div>
  )
}
