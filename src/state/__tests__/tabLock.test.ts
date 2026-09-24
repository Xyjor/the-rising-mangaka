import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Map-backed stand-in for window.localStorage, installed before the module under test loads. */
function installFakeStorage() {
  const map = new Map<string, string>()
  const fake = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: vi.fn((k: string, v: string) => { map.set(k, String(v)) }),
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true })
  return fake
}

const storage = installFakeStorage()
const lock = await import('../tabLock')
const { OWNER_KEY, STALE_MS, claim, isOwner, read, release, startTabLock, tabId } = lock

function stampForeign(at = Date.now()) {
  storage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'someone-else', at }))
}

describe('tab lock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('owns a fresh store and keeps ownership after claiming', () => {
    expect(isOwner()).toBe(true)
    claim()
    expect(read()?.tabId).toBe(tabId)
    expect(isOwner()).toBe(true)
  })

  it('steps back when another tab holds a fresh record', () => {
    stampForeign()
    expect(isOwner()).toBe(false)
  })

  it('treats a foreign record older than STALE_MS as abandoned', () => {
    stampForeign(Date.now() - (STALE_MS + 1))
    expect(isOwner()).toBe(true)
  })

  it('release removes only our own record', () => {
    stampForeign()
    release()
    expect(read()?.tabId).toBe('someone-else')
    claim()
    release()
    expect(read()).toBeNull()
  })

  it('startTabLock reports a foreign owner, then takes over once the foreign stamp goes stale', () => {
    stampForeign()
    const onChange = vi.fn()
    const stop = startTabLock(onChange)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(false)
    vi.advanceTimersByTime(STALE_MS + 2001)
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(read()?.tabId).toBe(tabId)
    stop()
  })

  it('startTabLock claims at once when nobody owns the store and keeps the heartbeat fresh', () => {
    const onChange = vi.fn()
    const stop = startTabLock(onChange)
    expect(onChange).not.toHaveBeenCalled()
    const first = read()!
    expect(first.tabId).toBe(tabId)
    vi.advanceTimersByTime(2000)
    expect(read()!.at).toBeGreaterThan(first.at)
    stop()
  })
})
