import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getSound } from '../../audio/instance'
import { useShallow } from 'zustand/react/shallow'
import { chapterDeadline, getPhase, placeById, studioLook } from '../../sim'
import type { StudioLook } from '../../sim'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { prefersReducedMotion } from '../motion'
import { anyWalking, editorWalksIn, newActorTable, planActors, settleActors, stepActors } from './actors'
import { headCentre, headTop, newCastPlay, resumeCast, settleCast, stepCast } from './castPlay'
import type { CastInput } from './castPlay'
import { reactionFor } from './reactions'
import type { ReactionCue } from './reactions'
import { ANIMS } from './rig/anims'
import type { AnimId } from './rig/anims'
import { H, W, render, workingOf } from './render'
import { onSceneImageLoad, sceneImages } from './sceneImages'
import type { Snapshot } from './render'
import { seasonOf } from './season'
import { NO_STORY, storyLook } from './story'
import { GREETING, PROP_FOR, sceneReasonOf, visitorReasonOf } from './visitor'
import { BUBBLE_MS, Bubble } from './Bubble'
import { sceneToCss, useSceneRect } from './sceneAnchor'
import { Pops, popsFor } from './Pops'
import type { PopKind } from './Pops'
import { CHEER_MS, cheersFor } from './mood'
import '../../styles/scene.css'
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

/**
 * A dev build's `?rig=<animation>` plays that animation over every base of its posture whenever nothing else plays, so
 * an art task sees its moments and reactions in the running scene. A production build never reads it.
 */
const DEV_RIG = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('rig') : null
const PREVIEW: AnimId | null = DEV_RIG !== null && DEV_RIG in ANIMS ? (DEV_RIG as AnimId) : null

/** Reaction cues count up for the session, so the driver takes each once. */
let cueSeq = 0

