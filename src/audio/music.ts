// The music loop: a 64-step score (a triangle lead over a sine bass, C C Am Am F F G G) and its look-ahead scheduler,
// which queues the notes of the next 200 ms on a 50 ms timer. Each start of the loop plays through its own fade gain
// into the music bus, so fading in and out never touches the bus level that the prefs and ducking own.
import { midiToHz } from './cues'
import { holdAt } from './synth'

/** The timer functions the scheduler uses. Injected, so tests drive time by hand. */
export interface Timers {
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(id: unknown): void
}

export const MUSIC_BPM = 84
export const STEPS = 64

/** Seconds per step: an eighth note, half a beat. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / 2
}

const STEP = stepSeconds(MUSIC_BPM)
export const LOOP_SECONDS = STEPS * STEP

/** A score as MIDI note numbers and `_` rests, one per step; `|` marks the bars and is skipped. */
function parseScore(score: string): readonly (number | null)[] {
  return score.split(/\s+/).filter((t) => t !== '' && t !== '|').map((t) => (t === '_' ? null : Number(t)))
}

export const LEAD = parseScore(`
  76 _ 79 _ 81 _ 79 _ | 76 _ 74 _ 72 _ _ _ | 72 _ 76 _ 81 _ 79 _ | 76 _ _ _ _ _ _ _ |
  81 _ 84 _ 81 _ 79 _ | 76 _ 79 _ 81 _ _ _ | 79 _ 81 _ 79 _ 76 _ | 74 _ _ _ _ _ _ _
`)

/** Each chord's bass: the root on its first step, the fifth four steps later. */
const CHORD_BASS = { C: [48, 55], Am: [45, 52], F: [41, 48], G: [43, 50] } as const
const CHORDS = ['C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G'] as const
const STEPS_PER_CHORD = STEPS / CHORDS.length

export const BASS: readonly (number | null)[] = Array.from({ length: STEPS }, (_, i) => {
  const [root, fifth] = CHORD_BASS[CHORDS[Math.floor(i / STEPS_PER_CHORD)]]
  const at = i % STEPS_PER_CHORD
  return at === 0 ? root : at === 4 ? fifth : null
})

export type MusicPart = 'lead' | 'bass'

/** One note of the loop. `at` is in seconds from the first loop's origin; `dur` in seconds. */
export interface MusicNote {
  part: MusicPart
  midi: number
  at: number
  dur: number
}

/** A note lasts until the next note of its part, at most this many steps... */
const MAX_NOTE_STEPS = 4
/** ...less a gap, so repeated notes stay detached. */
const NOTE_GATE = 0.9

/** Each step's note length in seconds, counting steps to the next note of the same part across the loop's end. */
function noteLengths(line: readonly (number | null)[]): readonly number[] {
  return line.map((_, i) => {
    let gap = 1
    while (gap < STEPS && line[(i + gap) % STEPS] === null) gap++
    return Math.min(gap, MAX_NOTE_STEPS) * STEP * NOTE_GATE
  })
}

const PARTS = [
  { part: 'lead', line: LEAD, lengths: noteLengths(LEAD) },
  { part: 'bass', line: BASS, lengths: noteLengths(BASS) },
] as const

/**
 * The notes starting in [from, to), in seconds from the first loop's origin, lead before bass on a shared step. The
 * loop repeats forever, so a window past LOOP_SECONDS returns the later loops' notes at their own times.
 */
export function eventsInWindow(from: number, to: number): MusicNote[] {
  const notes: MusicNote[] = []
  const last = Math.ceil(to / STEP)
  for (let n = Math.max(0, Math.floor(from / STEP)); n <= last; n++) {
    // Both window edges are tested against the same product, so back-to-back windows share no note and miss none.
    const at = n * STEP
    if (at < from || at >= to) continue
    const i = n % STEPS
    for (const { part, line, lengths } of PARTS) {
      const midi = line[i]
      if (midi !== null) notes.push({ part, midi, at, dur: lengths[i] })
    }
  }
  return notes
}

/** How the scheduler runs: a tick this often queues every note due before the tick's time plus the look-ahead. */
const TICK_MS = 50
const LOOK_AHEAD = 0.2
const FADE_IN = 2
const FADE_OUT = 0.4

const VOICES = {
  lead: { wave: 'triangle', peak: 0.05 },
  bass: { wave: 'sine', peak: 0.07 },
} as const satisfies Record<MusicPart, { wave: OscillatorType; peak: number }>
/** Note envelope: rise to the peak, fall to half of it, then release to silence by the note's end. */
const ATTACK = 0.01
const SUSTAIN = 0.5
const RELEASE = 0.06
/** A note's oscillator stops this long after its envelope reaches 0. */
const STOP_AFTER = 0.02

