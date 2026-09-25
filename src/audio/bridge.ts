// Connects the store to the sound engine: the player's prefs, the music loop, the cues a change of state makes, and
// the gestures that unlock audio. It never imports the store: the app passes useStore in as `source`.
import type { GameState } from '../sim'
import type { SoundEngine } from './engine'
import { cuesForTransition, speedCue } from './triggers'
import type { SoundPrefs } from './types'

/** The part of the store the bridge reads. */
export interface SoundState {
  game: GameState | null
  speed: number
  sound: SoundPrefs
  readOnly: boolean
  /** Rises in the update that loads a save (startup, takeover, read-only refresh). */
  saveLoads: number
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

/** Where the bridge listens: the window for the unlocking gestures, the document for visibility. */
export interface SoundEnv {
  window: Listenable
  document: Listenable & { readonly hidden: boolean }
}

/**
 * Gestures that unlock audio, heard in the capture phase so the unlock comes before any handler's cue. A mouse
 * activates the page on pointerdown; touch and pen only on pointerup (the HTML user-activation rules).
 */
const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const

function pageEnv(): SoundEnv | null {
  return typeof window !== 'undefined' && typeof document !== 'undefined' ? { window, document } : null
}

/** The music loop plays while a game is open in the tab that owns it, unless the player turned it off. */
function musicWanted(s: SoundState): boolean {
  return s.sound.music && !s.sound.muted && !!s.game && !s.readOnly
}

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

/** Suspends audio while the page is hidden. Kept apart so it can move to the store later. */
function followVisibility(engine: SoundEngine, doc: SoundEnv['document']): () => void {
  const onChange = () => (doc.hidden ? engine.suspend() : engine.resume())
  doc.addEventListener('visibilitychange', onChange)
  return () => doc.removeEventListener('visibilitychange', onChange)
}

/**
 * Makes `engine` follow `source` from now on, and listens to the page (`env`, the browser's window and document when
 * there is one). Returns a function that disconnects both.
 */
export function connectSound(source: SoundSource, engine: SoundEngine, env: SoundEnv | null = pageEnv()): () => void {
  const first = source.getState()
  engine.setPrefs(first.sound)
  let music = musicWanted(first)
  if (music) engine.startMusic()

  const unsubscribe = source.subscribe((next, prev) => {
    if (next.sound !== prev.sound) engine.setPrefs(next.sound)
    const want = musicWanted(next)
    if (want !== music) {
      music = want
      if (want) engine.startMusic()
      else engine.stopMusic()
    }
    // A read-only tab mirrors another tab's play, so it makes no sound, nor does the update that turns it on or off.
    // A loaded save is not a step of play either, even one of the same world on the same day.
    if (prev.readOnly || next.readOnly || next.saveLoads !== prev.saveLoads) return
    // A game change carries its own cues; an auto-pause in the same update never adds a 'pause'.
    if (next.game !== prev.game) {
      if (prev.game && next.game) for (const cue of cuesForTransition(prev.game, next.game)) engine.play(cue)
      return
    }
    const cue = speedCue(prev.speed, next.speed)
    if (cue) engine.play(cue)
  })

  const stops = env ? [unlockOnGesture(engine, env.window), followVisibility(engine, env.document)] : []
  return () => {
    unsubscribe()
    for (const stop of stops) stop()
  }
}
