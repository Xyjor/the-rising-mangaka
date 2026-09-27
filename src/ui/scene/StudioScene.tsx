import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getSound } from '../../audio/instance'
import { useShallow } from 'zustand/react/shallow'
import { chapterDeadline, getPhase, placeById, studioLook } from '../../sim'
import type { StudioLook } from '../../sim'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { prefersReducedMotion } from '../motion'
import { anyWalking, newActorTable, planActors, settleActors, stepActors } from './actors'
import { H, W, render } from './render'
import type { Snapshot } from './render'
import { seasonOf } from './season'
import { GREETING, PROP_FOR, visitorReasonOf } from './visitor'
import { BUBBLE_MS, Bubble } from './Bubble'
import { sceneToCss, useSceneRect } from './sceneAnchor'
import { Pops, popsFor } from './Pops'
import type { PopKind } from './Pops'
import '../../styles/scene.css'
import type { Actor } from './actors'
import { NO_EQUIPMENT, SHOWN_TROPHIES, ownedFlags } from './studioArt'

/** Frame budget in ms: 24 fps for the 320x180 sprite scene. */
const STEP_MS = 41
/** Under reduced motion only the sky crossfade advances, once a second. */
const STEP_MS_REDUCED = 1000
/** The longest step the actors take at once: a stalled tab does not teleport them. */
const MAX_ACTOR_STEP_MS = 250

const EMPTY: never[] = []
/** No game: the bare apartment. One module-level object, so the selector below returns the same thing every call. */
const NO_LOOK: StudioLook = {
  tier: 'apartment', desks: 1, equipment: EMPTY, volumes: 0, animePoster: false, trophies: EMPTY,
}

/** A bubble sits just above an actor's head: `half` is half the sprite's width (both 24 wide). */
function placeBubble(el: HTMLDivElement | null, rect: { width: number; height: number }, a: Actor, half: number) {
  if (!el) return
  const p = sceneToCss(rect, a.x + half, a.y - 2)
  el.style.left = `${p.left}px`
  el.style.top = `${p.top}px`
}

/** Pop sounds step up by kind: money, fans, xp. */
const POP_PITCH: Record<PopKind, number> = { money: 0, fans: 4, xp: 7 }
/** Pops rise from the desk while the mangaka is out of sight. */
const DESK = { x: 145, y: 96 }

const lastLogId = (g: { log: readonly { id: number }[] } | null) => (g && g.log.length ? g.log[g.log.length - 1].id : -1)

