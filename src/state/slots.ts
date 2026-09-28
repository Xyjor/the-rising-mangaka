// Three save slots. Each career lives under its own key; an index remembers which one is open; the device's
// preferences (theme, sound) live apart from every career. The single save of 0.5.0 and before is copied into slot 1
// once, verified, and never deleted or changed by this module.

/** The one save of 0.5.0 and before. Never deleted, never written by the slot code. */
export const LEGACY_SAVE_KEY = 'rising-mangaka-save'
/** `{ active: 1 | 2 | 3 | null }`: the open career. Its absence means the slots were never set up here. */
export const SLOT_INDEX_KEY = 'rising-mangaka-slots'
/** `{ theme, sound }`: this device's preferences, shared by every career. */
export const PREFS_KEY = 'rising-mangaka-prefs'

export type SlotId = 1 | 2 | 3
export const SLOT_IDS: readonly SlotId[] = [1, 2, 3]

export function slotKey(n: SlotId): string {
  return `rising-mangaka-save-${n}`
}

export function isSlotId(v: unknown): v is SlotId {
  return v === 1 || v === 2 || v === 3
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function get(storage: Store, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

/** The index's open slot, or null when there is none, no index, or it cannot be read. */
export function readIndex(storage: Store): SlotId | null {
  const raw = get(storage, SLOT_INDEX_KEY)
  if (raw === null) return null
  try {
    const active = (JSON.parse(raw) as { active?: unknown }).active
    return isSlotId(active) ? active : null
  } catch {
    return null
  }
}

/** Writes the index; false when storage refused. */
export function writeIndex(storage: Store, active: SlotId | null): boolean {
  try {
    storage.setItem(SLOT_INDEX_KEY, JSON.stringify({ active }))
    return true
  } catch {
    return false
  }
}

/** The theme and sound a legacy save carried, as the prefs key's text; null when it has none to give. */
export function prefsFrom(raw: string): string | null {
  try {
    const state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state
    if (!state || typeof state !== 'object') return null
    return JSON.stringify({ theme: state.theme, sound: state.sound })
  } catch {
    return null
  }
}

/**
 * `active`: the slot to open. `legacy`: the copy into slot 1 failed, so this run reads and writes the old key exactly as
 * 0.5.0 did (slot 1 stands for it) and the copy is tried again at the next start.
 */
export interface SlotStart { active: SlotId | null; legacy: boolean }

/**
 * Run once before the store hydrates. When the old single save exists, the slots were never set up (no index) and slot
 * 1 is empty: copy the old text into slot 1, read it back and compare, copy its preferences to the prefs key when that
 * key is absent, and only then set `active: 1`. Any failed write or check puts every key back as it was and falls back
 * to the old key. A filled slot 1 is never overwritten; the old key is never touched.
 */
export function migrateLegacy(storage: Store): SlotStart {
  const legacy = get(storage, LEGACY_SAVE_KEY)
  const indexRaw = get(storage, SLOT_INDEX_KEY)
  if (legacy === null || indexRaw !== null) return { active: readIndex(storage), legacy: false }
  const one = slotKey(1)
  if (get(storage, one) !== null) return { active: null, legacy: false }

  const hadPrefs = get(storage, PREFS_KEY) !== null
  let wroteSlot = false
  let wrotePrefs = false
  try {
    storage.setItem(one, legacy)
    wroteSlot = true
    if (storage.getItem(one) !== legacy) throw new Error('slot 1 does not match the old save')
    if (!hadPrefs) {
      const prefs = prefsFrom(legacy)
      if (prefs !== null) {
        storage.setItem(PREFS_KEY, prefs)
        wrotePrefs = true
        if (storage.getItem(PREFS_KEY) !== prefs) throw new Error('prefs do not match')
      }
    }
    storage.setItem(SLOT_INDEX_KEY, JSON.stringify({ active: 1 }))
    if (readIndex(storage) !== 1) throw new Error('index not written')
    return { active: 1, legacy: false }
  } catch {
    // Put everything back: slot 1 and the prefs were empty, and there was no index.
    for (const [done, key] of [[wroteSlot, one], [wrotePrefs, PREFS_KEY], [true, SLOT_INDEX_KEY]] as const) {
      if (!done) continue
      try {
        storage.removeItem(key)
      } catch {
        /* nothing more can be done: the old key still loads */
      }
    }
    return { active: 1, legacy: true }
  }
}
