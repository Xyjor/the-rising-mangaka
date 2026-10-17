// Connects the store to the sound engine: the player's prefs, the music and its scene, the cues a change of state
// makes, and the gestures that unlock audio. It never imports the store: the app passes useStore in as `source`.
import { seasonOf } from '../sim'
import type { GameState } from '../sim'
import { clockRuns } from '../state/clockRuns'
import type { SoundEngine } from './engine'
import type { MusicScene } from './music/types'
import { cuesForTransition, speedCue } from './triggers'
import type { SoundPrefs } from './types'

/** The part of the store the bridge reads. */
export interface SoundState {
  game: GameState | null
  speed: number
  /** The open menu or dialog, 'none' when there is none. */
  modal: string
  sound: SoundPrefs
  readOnly: boolean
  /** Rises in the update that loads a save (startup, takeover, read-only refresh). */
  saveLoads: number
  /** True while the window is hidden or minimised; the store suspends and resumes the sound for it. */
  windowHidden: boolean
}

export interface SoundSource {
  getState(): SoundState
  subscribe(listener: (state: SoundState, prev: SoundState) => void): () => void
}

/** The part of a DOM event the bridge reads. */
export interface GestureEvent {
  readonly type: string
  readonly pointerType?: string
}

interface Listenable {
  addEventListener(type: string, listener: (e: GestureEvent) => void, capture?: boolean): void
  removeEventListener(type: string, listener: (e: GestureEvent) => void, capture?: boolean): void
}

/** Where the bridge listens: the window, for the unlocking gestures. */
export interface SoundEnv {
  window: Listenable
}

/**
 * Gestures that unlock audio, heard in the capture phase so the unlock comes before any handler's cue. A mouse
 * activates the page on pointerdown; touch and pen only on pointerup (the HTML user-activation rules).
 */
const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const

function pageEnv(): SoundEnv | null {
  return typeof window !== 'undefined' ? { window } : null
}

/** The music plays in the tab that owns the save, on the title screen too, unless the player turned it off. */
function musicWanted(s: SoundState): boolean {
  return s.sound.music && !s.sound.muted && !s.readOnly
}

/**
 * What the music plays for: the title scene with no game open, else the studio in the game's season, calm while the
 * clock is stopped (paused, a menu open, a decision waiting, or a read-only tab).
 */
export function musicScene(s: SoundState): MusicScene {
  if (!s.game) return { mood: 'title', season: 'spring', calm: false }
  return { mood: 'studio', season: seasonOf(s.game.day), calm: !clockRuns(s) }
}

const sameScene = (a: MusicScene, b: MusicScene) => a.mood === b.mood && a.season === b.season && a.calm === b.calm

/**
 * Unlocks the engine on every gesture until its context runs, then stops listening. A gesture may not count as
 * activation (a touch pointerdown, Escape), and the context it creates stays suspended, so one unlock is not enough.
 * Returns a function that stops listening early.
 */
function unlockOnGesture(engine: SoundEngine, target: Listenable): () => void {
  const stop = () => {
    for (const type of GESTURES) target.removeEventListener(type, onGesture, true)
  }
  function onGesture(e: GestureEvent) {
    if (e.type === 'pointerdown' && e.pointerType !== 'mouse') return
    engine.unlock()
    // resume() settles after this handler, so a later gesture that finds the context running is the one that stops.
    // An engine still locked right after unlock() can never make a context (no Web Audio, or disposed).
    if (!engine.unlocked || engine.running) stop()
  }
  for (const type of GESTURES) target.addEventListener(type, onGesture, true)
  return stop
}

/**
 * Makes `engine` follow `source` from now on, and listens to the page (`env`, the browser's window when there is one).
 * Returns a function that disconnects both. Hiding the window suspends the sound through the store's `setWindowHidden`.
 */
export function connectSound(source: SoundSource, engine: SoundEngine, env: SoundEnv | null = pageEnv()): () => void {
  const first = source.getState()
  engine.setPrefs(first.sound)
  let scene = musicScene(first)
  engine.setMusicScene(scene)
  let music = musicWanted(first)
  if (music) engine.startMusic()

  const unsubscribe = source.subscribe((next, prev) => {
    if (next.sound !== prev.sound) engine.setPrefs(next.sound)
    // Within one update: stop, then the scene (only when it changed), then start, so a starting track fits the scene.
    const want = musicWanted(next)
    if (music && !want) engine.stopMusic()
    const nextScene = musicScene(next)
    if (!sameScene(scene, nextScene)) {
      scene = nextScene
      engine.setMusicScene(scene)
    }
    if (!music && want) engine.startMusic()
    music = want
    // A read-only tab mirrors another tab's play, so it makes no sound, nor does the update that turns it on or off.
    // A loaded save is not a step of play either, even one of the same world on the same day. Hiding the window stops
    // the clock silently (a 'pause' would sound on return), and nothing sounds while it is hidden or as it shows.
    if (prev.readOnly || next.readOnly || next.saveLoads !== prev.saveLoads) return
    if (prev.windowHidden || next.windowHidden) return
    // A game change carries its own cues; an auto-pause in the same update never adds a 'pause'.
    if (next.game !== prev.game) {
      if (prev.game && next.game) for (const cue of cuesForTransition(prev.game, next.game)) engine.play(cue)
      return
    }
    const cue = speedCue(prev.speed, next.speed)
    if (cue) engine.play(cue)
  })

  const stopUnlock = env ? unlockOnGesture(engine, env.window) : null
  return () => {
    unsubscribe()
    stopUnlock?.()
  }
}
