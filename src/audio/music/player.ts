// The music player (0.13.0): plays the catalogue's tracks into the music bus, one after another with a crackle break
// between, chained on the audio clock by a look-ahead scheduler (a 50 ms timer queues the next 200 ms). It owns three
// lifetimes: the chain (the mixer, built at the first start and kept), the session (the wobble LFOs and the crackle,
// opened at a start and released on the tick the timer goes) and the Loop (one per start: seven fade gains, one per
// instrument, and the segments it plays). Only the playing Loop chains to its next segment; a stopped Loop fades out
// on whatever it was playing. Every time comes from `ctx.currentTime`, every timer from the injected `Timers`. The
// scene and the pin are stored here and read at each pick; their live changes (the mood crossfade, calm, the pin's
// crossfade) come later.
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

/** Every segment chain in one tick stops after this many, so a degenerate catalogue cannot spin. */
const MAX_SEGMENTS_PER_TICK = 8
/** How fast the chain glides to a track's levels as its segment starts. */
const LEVELS_TAU = 0.4

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
  /** Stores the scene the next pick reads. */
  setScene(s: MusicScene): void
  /** Stores a track every pick plays (with 2 s breaks), or null to pick from the scene's pool again. */
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

  /** A track segment from `origin`, gliding the chain to its levels. */
  function trackSegment(origin: number): Segment {
    const id = pick()
    const t = catalog.compiled(id)
    chain?.setLevels(levelsFor(scene, t), LEVELS_TAU)
    return { kind: 'track', track: id, pass: counter, origin, end: origin + t.seconds }
  }

  /** The segment after `seg`, starting at its end or, after a stall, at `from`. */
  function nextSegment(seg: Segment, from: number): Segment {
    const origin = Math.max(seg.end, from)
    if (seg.kind === 'break') return trackSegment(origin)
    const gap = pinned !== null ? PIN_BREAK : breakSeconds(seed, counter)
    return { kind: 'break', pass: counter, origin, end: origin + gap }
  }

  function queue(loop: Loop, t: CompiledTrack, seg: Segment, a: number, b: number) {
    for (const e of eventsInWindow(t, seg.pass, seed, a - seg.origin, b - seg.origin)) {
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
        if (seg.kind === 'track' && seg.track !== undefined && b > a) queue(loop, catalog.compiled(seg.track), seg, a, b)
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

  return {
    start() {
      if (playing) return
      const now = ctx.currentTime
      chain ??= buildChain(ctx, dest, seed, levelsFor(scene, null))
      // A start during a stop's fade keeps the session it would have released: a second would double the wobble.
      session ??= openSession(ctx, chain, seed, now)
      rampFrom(chain.gate.gain, now, 1, now + FADE_IN)
      const fades = {} as Record<Inst, GainNode>
      for (const inst of INSTS) {
        const g = ctx.createGain()
        g.gain.value = 0
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(1, now + FADE_IN)
        g.connect(chain.input[inst])
        fades[inst] = g
      }
      playing = { fades, seg: trackSegment(now), scheduledUntil: now, endsAt: Number.POSITIVE_INFINITY, voices: [] }
      advance(playing, now)
      timer ??= { id: timers.setInterval(tick, TICK_MS) }
    },

    stop() {
      if (!playing || !chain) return
      const now = ctx.currentTime
      const end = now + FADE_OUT
      for (const loop of [playing, ...fading]) {
        if (loop.endsAt <= end) continue
        for (const inst of INSTS) rampFrom(loop.fades[inst].gain, now, 0, end)
        loop.endsAt = end
      }
      rampFrom(chain.gate.gain, now, 0, end)
      fading.push(playing)
      playing = null
    },

    setScene(s) {
      scene = s
    },

    pin(id) {
      pinned = id
    },

    dispose() {
      if (timer) timers.clearInterval(timer.id)
      timer = null
      playing = null
      fading = []
    },
  }
}
