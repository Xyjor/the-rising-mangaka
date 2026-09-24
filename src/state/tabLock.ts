/**
 * Single-writer tab lock. The tab that owns the save is the only one that writes it and runs the clock;
 * other tabs mirror it read-only until they take over. The record lives in localStorage and is
 * re-stamped by a heartbeat so a tab that died without `pagehide` (crash, killed process) goes stale.
 */

export const OWNER_KEY = 'rising-mangaka-owner'
export const HEARTBEAT_MS = 2000
export const STALE_MS = 6000

export interface OwnerRecord { tabId: string; at: number }

// randomUUID only exists in secure contexts; plain http over a LAN must not take the app down at module load.
export const tabId: string = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** The current owner record, or null when there is none or it cannot be read. */
export function read(): OwnerRecord | null {
  try {
    const raw = storage()?.getItem(OWNER_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<OwnerRecord>
    if (typeof v.tabId !== 'string' || typeof v.at !== 'number') return null
    return { tabId: v.tabId, at: v.at }
  } catch {
    return null
  }
}

/** True when nobody holds the save, we hold it, or the holder's heartbeat has gone stale. */
export function isOwner(now = Date.now()): boolean {
  const rec = read()
  return !rec || rec.tabId === tabId || now - rec.at > STALE_MS
}

/** Stamp this tab as the owner. */
export function claim(): void {
  try {
    storage()?.setItem(OWNER_KEY, JSON.stringify({ tabId, at: Date.now() } satisfies OwnerRecord))
  } catch {
    /* storage unavailable: the tab simply behaves as the owner */
  }
}

/** Remove the owner record, but only if it is ours. */
export function release(): void {
  if (read()?.tabId !== tabId) return
  try {
    storage()?.removeItem(OWNER_KEY)
  } catch {
    /* nothing to release */
  }
}

/**
 * Claim the save when it is free and keep the claim alive with a heartbeat. `onChange(owner)` fires
 * whenever ownership changes hands: false when another tab claims (or already holds) the save, true
 * once its stamp goes stale or it releases. Two tabs opening at once both claim; the later write
 * wins and the other's next heartbeat notices and steps back. Returns a stop function.
 */
export function startTabLock(onChange: (owner: boolean) => void): () => void {
  let owner = isOwner()
  if (owner) claim()
  else onChange(false)

  const check = () => {
    const now = isOwner()
    if (now) claim()
    if (now !== owner) {
      owner = now
      onChange(owner)
    }
  }

  const timer = setInterval(check, HEARTBEAT_MS)
  const onStorage = (e: StorageEvent) => {
    if (e.key === OWNER_KEY || e.key === null) check()
  }
  const onPageHide = () => release()
  const hasWindow = typeof window !== 'undefined'
  if (hasWindow) {
    window.addEventListener('storage', onStorage)
    window.addEventListener('pagehide', onPageHide)
  }

  return () => {
    clearInterval(timer)
    if (hasWindow) {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pagehide', onPageHide)
    }
    release()
  }
}
