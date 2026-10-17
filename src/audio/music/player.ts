// The music player (0.13.0): plays the catalogue's tracks into the music bus, one after another with a crackle break
// between, chained on the audio clock by a look-ahead scheduler (a 50 ms timer queues the next 200 ms). It owns three
// lifetimes: the chain (the mixer, built at the first start and kept), the session (the wobble LFOs and the crackle,
// opened at a start and released on the tick the timer goes) and the Loop (one per start: seven fade gains, one per
// instrument, and the segments it plays). Only the playing Loop chains to its next segment; a stopped Loop fades out
// on whatever it was playing. Every time comes from `ctx.currentTime`, every timer from the injected `Timers`. A mood
// change or a pin crossfades to a fresh Loop (the old one fading out, at most two at once); a calm moment glides the
// mix and, once settled, stops queuing drums; a season change waits for the next pick.
import { holdAt } from '../synth'
import { eventsInWindow } from './arrange'
import { buildChain, openSession, playVoice } from './instruments'
import type { Chain, Session } from './instruments'
import { levelsFor } from './levels'
import { breakSeconds, pickTrack } from './playlist'
import type { CompiledTrack } from './score'
import { CATALOG } from './tracks'
import type { Catalog } from './tracks'
import { PART_OF } from './types'
import type { Inst, MusicScene, Voice, VoiceFn } from './types'

/** The timer functions the scheduler uses. Injected, so tests drive time by hand. */
export interface Timers {
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(id: unknown): void
}

/** A start's fade-in, and the crackle gate's, in seconds. */
export const FADE_IN = 2
/** A stop's fade-out, in seconds. */
export const FADE_OUT = 0.4
/** A crossfade between two Loops, in seconds. */
export const XFADE = 1.5
/** How far ahead of the clock each tick queues notes, in seconds. */
export const LOOK_AHEAD = 0.2
/** The scheduler's period in ms. */
export const TICK_MS = 50
/** The most Loops fading out at once; an extra one is cut short. */
export const MAX_FADING = 2
/** How long a calm moment lets the drums play on before they stop being scheduled, in seconds. */
export const CALM_SETTLE = 3
/** The break between two plays of a pinned track, in seconds. */
export const PIN_BREAK = 2
/** A Loop younger than this, in seconds, is replaced with a short fade rather than crossfaded. */
export const YOUNG = 0.5

/** The time constant of the glide into calm, in seconds. */
export const CALM_TAU = 0.8
/** The time constant of the glide out of calm, and of every other level change, in seconds. */
export const WAKE_TAU = 0.4

/** Every segment chain in one tick stops after this many, so a degenerate catalogue cannot spin. */
const MAX_SEGMENTS_PER_TICK = 8
/** A Loop cut short (too young to crossfade, or one fading too many) reaches 0 over this, in seconds. */
const CUT = 0.05

const INSTS = Object.keys(PART_OF) as Inst[]

/** One stretch of a Loop's timeline: a track from its top, or a crackle break. Times are context time. */
interface Segment {
  kind: 'track' | 'break'
  /** The track's id; a break has none. */
  track?: string
  /** The pick counter at the segment's creation: the arranger's pass, so each play of a track varies. */
  pass: number
  origin: number
  end: number
}

/** One start of the music: its fades, the segment it is on, and the voices it has queued. */
interface Loop {
  fades: Record<Inst, GainNode>
  seg: Segment
  /** Context time up to which notes are queued. */
  scheduledUntil: number
  /** When its fade-out reaches 0; Infinity while it plays. */
  endsAt: number
  voices: Voice[]
  /** Context time it was opened. */
  born: number
}

/** What the music does. */
export interface MusicPlayer {
  /** Starts a track now, fading in over 2 s. A no-op while playing; while a stop fades out, a fresh Loop starts. */
  start(): void
  /**
   * Fades every Loop to 0 over 0.4 s from wherever it is; voices, the session and the timer go on the first tick after.
   * A no-op while stopped. In a suspended context (its clock frozen) the fade finishes at once at the next tick.
   */
  stop(): void
  /**
   * Sets the scene. While playing: a mood change crossfades to the new pool (unless pinned), calm glides the mix and
   * stops the drums once settled, and a season change is read at the next pick. While stopped it is only stored.
   */
  setScene(s: MusicScene): void
  /**
   * Sets a track every pick plays (with 2 s breaks), crossfading to it now while playing, or null to pick from the
   * scene's pool again at the next pick.
   */
  pin(id: string | null): void
  /** Stops the timer. The context's owner closes the context, which silences every node. */
  dispose(): void
}

