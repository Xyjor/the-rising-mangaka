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
import { recordProfile } from './profile'
import { LEGACY_SAVE_KEY, PREFS_KEY, SLOT_IDS, SLOT_INDEX_KEY, migrateLegacy, slotKey, viewSlots, writeIndex } from './slots'
import type { SlotId, SlotStart } from './slots'
import { claim, disableTabLock, isOwner, startTabLock } from './tabLock'

export type Speed = 0 | 1 | 2 | 3
export type RunSpeed = Exclude<Speed, 0>
export type Modal =
  | 'none' | 'wizard' | 'submit' | 'stats' | 'notebook' | 'history' | 'settings' | 'staff' | 'trips' | 'series'
  | 'career' | 'studio' | 'year' | 'log' | 'badges'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Toast { id: number; kind: LogKind; text: string }

export const SPEED_MS: Record<RunSpeed, number> = { 1: 1000, 2: 500, 3: 220 }
/** The persist middleware's name; the key a career is written under follows the open slot (`careerKey`). */
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

  /** The open career's slot; null on the title screen. Not saved (the slot index holds it). */
  activeSlot: SlotId | null

  newGame: (name: string) => void
  /** Flush the open career, then open the career in slot `n`. False in a tab that does not own the save or for an empty slot. */
  openSlot: (n: SlotId) => boolean
  /** Start a new career in empty slot `n`. False in a tab that does not own the save or when the slot is filled. */
  startInSlot: (n: SlotId, penName: string) => boolean
  /** Flush the open career and go back to the title screen; the career stays in its slot. */
  backToTitle: () => boolean
  /** Delete the career in slot `n` (never the old single save, never the open slot). */
  deleteSlot: (n: SlotId) => boolean
  /** Write a save file into slot `n`: the open slot through `loadSave`, any other straight to its key. */
  loadSaveIntoSlot: (n: SlotId, save: SaveFile) => boolean
  /**
   * Replace the game with one read from a save file, stopped, and write it at once. Refused (false) in a tab that does
   * not own the save. Counts as a save load, so the sound bridge plays nothing for the jump.
   */
  loadSave: (save: SaveFile) => boolean
  /** Claim the save for this tab and reload the latest state from storage. */
  takeOver: () => void
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

function local(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Which slot is open, and whether this run fell back to the old single save (the copy into slot 1 failed: slot 1 then
 * stands for the old key, read and written exactly as 0.5.0 did). Set once before the store hydrates.
 */
let slots: SlotStart = { active: null, legacy: false }
{
  // Only the tab that owns the save (or the desktop app, the one window) migrates; another tab only looks.
  const ls = local()
  if (ls) slots = isDesktop() || isOwner() ? migrateLegacy(ls) : viewSlots(ls)
}

/** The key slot `n`'s career is kept under. */
export function careerKey(n: SlotId): string {
  return slots.legacy && n === 1 ? LEGACY_SAVE_KEY : slotKey(n)
}

/** The open career's key, or null on the title screen. */
export function activeSaveKey(): string | null {
  return slots.active === null ? null : careerKey(slots.active)
}

/** The stored text of slot `n`, or null when it is empty or storage cannot be read. */
export function slotRaw(n: SlotId): string | null {
  try {
    return local()?.getItem(careerKey(n)) ?? null
  } catch {
    return null
  }
}

/** True when this run reads the old single save because the copy into slot 1 failed. */
export function isLegacyFallback(): boolean {
  return slots.legacy
}

/**
 * Debounced, de-duplicated, single-writer save storage. Zustand's persist calls setItem on every set();
 * this only accepts a value when one of the persisted fields changed by reference, writes it after a short
 * quiet period (at once when a game starts, ends or is replaced), and never writes while another tab owns
 * the save. The saved log is trimmed to what the studio log shows.
 *
 * The career goes to the open slot's key, resolved when the change is accepted and kept with the waiting write, so a
 * write still waiting on the debounce lands in the slot it belongs to even after the slot changes. The theme and sound
 * go to the prefs key. A null game is never written: only `deleteSlot` empties a slot.
 */
let lastAccepted: Persisted | null = null
let pending: { key: string | null; value: StorageValue<Persisted> } | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null

function cancelFlush() {
  if (flushTimer !== null) clearTimeout(flushTimer)
  flushTimer = null
}

/** Drops a waiting write without writing it. */
function dropPending() {
  cancelFlush()
  pending = null
}

/** Writes the waiting save now instead of after the debounce: the page is going away or out of sight. */
export function flushSave() {
  cancelFlush()
  const job = pending
  pending = null
  if (!job || !isOwner()) return
  const { key, value } = job
  const { game, theme, sound, resumeSpeed, tutorialStep } = value.state
  try {
    if (key === LEGACY_SAVE_KEY) {
      // The fallback run: the old key, in its old shape, prefs included.
      const state: Persisted = { ...value.state, game: game && trimLog(game) }
      localStorage.setItem(key, JSON.stringify({ version: value.version, state }))
      return
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, sound }))
    if (key && game) {
      const state = { game: trimLog(game), resumeSpeed, tutorialStep }
      localStorage.setItem(key, JSON.stringify({ version: value.version, state }))
    }
  } catch {
    // Quota or privacy mode: the game keeps running, and the player is told it is not being saved.
    warnUnsaved(SAVE_FAILED)
  }
}

