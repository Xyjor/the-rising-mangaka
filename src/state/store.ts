import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import * as sim from '../sim'
import type {
  Activity, AnimeStudioId, EquipmentId, Focus, GameState, LogKind, MagazineId, PlaceId, ProjectDraft, StatId,
  StudioTierId,
} from '../sim'
import { upgradeSave } from '../sim/migrate'
import { getSound } from '../audio/instance'
import { DEFAULT_SOUND, normalizeSound } from '../audio/types'
import type { SoundPrefs } from '../audio/types'
import { isDesktop } from '../platform/env'
import { SAVE_VERSION, trimLog } from './saveFile'
import type { SaveFile } from './saveFile'
import { claim, disableTabLock, isOwner, startTabLock } from './tabLock'

export type Speed = 0 | 1 | 2 | 3
export type RunSpeed = Exclude<Speed, 0>
export type Modal =
  | 'none' | 'wizard' | 'submit' | 'stats' | 'notebook' | 'history' | 'settings' | 'staff' | 'trips' | 'series'
  | 'career' | 'studio' | 'year' | 'log'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Toast { id: number; kind: LogKind; text: string }

export const SPEED_MS: Record<RunSpeed, number> = { 1: 1000, 2: 500, 3: 220 }
export const SAVE_KEY = 'rising-mangaka-save'
/** How long the save waits for more changes before it is written. */
const SAVE_DEBOUNCE_MS = 800

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
  sound: SoundPrefs
  /**
   * Counts the saves loaded into this tab (at startup, on takeover, on a read-only refresh). Not saved. The sound
   * bridge stays silent for the update that loads a save, which is not a step of play.
   */
  saveLoads: number
  /**
   * True while the window is hidden or minimised (the page's visibility; the desktop shell's minimise). Not saved. The
   * clock stopped when it was set, and the sound bridge plays no cue for the update that sets or clears it.
   */
  windowHidden: boolean
  /**
   * True while the player has tucked the desk (the status card and the desk tray) away to look at the studio. Not
   * saved; the auto-pause for a decision shows the desk again.
   */
  deskHidden: boolean

  newGame: (name: string) => void
  /**
   * Replace the game with one read from a save file, stopped, and write it at once. Refused (false) in a tab that does
   * not own the save. Counts as a save load, so the sound bridge plays nothing for the jump.
   */
  loadSave: (save: SaveFile) => boolean
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
  /** Answer the random event waiting on the desk. */
  resolveEvent: (choice: 'a' | 'b') => void
  /** Move the studio one tier up, paying the move-in cost. */
  moveStudio: (tier: StudioTierId) => void
  buyEquipment: (id: EquipmentId) => void
  /** Sign the anime adaptation offer waiting on the desk with one studio. */
  signAnime: (studio: AnimeStudioId) => void
  /** Pass on the anime adaptation offer waiting on the desk. */
  declineAnime: () => void
  /** The year review was opened: its desk card goes. */
  markReviewRead: () => void
  setActivity: (a: Activity) => void
  setFocus: (f: Focus) => void
  spendSkillPoint: (s: StatId) => void
  dismissToast: (id: number) => void
  setTheme: (t: ThemeMode) => void
  toggleDesk: () => void
  setSound: (patch: Partial<SoundPrefs>) => void
  finishTutorial: () => void
  /**
   * The window was hidden or minimised (true) or shown again (false). Hiding stops the clock, keeping a running speed
   * for Space, and suspends the sound; showing resumes the sound and leaves the clock stopped. A repeat is a no-op.
   */
  setWindowHidden: (hidden: boolean) => void
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
  sound: SoundPrefs
}

/**
 * Debounced, de-duplicated, single-writer save storage. Zustand's persist calls setItem on every set();
 * this only accepts a value when one of the persisted fields changed by reference, writes it after a short
 * quiet period (at once when a game starts, ends or is replaced), and never writes while another tab owns
 * the save. The saved log is trimmed to what the studio log shows.
 */
let lastAccepted: Persisted | null = null
let pending: { name: string; value: StorageValue<Persisted> } | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null

function cancelFlush() {
  if (flushTimer !== null) clearTimeout(flushTimer)
  flushTimer = null
}

