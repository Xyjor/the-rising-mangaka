/**
 * A recording SoundEngine for tests. It makes no sound and needs no AudioContext: pass it to `connectSound`, or
 * install it with `installSound` for UI tests, then read back what the game asked of it.
 */
import { levelsFor } from '../audio/engine'
import type { SoundEngine } from '../audio/engine'
import { DEFAULT_SOUND } from '../audio/types'
import type { CueId, SoundPrefs } from '../audio/types'

export interface FakeSound extends SoundEngine {
  /** Every cue played, in order. */
  readonly plays: CueId[]
  /** The `pitch` option of each play, parallel to `plays` (undefined when a play passed none). */
  readonly pitches: (number | undefined)[]
  /** The cue of each stop function called, in call order. Only a stop function's first call counts. */
  readonly stops: CueId[]
  /** Every setPrefs call, in order (copies). */
  readonly prefs: SoundPrefs[]
  /** Every startMusic ('start') and stopMusic ('stop') call, in order. */
  readonly music: ('start' | 'stop')[]
  /** True after a startMusic until the next stopMusic. */
  readonly musicOn: boolean
  /** Every duck(level) call, in order. */
  readonly ducks: number[]
  readonly unlocks: number
  readonly suspends: number
  readonly resumes: number
  /** Whether the audio context runs: false until a test sets it. */
  running: boolean
}

export function createFakeSound(): FakeSound {
  const plays: CueId[] = []
  const pitches: (number | undefined)[] = []
  const stops: CueId[] = []
  const prefs: SoundPrefs[] = []
  const music: ('start' | 'stop')[] = []
  const ducks: number[] = []
  let unlocks = 0
  let suspends = 0
  let resumes = 0
  const noop = () => {}

  return {
    plays,
    pitches,
    stops,
    prefs,
    music,
    ducks,
    running: false,
    get musicOn() {
      return music.at(-1) === 'start'
    },
    get unlocks() {
      return unlocks
    },
    get suspends() {
      return suspends
    },
    get resumes() {
      return resumes
    },
    get unlocked() {
      return unlocks > 0
    },
    unlock() {
      unlocks++
    },
    play(cue, opts) {
      plays.push(cue)
      pitches.push(opts?.pitch)
      let stopped = false
      return () => {
        if (stopped) return
        stopped = true
        stops.push(cue)
      }
    },
    setPrefs(p) {
      prefs.push({ ...p })
    },
    levels() {
      return levelsFor(prefs.at(-1) ?? DEFAULT_SOUND)
    },
    startMusic() {
      music.push('start')
    },
    stopMusic() {
      music.push('stop')
    },
    duck(level) {
      ducks.push(level)
    },
    suspend() {
      suspends++
    },
    resume() {
      resumes++
    },
    dispose: noop,
  }
}
