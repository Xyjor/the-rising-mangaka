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

/** A short fingerprint of a stored text (FNV-1a and the length): enough to tell whether slot 1 is still the copy. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${(h >>> 0).toString(16)}:${text.length}`
}

/** The index as stored: the open slot and, after a copy of the old save, that copy's fingerprint. */
export interface SlotIndex { active: SlotId | null; migratedFrom?: string }

/** The index, or null when there is none or it cannot be read. */
export function readIndexRecord(storage: Store): SlotIndex | null {
  const raw = get(storage, SLOT_INDEX_KEY)
  if (raw === null) return null
  try {
    const v = JSON.parse(raw) as { active?: unknown; migratedFrom?: unknown }
    const rec: SlotIndex = { active: isSlotId(v.active) ? v.active : null }
    if (typeof v.migratedFrom === 'string') rec.migratedFrom = v.migratedFrom
    return rec
  } catch {
    return { active: null }
  }
}

/** The index's open slot, or null when there is none, no index, or it cannot be read. */
export function readIndex(storage: Store): SlotId | null {
  return readIndexRecord(storage)?.active ?? null
}

/** Writes the index's open slot, keeping the copy's fingerprint; false when storage refused. */
export function writeIndex(storage: Store, active: SlotId | null, migratedFrom?: string): boolean {
  const from = migratedFrom ?? readIndexRecord(storage)?.migratedFrom
  try {
    storage.setItem(SLOT_INDEX_KEY, JSON.stringify(from === undefined ? { active } : { active, migratedFrom: from }))
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
 * What a tab that does not own the save sees, writing nothing: the index's slot, or the old key standing for slot 1
 * while the slots were never set up (the owner may be a fallback run still playing it).
 */
export function viewSlots(storage: Store): SlotStart {
  const index = readIndexRecord(storage)
  if (index === null && get(storage, LEGACY_SAVE_KEY) !== null) return { active: 1, legacy: true }
  return { active: index?.active ?? null, legacy: false }
}

/** Writes `value` under `key` and reads it back; throws when it does not match. */
function writeVerified(storage: Store, key: string, value: string) {
  storage.setItem(key, value)
  if (storage.getItem(key) !== value) throw new Error(`${key} does not match`)
}

/**
 * Run once, in the tab that owns the save (or the desktop app), before the store hydrates.
 * - No index yet, old save present, slot 1 empty: copy the old text into slot 1, read it back and compare, copy its
 *   preferences to the prefs key when that key is absent, and only then write the index `{ active: 1, migratedFrom }`.
 *   Any failed write or check puts every key back as it was and falls back to the old key for this run.
 * - No index yet, old save present, slot 1 filled: slot 1 was never verified (a copy whose rollback failed), so it is
 *   neither trusted nor overwritten: this run falls back to the old key.
 * - Index present, the old save changed since the copy (a fallback run kept playing it) and slot 1 still exactly the
 *   copy: refresh slot 1 from the old save, verified, or fall back to the old key for this run if that fails.
 * The old key is never deleted or written here.
 */
export function migrateLegacy(storage: Store): SlotStart {
  const legacy = get(storage, LEGACY_SAVE_KEY)
  const index = readIndexRecord(storage)
  const one = slotKey(1)
  const slotOne = get(storage, one)
  if (legacy === null) return { active: index?.active ?? null, legacy: false }

  if (index !== null) {
    const from = index.migratedFrom
    const stale = from !== undefined && slotOne !== null && fingerprint(slotOne) === from && fingerprint(legacy) !== from
    if (!stale) return { active: index.active, legacy: false }
    try {
      writeVerified(storage, one, legacy)
      if (!writeIndex(storage, index.active, fingerprint(legacy))) throw new Error('index not written')
      return { active: index.active, legacy: false }
    } catch {
      try {
        storage.setItem(one, slotOne)
        storage.setItem(SLOT_INDEX_KEY, JSON.stringify(index))
      } catch {
        /* slot 1 may hold the newer old save: this run reads the old key either way */
      }
      return { active: 1, legacy: true }
    }
  }

  if (slotOne !== null) return { active: 1, legacy: true }

  const hadPrefs = get(storage, PREFS_KEY) !== null
  let wroteSlot = false
  let wrotePrefs = false
  try {
    wroteSlot = true
    writeVerified(storage, one, legacy)
    if (!hadPrefs) {
      const prefs = prefsFrom(legacy)
      if (prefs !== null) {
        wrotePrefs = true
        writeVerified(storage, PREFS_KEY, prefs)
      }
    }
    const rec: SlotIndex = { active: 1, migratedFrom: fingerprint(legacy) }
    writeVerified(storage, SLOT_INDEX_KEY, JSON.stringify(rec))
    return { active: 1, legacy: false }
  } catch {
    // Put everything back: slot 1 and the prefs were empty, and there was no index.
    for (const [done, key] of [[wroteSlot, one], [wrotePrefs, PREFS_KEY], [true, SLOT_INDEX_KEY]] as const) {
      if (!done) continue
      try {
        storage.removeItem(key)
      } catch {
        /* nothing more can be done: with no index, the next start still prefers the old key */
      }
    }
    return { active: 1, legacy: true }
  }
}