/** The player's seed, and the hooks tests use: the scene to start in, the catalogue, the voice. */
export interface PlayerOptions {
  seed: number
  /** The title screen in spring, out of calm, when left out. */
  scene?: MusicScene
  /** The real tracks when left out. */
  catalog?: Catalog
  /** The real instruments when left out. */
  voice?: VoiceFn
}

/** Plays the music into `dest` (the music bus) in context time, scheduled by a timer from `timers`. */
export function createMusicPlayer(ctx: BaseAudioContext, dest: AudioNode, timers: Timers, o: PlayerOptions): MusicPlayer {
  const { seed } = o
  const catalog = o.catalog ?? CATALOG
  const voice = o.voice ?? playVoice
  let scene: MusicScene = o.scene ?? { mood: 'title', season: 'spring', calm: false }
  let pinned: string | null = null
  let counter = 0
  let recent: string[] = []
  /** When calm last turned on. */
  let calmSince = 0

  let chain: Chain | null = null
  let session: Session | null = null
  let playing: Loop | null = null
  let fading: Loop[] = []
  let timer: { id: unknown } | null = null

  /** The next track: the pin, else a pick from the scene's pool that avoids the last two. */
  function pick(): string {
    counter++
    const id = pinned ?? pickTrack(catalog.poolFor(scene), recent, seed, counter)
    recent = [...recent, id].slice(-2)
    return id
  }

  /** A track segment from `origin`, gliding the chain to its levels as it starts. */
  function trackSegment(origin: number): Segment {
    const id = pick()
    const t = catalog.compiled(id)
    chain?.setLevels(levelsFor(scene, t), WAKE_TAU, origin)
    return { kind: 'track', track: id, pass: counter, origin, end: origin + t.seconds }
  }

  /** The segment after `seg`, starting at its end or, after a stall, at `from`. */
  function nextSegment(seg: Segment, from: number): Segment {
    const origin = Math.max(seg.end, from)
    if (seg.kind === 'break') return trackSegment(origin)
    const gap = pinned !== null ? PIN_BREAK : breakSeconds(seed, counter)
    return { kind: 'break', pass: counter, origin, end: origin + gap }
  }

  function queue(loop: Loop, t: CompiledTrack, seg: Segment, a: number, b: number, now: number) {
    // A settled calm moment queues no drums (their buses are at 0 by then anyway).
    const quiet = scene.calm && now - calmSince > CALM_SETTLE
    for (const e of eventsInWindow(t, seg.pass, seed, a - seg.origin, b - seg.origin)) {
      if (quiet && PART_OF[e.inst] === 'drums') continue
      loop.voices.push(voice(ctx, loop.fades[e.inst], { ...e, at: seg.origin + e.at }, t.lead))
    }
  }

  /**
   * Queues the Loop's notes from where it left off to the look-ahead (or its fade's end), split at segment
   * boundaries. Never from before `now`: a scheduler that fell behind skips the missed notes rather than playing them
   * late in a burst. Only the playing Loop moves on to a next segment.
   */
  function advance(loop: Loop, now: number) {
    const from = Math.max(loop.scheduledUntil, now)
    const to = Math.min(now + LOOK_AHEAD, loop.endsAt)
    if (to > from) {
      for (let i = 0; i < MAX_SEGMENTS_PER_TICK; i++) {
        const seg = loop.seg
        const a = Math.max(from, seg.origin)
        const b = Math.min(to, seg.end)
        if (seg.kind === 'track' && seg.track !== undefined && b > a) queue(loop, catalog.compiled(seg.track), seg, a, b, now)
        if (to < seg.end || loop !== playing) break
        loop.seg = nextSegment(seg, from)
      }
      loop.scheduledUntil = to
    }
    loop.voices = loop.voices.filter((v) => v.end > now)
  }

  /** Silences a faded Loop for good: stops the voices still sounding and unhooks its fades. */
  function finish(loop: Loop, now: number) {
    for (const v of loop.voices) if (v.end > now) v.stop(now)
    loop.voices = []
    for (const inst of INSTS) loop.fades[inst].disconnect()
  }

  /** Lets the timer go and the session with it, the crackle gate left shut. */
  function release(now: number) {
    if (timer) timers.clearInterval(timer.id)
    timer = null
    session?.stop(now)
    session = null
    if (chain) {
      holdAt(chain.gate.gain, now)
      chain.gate.gain.setValueAtTime(0, now)
    }
  }

  function tick() {
    const now = ctx.currentTime
    if (playing) advance(playing, now)
    // A suspended context's clock is frozen, so its fades would never end; nothing is heard from them anyway.
    const frozen = ctx.state !== 'running'
    fading = fading.filter((loop) => {
      if (frozen || now >= loop.endsAt) {
        finish(loop, now)
        return false
      }
      advance(loop, now)
      return true
    })
    if (!playing && fading.length === 0) release(now)
  }

  /** Ramps a param from where it is at `t` to `value` by `end`. */
  function rampFrom(param: AudioParam, t: number, value: number, end: number) {
    holdAt(param, t)
    param.linearRampToValueAtTime(value, end)
  }

  /** Brings a Loop's fade-out forward to reach 0 by `end`; one already ending sooner is left alone. */
  function fadeOut(loop: Loop, now: number, end: number) {
    if (loop.endsAt <= end) return
    for (const inst of INSTS) rampFrom(loop.fades[inst].gain, now, 0, end)
    loop.endsAt = end
  }

  /** Cuts the oldest fading Loops short until at most `MAX_FADING` still have a full fade to run. */
  function capFading(now: number) {
    const long = fading.filter((loop) => loop.endsAt > now + CUT)
    for (let i = 0; i < long.length - MAX_FADING; i++) fadeOut(long[i], now, now + CUT)
  }

  /** A new playing Loop: seven fades rising 0 to 1 over `fadeIn`, on a track from now. */
  function openLoop(c: Chain, now: number, fadeIn: number): Loop {
    const fades = {} as Record<Inst, GainNode>
    for (const inst of INSTS) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(1, now + fadeIn)
      g.connect(c.input[inst])
      fades[inst] = g
    }
    return { fades, seg: trackSegment(now), scheduledUntil: now, endsAt: Number.POSITIVE_INFINITY, voices: [], born: now }
  }

  /**
   * Replaces the playing Loop with a fresh one on the next pick, fading in over `XFADE` as the old fades out over it
   * (or over 50 ms when the old is under `YOUNG`), cutting a break short.
   */
  function crossfade(c: Chain, old: Loop) {
    const now = ctx.currentTime
    fadeOut(old, now, now + (now - old.born < YOUNG ? CUT : XFADE))
    fading.push(old)
    playing = openLoop(c, now, XFADE)
    advance(playing, now)
    capFading(now)
  }

  /** The track the playing Loop is on, or null in a break (or stopped). */
  function currentTrack(): CompiledTrack | null {
    const seg = playing?.seg
    return seg?.kind === 'track' && seg.track !== undefined ? catalog.compiled(seg.track) : null
  }

  return {
    start() {
      if (playing) return
      const now = ctx.currentTime
      chain ??= buildChain(ctx, dest, seed, levelsFor(scene, null))
      // A start during a stop's fade keeps the session it would have released: a second would double the wobble.
      session ??= openSession(ctx, chain, seed, now)
      rampFrom(chain.gate.gain, now, 1, now + FADE_IN)
      playing = openLoop(chain, now, FADE_IN)
      advance(playing, now)
      timer ??= { id: timers.setInterval(tick, TICK_MS) }
    },

    stop() {
      if (!playing || !chain) return
      const now = ctx.currentTime
      const end = now + FADE_OUT
      for (const loop of [playing, ...fading]) fadeOut(loop, now, end)
      rampFrom(chain.gate.gain, now, 0, end)
      fading.push(playing)
      playing = null
      capFading(now)
    },

    setScene(s) {
      const prev = scene
      if (s.mood === prev.mood && s.season === prev.season && s.calm === prev.calm) return
      scene = s
      const now = ctx.currentTime
      if (s.calm && !prev.calm) calmSince = now
      // A season change waits for the next pick; it moves no level.
      if (!playing || !chain || (s.mood === prev.mood && s.calm === prev.calm)) return
      if (s.mood !== prev.mood && pinned === null) {
        crossfade(chain, playing)
        return
      }
      const tau = s.calm && !prev.calm ? CALM_TAU : WAKE_TAU
      const l = levelsFor(s, currentTrack())
      chain.setLevels(l, tau)
      // A track queued ahead but not yet begun glides at its start: that glide must carry the new scene too.
      const seg = playing.seg
      if (seg.kind === 'track' && seg.origin > now) chain.setLevels(l, tau, seg.origin)
    },

    pin(id) {
      pinned = id
      if (id !== null && playing && chain) crossfade(chain, playing)
    },

    dispose() {
      if (timer) timers.clearInterval(timer.id)
      timer = null
      playing = null
      fading = []
    },
  }
}