interface Sounding {
  osc: OscillatorNode
  end: number
}

/** One start of the loop: its own origin, fade and schedule. */
interface Loop {
  origin: number
  fade: GainNode
  /** Context time up to which notes are queued. */
  scheduledUntil: number
  /** When its fade out reaches 0; Infinity while it plays. */
  endsAt: number
  notes: Sounding[]
}

export interface MusicPlayer {
  /** Starts the loop from its first step, fading in over 2 s. A no-op while it plays; while it fades out, restarts. */
  start(): void
  /** Fades the loop out over 0.4 s from wherever its fade is. A no-op when it is not playing. */
  stop(): void
  /** Stops the timer. The context's owner closes the context, which silences every node. */
  dispose(): void
}

/** Plays the loop into `dest` (the music bus) in context time, scheduled by a timer from `timers`. */
export function createMusicPlayer(ctx: BaseAudioContext, dest: AudioNode, timers: Timers): MusicPlayer {
  let playing: Loop | null = null
  let fading: Loop[] = []
  let timer: { id: unknown } | null = null

  function playNote(loop: Loop, note: MusicNote) {
    const voice = VOICES[note.part]
    const start = loop.origin + note.at
    const end = start + note.dur

    const env = ctx.createGain()
    env.gain.value = 0
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(voice.peak, start + ATTACK)
    env.gain.linearRampToValueAtTime(voice.peak * SUSTAIN, end - RELEASE)
    env.gain.linearRampToValueAtTime(0, end)
    env.connect(loop.fade)

    const osc = ctx.createOscillator()
    osc.type = voice.wave
    osc.frequency.value = midiToHz(note.midi)
    osc.connect(env)
    osc.start(start)
    osc.stop(end + STOP_AFTER)
    osc.onended = () => {
      osc.disconnect()
      env.disconnect()
    }
    loop.notes.push({ osc, end })
  }

  /**
   * Queues the loop's notes from where it left off to the look-ahead (or its fade's end). Never from before `now`: a
   * scheduler that fell behind skips the missed notes rather than playing them late in a burst.
   */
  function schedule(loop: Loop, now: number) {
    const from = Math.max(loop.scheduledUntil, now)
    const to = Math.min(now + LOOK_AHEAD, loop.endsAt)
    if (to <= from) return
    for (const note of eventsInWindow(from - loop.origin, to - loop.origin)) playNote(loop, note)
    loop.scheduledUntil = to
    loop.notes = loop.notes.filter((n) => n.end > now)
  }

  /** Silences a faded loop for good: stops the notes still sounding and unhooks its fade. */
  function finish(loop: Loop, now: number) {
    for (const n of loop.notes) if (n.end > now) n.osc.stop(now)
    loop.notes = []
    loop.fade.disconnect()
  }

  function tick() {
    const now = ctx.currentTime
    if (playing) schedule(playing, now)
    // A suspended context's clock is frozen, so its fades would never end; nothing is heard from them anyway.
    const frozen = ctx.state !== 'running'
    fading = fading.filter((loop) => {
      if (frozen || now >= loop.endsAt) {
        finish(loop, now)
        return false
      }
      schedule(loop, now)
      return true
    })
    if (!playing && fading.length === 0) stopTimer()
  }

  function stopTimer() {
    if (!timer) return
    timers.clearInterval(timer.id)
    timer = null
  }

  return {
    start() {
      if (playing) return
      const origin = ctx.currentTime
      const fade = ctx.createGain()
      fade.gain.value = 0
      fade.gain.setValueAtTime(0, origin)
      fade.gain.linearRampToValueAtTime(1, origin + FADE_IN)
      fade.connect(dest)
      playing = { origin, fade, scheduledUntil: origin, endsAt: Number.POSITIVE_INFINITY, notes: [] }
      schedule(playing, origin)
      timer ??= { id: timers.setInterval(tick, TICK_MS) }
    },

    stop() {
      if (!playing) return
      const t = ctx.currentTime
      holdAt(playing.fade.gain, t)
      playing.fade.gain.linearRampToValueAtTime(0, t + FADE_OUT)
      playing.endsAt = t + FADE_OUT
      fading.push(playing)
      playing = null
    },

    dispose() {
      stopTimer()
      playing = null
      fading = []
    },
  }
}
