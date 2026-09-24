import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import * as sim from '../sim'
import type { Activity, Focus, GameState, LogKind, MagazineId, PlaceId, ProjectDraft, StatId } from '../sim'
import { upgradeSave } from '../sim/migrate'
import { claim, isOwner, startTabLock } from './tabLock'

export type Speed = 0 | 1 | 2 | 3
export type RunSpeed = Exclude<Speed, 0>
export type Modal =
  | 'none' | 'wizard' | 'submit' | 'stats' | 'notebook' | 'history' | 'settings' | 'staff' | 'trips' | 'series'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Toast { id: number; kind: LogKind; text: string }

export const SPEED_MS: Record<RunSpeed, number> = { 1: 1000, 2: 500, 3: 220 }
const SAVE_VERSION = 2
export const SAVE_KEY = 'rising-mangaka-save'
/** How long the save waits for more changes before it is written. */
const SAVE_DEBOUNCE_MS = 800
/** The log is trimmed to what the EventLog shows; the live state keeps the full log. */
const SAVED_LOG_ENTRIES = 80

interface Store {
  game: GameState | null
  speed: Speed
  resumeSpeed: RunSpeed
  modal: Modal
  toasts: Toast[]
  theme: ThemeMode
  /** -1 when the player dismissed tips */
  tutorialStep: number
  /** True while another tab owns the save: this tab mirrors it and its clock never runs. */
  readOnly: boolean

  newGame: (name: string) => void
  /** Claim the save for this tab and reload the latest state from storage. */
  takeOver: () => void
  abandonGame: () => void
  tick: () => void
  setSpeed: (s: Speed) => void
  togglePause: () => void
  openModal: (m: Modal) => void
  closeModal: () => void
  startProject: (d: ProjectDraft) => void
  submitProject: (m: MagazineId) => void
  dismissResult: () => void
  acceptOffer: () => void
  declineOffer: () => void
  endSerial: () => void
  hireAssistant: (id: number) => void
  fireAssistant: (id: number) => void
  startTrip: (p: PlaceId) => void
  setActivity: (a: Activity) => void
  setFocus: (f: Focus) => void
  spendSkillPoint: (s: StatId) => void
  dismissToast: (id: number) => void
  setTheme: (t: ThemeMode) => void
  finishTutorial: () => void
}

let toastSeq = 1

/** Pull toast-worthy log entries that appeared between two states. */
function newToasts(prev: GameState, next: GameState): Toast[] {
  return next.log
    .filter((e) => e.id >= prev.nextLogId && e.toast)
    .map((e) => ({ id: toastSeq++, kind: e.kind, text: e.text }))
}

/** Append toasts, dropping any whose text is already on screen. */
function mergeToasts(current: Toast[], added: Toast[]): Toast[] {
  const seen = new Set(current.map((t) => t.text))
  const fresh = added.filter((t) => !seen.has(t.text) && (seen.add(t.text), true))
  return [...current, ...fresh].slice(-5)
}

/** The slice of the store that reaches localStorage. */
interface Persisted {
  game: GameState | null
  theme: ThemeMode
  resumeSpeed: RunSpeed
  tutorialStep: number
}

/**
 * Debounced, de-duplicated, single-writer save storage. Zustand's persist calls setItem on every set();
 * this only accepts a value when one of the persisted fields changed by reference, writes it after a short
 * quiet period (at once when a game starts, ends or is replaced), and never writes while another tab owns
 * the save. The saved log is trimmed to what the EventLog shows.
 */
let lastAccepted: Persisted | null = null
let pending: { name: string; value: StorageValue<Persisted> } | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null

function cancelFlush() {
  if (flushTimer !== null) clearTimeout(flushTimer)
  flushTimer = null
}

function flush() {
  cancelFlush()
  const job = pending
  pending = null
  if (!job || !isOwner()) return
  const { name, value } = job
  const game = value.state.game
  const state: Persisted = { ...value.state, game: game && { ...game, log: game.log.slice(-SAVED_LOG_ENTRIES) } }
  try {
    localStorage.setItem(name, JSON.stringify({ version: value.version, state }))
  } catch {
    /* quota or privacy mode: the game keeps running unsaved */
  }
}