/** A bubble sits just above a head: (x, y) is the scene point its tail points at. */
function placeBubble(el: HTMLDivElement | null, rect: { width: number; height: number }, x: number, y: number) {
  if (!el) return
  const p = sceneToCss(rect, x, y)
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
  // a happy mood for CHEER_MS after a fans or level pop (mood.ts); the timer is ref-held so it survives re-renders
  // and is cleared on unmount
  const [cheer, setCheer] = useState(false)
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(cheerTimer.current), [])
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const frame = useRef(0)
  const reduceMotion = useRef(false)
  const lastT = useRef(-1)
  const lastFrame = useRef(-1)
  const lastSnap = useRef<Snapshot | null>(null)
  // the characters: planned from the game below, walked every loop step, read by render
  // (one table for the component's life, mutated in place: useState's lazy initialiser, so render may read it)
  const [actors] = useState(newActorTable)
  // the cast driver's tracks (castPlay.ts), mutated in place like the table, on the scene clock: the loop's steps
  // summed, so it never jumps across a stretch the window was hidden
  const [play] = useState(newCastPlay)
  const sceneMs = useRef(0)
  // the newest reaction cue (reactions.ts): set by the subscription below, handed to the driver through the snapshot
  const [reaction, setReaction] = useState<ReactionCue | null>(null)
  // the generated room and prop images (built once for the app, each drawn once it has loaded)
  const [art] = useState(sceneImages)
  const saveLoads = useStore((s) => s.saveLoads)
  // the tutorial keeps the editor at the spot when nothing else brings them (visitor.ts)
  const reason = useStore((s) => sceneReasonOf(s.game, s.tutorialStep))
  // the guide's bubble speaks for the editor while it is on screen (not while a step waits for its control)
  const guided = useClock((c) => c.guideVisible)
  // Walks everyone for dtMs; the editor coming to a stand is an arrival, and knocks (never in a read-only tab or while
  // the window is hidden). A settle (mount, loaded save) is not a step, so it never knocks.
  const advance = useCallback((dtMs: number, reduced: boolean) => {
    const before = actors.editor.state
    stepActors(actors, dtMs, reduced)
    if (before !== 'standing' && actors.editor.state === 'standing') {
      const st = useStore.getState()
      const why = sceneReasonOf(st.game, st.tutorialStep)
      if (GREETING[why]) setGreeting(GREETING[why])
      if (!st.readOnly && !st.windowHidden) getSound().play('knock')
    }
  }, [actors])
  // the mangaka's over the rig head's centre (its head top and centre per state), the editor's over his 24-wide frame
  const placeBubbles = useCallback(() => {
    const m = actors.mangaka
    const e = actors.editor
    placeBubble(mangakaBubble.current, rectRef.current, m.x + headCentre(m.state), m.y + headTop(m.state) - 2)
    placeBubble(editorBubble.current, rectRef.current, e.x + 12, e.y - 2)
  }, [actors])
  // the driver's input, one object filled in place each step: nothing allocated per frame
  const castIn = useRef<CastInput>({ day: 0, working: false, late: false, ready: false, stamina: 100, assistants: EMPTY, reaction: null, preview: PREVIEW })
  const fillCast = useCallback((s: Snapshot): CastInput => {
    const c = castIn.current
    c.day = useStore.getState().game?.day ?? 0
    c.working = workingOf(s)
    c.late = s.late
    c.ready = s.phase === 'ready'
    c.stamina = s.stamina
    c.assistants = s.assistants
    c.reaction = s.reaction
    return c
  }, [])

  const phase = useStore((s) => (s.game ? getPhase(s.game) : 'idle'))
  const activity = useStore((s) => s.game?.activity ?? 'rest')
  const progress = useStore((s) => (s.game?.project ? s.game.project.pagesDone / s.game.project.pagesTarget : 0))
  const stamina = useStore((s) => s.game?.player.stamina ?? 100)
  const level = useStore((s) => s.game?.player.level ?? 1)
  const trip = useStore((s) => s.game?.trip ?? null)
  const assistants = useStore((s) => s.game?.assistants ?? EMPTY)
  const season = useStore((s) => (s.game ? seasonOf(s.game.day) : 'spring'))
  // the running serial's chapter cannot make its deadline: the seated mangaka panics now and then
  const late = useStore((s) => (s.game ? chapterDeadline(s.game)?.status === 'late' : false))
  // studioLook builds a new object every call; useShallow hands back the previous one while every field is the same
  // (primitives, and the owned and awards lists by reference), so the snapshot is rebuilt only when the studio changes.
  const look = useStore(useShallow((s) => (s.game ? studioLook(s.game) : NO_LOOK)))
  // the story props' inputs (the deadline, the serial's cover, the last poll, the fans): primitives, so useShallow keeps
  // the previous object until one of them changes
  const story = useStore(useShallow((s) => storyLook(s.game)))
  // a placeholder until the effect below fills it in, which it does before the loop's first frame
  const snap = useRef<Snapshot>({
    phase, activity, progress, stamina, level, running, away: !!trip, assistants: [], season,
    tier: 'apartment', owned: NO_EQUIPMENT, volumes: 0, animePoster: false, trophies: 0,
    visitor: 'none', visitorProp: 'none', late, cheer, reaction, ...NO_STORY, actors: actors,
  })
  useEffect(() => {
    snap.current = {
      phase, activity, progress, stamina, level, running, away: !!trip,
      assistants: assistants.map((a) => ({ look: a.look, stamina: a.stamina })),
      season,
      // the studio as flags and counts, so render never walks a list per frame
      tier: look.tier, owned: ownedFlags(look.equipment), volumes: look.volumes, animePoster: look.animePoster,
      trophies: Math.min(SHOWN_TROPHIES, look.trophies.length),
      visitor: reason === 'none' ? 'none' : 'editor', visitorProp: PROP_FOR[reason], late, cheer, reaction, ...story,
      actors: actors,
    }
    planActors(actors, snap.current)
    // Under reduced motion the loop only repaints once a second, so state changes repaint at once.
    // ctxRef is still null on first mount (this effect runs before the loop effect); the loop's first frame covers it.
    if (reduceMotion.current && ctxRef.current) {
      advance(0, true)
      stepCast(play, actors, fillCast(snap.current), sceneMs.current, true)
      const t = useClock.getState().t
      render(ctxRef.current, snap.current, t, 0, art)
      placeBubbles()
      lastT.current = t
      lastFrame.current = 0
      lastSnap.current = snap.current
    }
  }, [actors, advance, art, fillCast, placeBubbles, play, phase, activity, progress, stamina, level, running, trip, assistants, season, look, reason, late, cheer, reaction, story])

  // A new daily line (info, not a toast, today, not from a loaded save) is said by the mangaka, when they are home.
  useEffect(() => {
    let seen = lastLogId(useStore.getState().game)
    let loads = useStore.getState().saveLoads
    let visit = sceneReasonOf(useStore.getState().game, useStore.getState().tutorialStep)
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = useStore.subscribe((st) => {
      // the editor's greeting lasts as long as the visit
      if (visitorReasonOf(st.game) === 'none') setGreeting(null)
      // an editor already standing there for the tutorial who now has a real reason says it (no walk, so no arrival)
      const why = sceneReasonOf(st.game, st.tutorialStep)
      if (why !== visit) {
        if (visit === 'tutorial' && GREETING[why] && actors.editor.state === 'standing') setGreeting(GREETING[why])
        visit = why
      }
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
    if (m.state === 'away' || m.state === 'hidden') return DESK
    return { x: m.x + headCentre(m.state), y: m.y + headTop(m.state) - 4 }
  }, [actors])
  useEffect(() => useStore.subscribe((next, prev) => {
    if (next.windowHidden) return
    const pops = popsFor(prev, next, DESK)
    for (const p of pops) getSound().play('pop', { pitch: POP_PITCH[p.kind] })
    if (cheersFor(pops)) {
      setCheer(true)
      clearTimeout(cheerTimer.current)
      cheerTimer.current = setTimeout(() => setCheer(false), CHEER_MS)
    }
  }), [])
  // The cast reacts to a poll, a level-up, a late chapter or a missed issue (reactions.ts), never while the window is
  // hidden: each cue a new id, so every character takes it once.
  useEffect(() => useStore.subscribe((next, prev) => {
    if (next.windowHidden) return
    const kind = reactionFor(prev, next)
    if (kind) setReaction({ id: ++cueSeq, kind })
  }), [])

  // placed at once when a bubble appears or the wrap resizes, then after every painted frame
  useLayoutEffect(() => {
    rectRef.current = rect
    placeBubbles()
  }, [placeBubbles, rect, line, greeting, guided])

  // On mount and on a loaded save everyone is simply in place: nobody walks in, except the editor opening a new
  // career's tutorial (step 0 only resumes on a fresh career), who arrives and knocks. (After the plan above: effects
  // run in order.) The repaint follows on the loop's next step, which sees the changed actors through lastSnap being
  // reset.
  useEffect(() => {
    settleActors(actors)
    const st = useStore.getState()
    if (st.tutorialStep === 0 && sceneReasonOf(st.game, 0) === 'tutorial') editorWalksIn(actors)
    // the cast on its base loops from now: no transition, the waiting cue taken as seen
    settleCast(play, actors, fillCast(snap.current), sceneMs.current)
    lastSnap.current = null
  }, [actors, fillCast, play, saveLoads])

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
      sceneMs.current += dt
      stepCast(play, actors, fillCast(s), sceneMs.current, reduce)
      if (!reduce) frame.current += s.running ? 2.5 : 1.25
      const t = useClock.getState().t
      const f = reduce ? 0 : Math.floor(frame.current)
      if (moving || t !== lastT.current || f !== lastFrame.current || s !== lastSnap.current) {
        render(ctx, s, t, f, art)
        placeBubbles()
        lastT.current = t
        lastFrame.current = f
        lastSnap.current = s
      }
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      if (!raf && !hidden()) {
        // a stretch the loop sat stopped: every transition and moment jumps to its end, each base going on from now
        resumeCast(play, sceneMs.current)
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    }
    start()
    document.addEventListener('visibilitychange', start)
    const unsub = useStore.subscribe(start)
    // an image that finishes loading shows on the next step: forget the last painted snapshot so the loop repaints
    const unsubArt = onSceneImageLoad(() => { lastSnap.current = null; start() })
    return () => {
      cancelAnimationFrame(raf)
      raf = 0
      unsub()
      unsubArt()
      document.removeEventListener('visibilitychange', start)
      ctxRef.current = null
    }
  }, [actors, advance, art, fillCast, placeBubbles, play])

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
      {greeting && !guided && <Bubble ref={editorBubble} who="editor" text={greeting} />}
      {showPaused && (
        <div className="scene-paused" aria-hidden="true"><span>Paused</span></div>
      )}
    </div>
  )
}
