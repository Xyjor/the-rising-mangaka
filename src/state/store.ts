import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as sim from '../sim'
import type { Activity, Focus, GameState, LogKind, MagazineId, PlaceId, ProjectDraft, StatId } from '../sim'

export type Speed = 0 | 1 | 2 | 3
export type RunSpeed = Exclude<Speed, 0>
export type Modal =
  | 'none' | 'wizard' | 'submit' | 'stats' | 'notebook' | 'history' | 'settings' | 'staff' | 'trips' | 'series'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Toast { id: number; kind: LogKind; text: string }

export const SPEED_MS: Record<RunSpeed, number> = { 1: 1000, 2: 500, 3: 220 }
const SAVE_VERSION = 2

interface Store {
  game: GameState | null
  speed: Speed
  resumeSpeed: RunSpeed
  modal: Modal
  toasts: Toast[]
  theme: ThemeMode
  /** -1 when the player dismissed tips */
  tutorialStep: number

  newGame: (name: string) => void
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
      name: 'rising-mangaka-save',
      version: SAVE_VERSION,
      partialize: (s) => ({ game: s.game, theme: s.theme, resumeSpeed: s.resumeSpeed, tutorialStep: s.tutorialStep }),
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