export function StudioScene({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rect = useSceneRect(wrapRef)
  const rectRef = useRef(rect)
  const mangakaBubble = useRef<HTMLDivElement>(null)
  const editorBubble = useRef<HTMLDivElement>(null)
  // bubble creation and removal is React state; their positions are written straight to the DOM after each frame
  const [line, setLine] = useState<{ id: number; text: string } | null>(null)
  const [greeting, setGreeting] = useState<string | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const frame = useRef(0)
  const reduceMotion = useRef(false)
  const lastT = useRef(-1)
  const lastFrame = useRef(-1)
  const lastSnap = useRef<Snapshot | null>(null)
  // the characters: planned from the game below, walked every loop step, read by render
  // (one table for the component's life, mutated in place: useState's lazy initialiser, so render may read it)
  const [actors] = useState(newActorTable)
  const saveLoads = useStore((s) => s.saveLoads)
  const reason = useStore((s) => visitorReasonOf(s.game))
  // Walks everyone for dtMs; the editor coming to a stand is an arrival, and knocks (never in a read-only tab or while
  // the window is hidden). A settle (mount, loaded save) is not a step, so it never knocks.
  const advance = useCallback((dtMs: number, reduced: boolean) => {
    const before = actors.editor.state
    stepActors(actors, dtMs, reduced)
    if (before !== 'standing' && actors.editor.state === 'standing') {
      const st = useStore.getState()
      const why = visitorReasonOf(st.game)
      if (why !== 'none') setGreeting(GREETING[why])
      if (!st.readOnly && !st.windowHidden) getSound().play('knock')
    }
  }, [actors])
  const placeBubbles = useCallback(() => {
    placeBubble(mangakaBubble.current, rectRef.current, actors.mangaka, 12)
    placeBubble(editorBubble.current, rectRef.current, actors.editor, 12)
  }, [actors])

  const phase = useStore((s) => (s.game ? getPhase(s.game) : 'idle'))
  const activity = useStore((s) => s.game?.activity ?? 'rest')
  const progress = useStore((s) => (s.game?.project ? s.game.project.pagesDone / s.game.project.pagesTarget : 0))
  const stamina = useStore((s) => s.game?.player.stamina ?? 100)
  const trip = useStore((s) => s.game?.trip ?? null)
  const assistants = useStore((s) => s.game?.assistants ?? EMPTY)
  const season = useStore((s) => (s.game ? seasonOf(s.game.day) : 'spring'))
  // the running serial's chapter cannot make its deadline: the seated mangaka panics now and then
  const late = useStore((s) => (s.game ? chapterDeadline(s.game)?.status === 'late' : false))
  // studioLook builds a new object every call; useShallow hands back the previous one while every field is the same
  // (primitives, and the owned and awards lists by reference), so the snapshot is rebuilt only when the studio changes.
  const look = useStore(useShallow((s) => (s.game ? studioLook(s.game) : NO_LOOK)))
  // a placeholder until the effect below fills it in, which it does before the loop's first frame
  const snap = useRef<Snapshot>({
    phase, activity, progress, stamina, running, away: !!trip, assistants: [], season,
    tier: 'apartment', owned: NO_EQUIPMENT, volumes: 0, animePoster: false, trophies: 0,
    visitor: 'none', visitorProp: 'none', late, actors: actors,
  })
  useEffect(() => {
    snap.current = {
      phase, activity, progress, stamina, running, away: !!trip,
      assistants: assistants.map((a) => ({ look: a.look, stamina: a.stamina })),
      season,
      // the studio as flags and counts, so render never walks a list per frame
      tier: look.tier, owned: ownedFlags(look.equipment), volumes: look.volumes, animePoster: look.animePoster,
      trophies: Math.min(SHOWN_TROPHIES, look.trophies.length),
      visitor: reason === 'none' ? 'none' : 'editor', visitorProp: PROP_FOR[reason], late, actors: actors,
    }
    planActors(actors, snap.current)
    // Under reduced motion the loop only repaints once a second, so state changes repaint at once.
    // ctxRef is still null on first mount (this effect runs before the loop effect); the loop's first frame covers it.
    if (reduceMotion.current && ctxRef.current) {
      advance(0, true)
      const t = useClock.getState().t
      render(ctxRef.current, snap.current, t, 0)
      placeBubbles()
      lastT.current = t
      lastFrame.current = 0
      lastSnap.current = snap.current
    }
  }, [actors, advance, placeBubbles, phase, activity, progress, stamina, running, trip, assistants, season, look, reason, late])

  // A new daily line (info, not a toast, today, not from a loaded save) is said by the mangaka, when they are home.
  useEffect(() => {
    let seen = lastLogId(useStore.getState().game)
    let loads = useStore.getState().saveLoads
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = useStore.subscribe((st) => {
      // the editor's greeting lasts as long as the visit
      if (visitorReasonOf(st.game) === 'none') setGreeting(null)
      const id = lastLogId(st.game)
      const loaded = st.saveLoads !== loads
      if (id === seen && !loaded) return
      seen = id
      loads = st.saveLoads
      const g = st.game
      if (loaded || !g || id < 0) return
      const e = g.log[g.log.length - 1]
      const m = actors.mangaka
      const absent = !!g.trip || g.activity === 'job' ||
        m.state === 'away' || m.state === 'hidden' || m.goal === 'away' || m.goal === 'hidden'
      if (e.kind !== 'info' || e.toast || e.day !== g.day || absent) return
      clearTimeout(timer)
      setLine({ id: e.id, text: e.text })
      timer = setTimeout(() => setLine(null), BUBBLE_MS)
    })
    return () => { unsub(); clearTimeout(timer) }
  }, [actors])

  // Numbers pop from the mangaka (or the desk when they are out of sight); each pop plays its pitch, never in a
  // read-only tab or while the window is hidden.
  const popAnchor = useCallback(() => {
    const m = actors.mangaka
    return m.state === 'away' || m.state === 'hidden' ? DESK : { x: m.x + 12, y: m.y - 4 }
  }, [actors])
  useEffect(() => useStore.subscribe((next, prev) => {
    if (next.windowHidden) return
    for (const p of popsFor(prev, next, DESK)) getSound().play('pop', { pitch: POP_PITCH[p.kind] })
  }), [])

  // placed at once when a bubble appears or the wrap resizes, then after every painted frame
  useLayoutEffect(() => {
    rectRef.current = rect
    placeBubbles()
  }, [placeBubbles, rect, line, greeting])

  // On mount and on a loaded save everyone is simply in place: nobody walks in. (After the plan above: effects run in
  // order.) The repaint follows on the loop's next step, which sees the changed actors through lastSnap being reset.
  useEffect(() => {
    settleActors(actors)
    lastSnap.current = null
  }, [actors, saveLoads])

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
    // The scene keeps animating behind a modal (the backdrop is translucent); it only sleeps when the tab is hidden.
    const hidden = () => document.hidden
    const loop = (now: number) => {
      if (hidden()) { raf = 0; return }
      if (now - last < step) { raf = requestAnimationFrame(loop); return }
      const dt = now - last
      last = now
      const s = snap.current
      // the actors walk whether or not the clock runs: the editor must arrive while the game waits on them
      const moving = anyWalking(actors)
      advance(Math.min(dt, MAX_ACTOR_STEP_MS), reduce)
      if (!reduce) frame.current += s.running ? 2.5 : 1.25
      const t = useClock.getState().t
      const f = reduce ? 0 : Math.floor(frame.current)
      if (moving || t !== lastT.current || f !== lastFrame.current || s !== lastSnap.current) {
        render(ctx, s, t, f)
        placeBubbles()
        lastT.current = t
        lastFrame.current = f
        lastSnap.current = s
      }
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
  }, [actors, advance, placeBubbles])

  const status =
    trip ? `Away at the ${placeById(trip.placeId).name}` :
    activity === 'job' ? 'At the part-time job' :
    phase === 'idle' ? 'Between projects' :
    phase === 'ready' ? 'Ready to pitch' :
    phase === 'submitted' ? 'Waiting for the poll' :
    activity === 'work' ? (stamina <= 0 ? 'Exhausted' : 'Drawing') : 'Resting'
  const showPaused = !running && (phase === 'drawing' || phase === 'submitted' || activity === 'job' || !!trip)

  return (
    <div ref={wrapRef} className="scene-wrap" role="group" aria-label="Studio">
      <canvas ref={ref} width={W} height={H} role="img" aria-label="Pixel-art studio scene" />
      <div className="scene-overlay">
        <span className="chip">{status}</span>
      </div>
      {line && <Bubble key={line.id} ref={mangakaBubble} who="mangaka" text={line.text} />}
      <Pops rect={rect} anchor={popAnchor} />
      {greeting && <Bubble ref={editorBubble} who="editor" text={greeting} />}
      {showPaused && (
        <div className="scene-paused" aria-hidden="true"><span>Paused</span></div>
      )}
    </div>
  )
}
