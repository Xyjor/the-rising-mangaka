// The cross-save profile: the first time each badge was ever earned, in any career on this device. Written only by the
// tab that owns the save (or the desktop app); every failure is swallowed, since the profile is a keepsake, never state
// the game depends on.
import { BADGES } from '../sim/badges'
import type { BadgeId, GameState } from '../sim'
import { isSlotId } from './slots'
import type { SlotId } from './slots'

export const PROFILE_KEY = 'rising-mangaka-profile'

export interface ProfileBadge { id: BadgeId; day: number; slot: SlotId; penName: string }
export interface Profile { badges: ProfileBadge[] }

type Store = Pick<Storage, 'getItem' | 'setItem'>

const IDS = new Set<string>(BADGES.map((b) => b.id))

function valid(v: unknown): v is ProfileBadge {
  if (!v || typeof v !== 'object') return false
  const b = v as Record<string, unknown>
  return typeof b.id === 'string' && IDS.has(b.id) && typeof b.day === 'number' && isSlotId(b.slot)
    && typeof b.penName === 'string'
}

/** The stored profile; anything unreadable (garbage, the wrong shape, an unknown badge) reads as empty or is dropped. */
export function readProfile(storage: Store | null): Profile {
  try {
    const raw = storage?.getItem(PROFILE_KEY)
    if (!raw) return { badges: [] }
    const list = (JSON.parse(raw) as { badges?: unknown }).badges
    if (!Array.isArray(list)) return { badges: [] }
    const out: ProfileBadge[] = []
    for (const b of list) if (valid(b) && !out.some((o) => o.id === b.id)) out.push(b)
    return { badges: out }
  } catch {
    return { badges: [] }
  }
}

/** The profile plus this career's badges; a badge already in the profile keeps its first record. */
export function mergeProfile(p: Profile, game: GameState, slot: SlotId): Profile {
  const add = (game.badges ?? [])
    .filter((e) => !p.badges.some((b) => b.id === e.id))
    .map((e) => ({ id: e.id, day: e.day, slot, penName: game.player.name }))
  return add.length ? { badges: [...p.badges, ...add] } : p
}

/** Records this career's badges in the profile. Only call from the tab that owns the save; never throws. */
export function recordProfile(storage: Store | null, game: GameState, slot: SlotId): void {
  if (!storage) return
  try {
    const p = readProfile(storage)
    const next = mergeProfile(p, game, slot)
    // A key holding garbage is replaced even when nothing new was earned.
    if (next !== p || storage.getItem(PROFILE_KEY) !== JSON.stringify(p)) storage.setItem(PROFILE_KEY, JSON.stringify(next))
  } catch {
    /* a keepsake: storage full or blocked, try again with the next badge */
  }
}