const saveStorage: PersistStorage<Persisted> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name)
      return raw ? (JSON.parse(raw) as StorageValue<Persisted>) : null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    if (!isOwner()) return
    const s = value.state
    const last = lastAccepted
    if (
      last &&
      s.game === last.game &&
      s.theme === last.theme &&
      s.resumeSpeed === last.resumeSpeed &&
      s.tutorialStep === last.tutorialStep
    ) return
    const gameReplaced =
      !!s.game !== !!last?.game || (!!s.game && !!last?.game && s.game.worldSeed !== last.game.worldSeed)
    lastAccepted = s
    pending = { name, value }
    if (gameReplaced) {
      flush()
      return
    }
    cancelFlush()
    flushTimer = setTimeout(flush, SAVE_DEBOUNCE_MS)
  },
  removeItem: (name) => {
    cancelFlush()
    pending = null
    lastAccepted = null
    try {
      localStorage.removeItem(name)
    } catch {
      /* nothing to remove */
    }
  },
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Apply a sim command, surfacing toasts and optionally closing the modal / resuming time. */
      const apply = (fn: (g: GameState) => GameState, opts: { close?: boolean; resume?: boolean } = {}) => {
        const { game, toasts, resumeSpeed } = get()
        if (!game) return
        const next = fn(game)
        if (next === game) return
        const patch: Partial<Store> = { game: next }
        const added = newToasts(game, next)
        if (added.length) patch.toasts = mergeToasts(toasts, added)
        if (opts.close) patch.modal = 'none'
        if (opts.resume) patch.speed = resumeSpeed
        set(patch)
      }

      return {
        game: null,
        speed: 0,
        resumeSpeed: 1,
        modal: 'none',
        toasts: [],
        theme: 'auto',
        tutorialStep: 0,
        readOnly: false,

        takeOver: () => {
          claim()
          set({ readOnly: false })
          void useStore.persist.rehydrate()
        },

        newGame: (name) => {
          const seed = (Date.now() ^ (Math.random() * 0xffffffff)) | 0
          set({ game: sim.createGame(name, seed), speed: 0, modal: 'none', toasts: [], tutorialStep: 0 })
        },

        abandonGame: () => set({ game: null, speed: 0, modal: 'none', toasts: [] }),

        tick: () => {
          const { game, toasts } = get()
          if (!game) return
          const next = sim.tick(game)
          const patch: Partial<Store> = { game: next }
          const added = newToasts(game, next)
          if (added.length) patch.toasts = mergeToasts(toasts, added)
          // Auto-pause whenever the game needs a decision from the player.
          const needsDecision =
            !!next.pendingResult ||
            (!!next.pendingOffer && !game.pendingOffer) ||
            (sim.getPhase(game) === 'drawing' && sim.getPhase(next) === 'ready')
          if (needsDecision) patch.speed = 0
          set(patch)
        },

        setSpeed: (s) => set(s === 0 ? { speed: 0 } : { speed: s, resumeSpeed: s }),

        togglePause: () => {
          const { speed, resumeSpeed } = get()
          set({ speed: speed === 0 ? resumeSpeed : 0 })
        },

        openModal: (m) => set({ modal: m }),
        closeModal: () => set({ modal: 'none' }),

        startProject: (d) => apply((g) => sim.startProject(g, d), { close: true, resume: true }),
        submitProject: (m) => apply((g) => sim.submitProject(g, m), { close: true, resume: true }),
        dismissResult: () => apply((g) => sim.dismissResult(g)),
        acceptOffer: () => apply((g) => sim.acceptOffer(g), { resume: true }),
        declineOffer: () => apply((g) => sim.declineOffer(g)),
        endSerial: () => apply((g) => sim.endSerial(g), { close: true }),
        hireAssistant: (id) => apply((g) => sim.hireAssistant(g, id)),
        fireAssistant: (id) => apply((g) => sim.fireAssistant(g, id)),
        startTrip: (p) => apply((g) => sim.startTrip(g, p), { close: true, resume: true }),
        setActivity: (a) => apply((g) => sim.setActivity(g, a)),
        setFocus: (f) => apply((g) => sim.setFocus(g, f)),
        spendSkillPoint: (s) => apply((g) => sim.spendSkillPoint(g, s)),

        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
        setTheme: (t) => set({ theme: t }),
        finishTutorial: () => set({ tutorialStep: -1 }),
      }
    },
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: saveStorage,
      partialize: (s): Persisted => ({ game: s.game, theme: s.theme, resumeSpeed: s.resumeSpeed, tutorialStep: s.tutorialStep }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>
        const merged: Store = { ...current, ...p, game: p.game ? upgradeSave(p.game) : null }
        // What just loaded is the baseline for the reference check, so opening a modal after a reload does not write.
        lastAccepted = { game: merged.game, theme: merged.theme, resumeSpeed: merged.resumeSpeed, tutorialStep: merged.tutorialStep }
        return merged
      },
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<Store>
        const base = {
          game: p.game ?? null,
          theme: p.theme ?? 'auto',
          resumeSpeed: p.resumeSpeed ?? 1,
          tutorialStep: p.tutorialStep ?? 0,
        }
        // Older saves predate serialisation and staff; start fresh rather than crash.
        if (version < SAVE_VERSION || (base.game && base.game.version !== 2)) return { ...base, game: null }
        return base
      },
    },
  ),
)

// ---------- browser wiring: flush on leave, one writer tab at a time ----------

if (typeof window !== 'undefined') {
  // A debounced write must not be lost when the tab closes or goes to the background.
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })

  // Only the owner tab writes the save and runs the clock; the others mirror it read-only.
  startTabLock((owner) => useStore.setState(owner ? { readOnly: false } : { readOnly: true, speed: 0 }))
  window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY && useStore.getState().readOnly) void useStore.persist.rehydrate()
  })
}