/** Writes the waiting save now instead of after the debounce: the page is going away or out of sight. */
export function flushSave() {
  cancelFlush()
  const job = pending
  pending = null
  if (!job || !isOwner()) return
  const { name, value } = job
  const game = value.state.game
  const state: Persisted = { ...value.state, game: game && trimLog(game) }
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
      s.tutorialStep === last.tutorialStep &&
      s.sound === last.sound
    ) return
    const gameReplaced =
      !!s.game !== !!last?.game || (!!s.game && !!last?.game && s.game.worldSeed !== last.game.worldSeed)
    lastAccepted = s
    pending = { name, value }
    if (gameReplaced) {
      flushSave()
      return
    }
    cancelFlush()
    flushTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
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
        sound: DEFAULT_SOUND,
        saveLoads: 0,
        windowHidden: false,
        deskHidden: false,

        takeOver: () => {
          claim()
          // Drop any write the read-only tab queued from local-only changes, then load the owner's save before
          // flipping the flag so nothing stale can overwrite it.
          cancelFlush()
          pending = null
          void useStore.persist.rehydrate()
          set({ readOnly: false })
        },

        newGame: (name) => {
          const seed = (Date.now() ^ (Math.random() * 0xffffffff)) | 0
          set({ game: sim.createGame(name, seed), speed: 0, modal: 'none', toasts: [], tutorialStep: 0 })
        },

        loadSave: (save) => {
          if (get().readOnly || !isOwner()) return false
          set({
            game: save.game, tutorialStep: save.tutorialStep, resumeSpeed: save.resumeSpeed, speed: 0, modal: 'none',
            toasts: [{ id: toastSeq++, kind: 'success', text: 'Save loaded' }], saveLoads: get().saveLoads + 1,
          })
          // A save of the same career is not a replaced game to the save storage, so it would wait for the debounce.
          flushSave()
          return true
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
          const deskEmptied = !!game.project && !next.project && !next.pendingResult
          const tripEnded = !!game.trip && !next.trip
          const needsDecision =
            !!next.pendingResult ||
            (!!next.pendingOffer && !game.pendingOffer) ||
            (sim.getPhase(game) === 'drawing' && sim.getPhase(next) === 'ready') ||
            deskEmptied ||
            tripEnded ||
            (!!next.event && !game.event) ||
            (!!next.animeOffer && !game.animeOffer)
          if (needsDecision) {
            patch.speed = 0
            patch.deskHidden = false
          }
          set(patch)
        },

        setSpeed: (s) => set(s === 0 ? { speed: 0 } : { speed: s, resumeSpeed: s }),

        togglePause: () => {
          const { speed, resumeSpeed } = get()
          set({ speed: speed === 0 ? resumeSpeed : 0 })
        },

        openModal: (m) => {
          const g = get().game
          if (!g || g.pendingResult || g.pendingOffer) return
          if (m === 'wizard' && (g.project || g.trip)) return
          if (m === 'submit' && sim.getPhase(g) !== 'ready') return
          if (m === 'year' && !g.yearReviews.length) return
          set({ modal: m })
        },
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
        resolveEvent: (c) => apply((g) => sim.resolveEvent(g, c)),
        moveStudio: (t) => apply((g) => sim.moveStudio(g, t)),
        buyEquipment: (id) => apply((g) => sim.buyEquipment(g, id)),
        signAnime: (st) => apply((g) => sim.signAnime(g, st)),
        declineAnime: () => apply((g) => sim.declineAnime(g)),
        markReviewRead: () => apply((g) => sim.markReviewRead(g)),
        setActivity: (a) => apply((g) => sim.setActivity(g, a)),
        setFocus: (f) => apply((g) => sim.setFocus(g, f)),
        spendSkillPoint: (s) => apply((g) => sim.spendSkillPoint(g, s)),

        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
        setTheme: (t) => set({ theme: t }),
        toggleDesk: () => set({ deskHidden: !get().deskHidden }),
        setSound: (patch) => {
          const current = get().sound
          const next = normalizeSound({ ...current, ...patch })
          if (next.muted === current.muted && next.volume === current.volume && next.music === current.music) return
          set({ sound: next })
        },
        finishTutorial: () => set({ tutorialStep: -1 }),

        setWindowHidden: (hidden) => {
          const { windowHidden, speed } = get()
          if (hidden === windowHidden) return
          if (hidden) {
            set(speed === 0 ? { windowHidden: true } : { windowHidden: true, speed: 0, resumeSpeed: speed })
            getSound().suspend()
          } else {
            set({ windowHidden: false })
            getSound().resume()
          }
        },
      }
    },
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: saveStorage,
      partialize: (s): Persisted => ({
        game: s.game, theme: s.theme, resumeSpeed: s.resumeSpeed, tutorialStep: s.tutorialStep, sound: s.sound,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>
        const merged: Store = {
          ...current, ...p, game: p.game ? upgradeSave(p.game) : null, sound: normalizeSound(p.sound),
          saveLoads: current.saveLoads + 1,
        }
        // What just loaded is the baseline for the reference check, so opening a modal after a reload does not write.
        lastAccepted = {
          game: merged.game, theme: merged.theme, resumeSpeed: merged.resumeSpeed, tutorialStep: merged.tutorialStep,
          sound: merged.sound,
        }
        return merged
      },
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<Store>
        const base = {
          game: p.game ?? null,
          theme: p.theme ?? 'auto',
          resumeSpeed: p.resumeSpeed ?? 1,
          tutorialStep: p.tutorialStep ?? 0,
          sound: normalizeSound(p.sound),
        }
        // Older saves predate serialisation and staff; start fresh rather than crash.
        if (version < SAVE_VERSION || (base.game && base.game.version !== 2)) return { ...base, game: null }
        return base
      },
    },
  ),
)

// ---------- page wiring: flush on leave, pause while hidden, one writer tab at a time ----------

if (typeof window !== 'undefined') {
  // A debounced write must not be lost when the tab closes or goes to the background, and a hidden page's clock stops.
  window.addEventListener('pagehide', flushSave)
  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden'
    if (hidden) flushSave()
    useStore.getState().setWindowHidden(hidden)
  })

  if (isDesktop()) {
    // One window only (single instance): it always owns the save.
    disableTabLock()
  } else {
    // Only the owner tab writes the save and runs the clock; the others mirror it read-only.
    startTabLock((owner) => useStore.setState(owner ? { readOnly: false } : { readOnly: true, speed: 0 }))
    window.addEventListener('storage', (e) => {
      if (e.key === SAVE_KEY && useStore.getState().readOnly) void useStore.persist.rehydrate()
    })
  }
}