export const NO_FREE_SLOT = 'All three slots hold a career. Delete one on the title screen to start another.'
export const SAVE_FAILED = 'The game could not be saved. Free some browser storage, then export your save file.'

/** Toasts a save that could not happen, after the current update (the store may be mid-set). */
function warnUnsaved(text: string) {
  queueMicrotask(() => {
    const { toasts } = useStore.getState()
    useStore.setState({ toasts: mergeToasts(toasts, [{ id: toastSeq++, kind: 'warn', text }]) })
  })
}

function parse(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The first empty slot, for a game that starts with no slot open (it must never go unsaved). */
function firstFreeSlot(): SlotId | null {
  return SLOT_IDS.find((n) => slotRaw(n) === null) ?? null
}

const saveStorage: PersistStorage<Persisted> = {
  getItem: () => {
    const ls = local()
    if (!ls) return null
    try {
      const key = activeSaveKey()
      const career = parse(key ? ls.getItem(key) : null)
      const prefs = key === LEGACY_SAVE_KEY ? null : parse(ls.getItem(PREFS_KEY))
      if (!career && !prefs) return null
      const careerState = (career?.state ?? {}) as Partial<Persisted>
      const state = { ...careerState, ...(prefs ?? {}) } as Persisted
      if (!career) state.game = null
      const version = typeof career?.version === 'number' ? career.version : SAVE_VERSION
      return { version, state }
    } catch {
      return null
    }
  },
  setItem: (_name, value) => {
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
    if (s.game && slots.active === null) {
      const free = firstFreeSlot()
      if (free !== null) {
        slots = { ...slots, active: free }
        const ls = local()
        if (ls) writeIndex(ls, free)
        queueMicrotask(() => useStore.setState({ activeSlot: free }))
      } else warnUnsaved(NO_FREE_SLOT)
    }
    pending = { key: activeSaveKey(), value }
    if (gameReplaced) {
      flushSave()
      return
    }
    cancelFlush()
    flushTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
  },
  // Nothing in the game clears storage through persist; a slot goes only through deleteSlot.
  removeItem: () => dropPending(),
}

/** Records newly earned badges in the cross-save profile, from the tab that owns the save only. */
function noteBadges(prev: GameState, next: GameState) {
  if ((next.badges?.length ?? 0) <= (prev.badges?.length ?? 0) || slots.active === null || !canUseSlots()) return
  recordProfile(local(), next, slots.active)
}

/** Slot actions belong to the tab that owns the save. */
function canUseSlots(): boolean {
  return !useStore.getState().readOnly && isOwner()
}

/** Points the save at slot `n` and records it in the index. Drops nothing: flush first. */
function switchTo(n: SlotId) {
  slots = { ...slots, active: n }
  const ls = local()
  if (ls && !slots.legacy) writeIndex(ls, n)
}

/**
 * Re-reads the index (another tab may have opened another slot) and loads that slot, or the title screen when none is
 * open. Used by a read-only tab mirroring the owner and by a take-over.
 */
function followIndex(owner = false) {
  const ls = local()
  // A take-over makes this tab the owner: it runs the migration a read-only tab skipped at its start.
  if (ls) slots = owner ? migrateLegacy(ls) : viewSlots(ls)
  // Load first: the merge makes what loaded the save's baseline, so the update below cannot write this tab's stale game
  // over the owner's slot. With no slot open, the rehydrate finds no career and the game goes (the title screen).
  void useStore.persist.rehydrate()
  useStore.setState(slots.active === null ? { activeSlot: null, speed: 0, modal: 'none' } : { activeSlot: slots.active })
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
        noteBadges(game, next)
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
        activeSlot: slots.active,

        takeOver: () => {
          claim()
          // Drop any write the read-only tab queued from local-only changes, then load the owner's save (in the slot
          // the owner had open) before flipping the flag so nothing stale can overwrite it.
          dropPending()
          followIndex(true)
          set({ readOnly: false })
        },

        openSlot: (n) => {
          if (!canUseSlots() || slotRaw(n) === null) return false
          // The open career's waiting write lands in its own slot before the key moves.
          flushSave()
          switchTo(n)
          // The merge makes the loaded career the baseline, so nothing is written back.
          void useStore.persist.rehydrate()
          set({ activeSlot: n, speed: 0, modal: 'none', toasts: [], deskHidden: false })
          return true
        },

        startInSlot: (n, penName) => {
          if (!canUseSlots() || slotRaw(n) !== null) return false
          flushSave()
          switchTo(n)
          set({ activeSlot: n, deskHidden: false })
          get().newGame(penName.trim() || 'Rookie')
          return true
        },

        backToTitle: () => {
          if (!canUseSlots()) return false
          flushSave()
          // The fallback run keeps no index, so the next start tries the copy into slot 1 again.
          slots = { ...slots, active: null }
          const ls = local()
          if (ls && !slots.legacy) writeIndex(ls, null)
          set({ game: null, speed: 0, modal: 'none', toasts: [], activeSlot: null, deskHidden: false })
          return true
        },

        deleteSlot: (n) => {
          const key = careerKey(n)
          if (!canUseSlots() || key === LEGACY_SAVE_KEY || n === slots.active) return false
          try {
            localStorage.removeItem(key)
            return true
          } catch {
            return false
          }
        },

        loadSaveIntoSlot: (n, save) => {
          if (n === slots.active) return get().loadSave(save)
          const key = careerKey(n)
          if (!canUseSlots() || key === LEGACY_SAVE_KEY) return false
          const state = { game: trimLog(save.game), tutorialStep: save.tutorialStep, resumeSpeed: save.resumeSpeed }
          try {
            localStorage.setItem(key, JSON.stringify({ version: SAVE_VERSION, state }))
            return true
          } catch {
            return false
          }
        },

        newGame: (name) => {
          if (slots.active === null) {
            const free = firstFreeSlot()
            if (free === null) {
              set({ toasts: mergeToasts(get().toasts, [{ id: toastSeq++, kind: 'warn', text: NO_FREE_SLOT }]) })
              return
            }
            switchTo(free)
            set({ activeSlot: free })
          }
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
          noteBadges(game, next)
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
    // A read-only tab mirrors the owner: the owner's open slot (the index), that slot's career and the prefs.
    window.addEventListener('storage', (e) => {
      if (!useStore.getState().readOnly) return
      if (e.key === SLOT_INDEX_KEY || e.key === null) followIndex()
      else if (e.key === PREFS_KEY || e.key === activeSaveKey()) void useStore.persist.rehydrate()
    })
  }
}
