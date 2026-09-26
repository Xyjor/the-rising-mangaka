import { describe, expect, it } from 'vitest'
import { installFakeStorage } from '../../test/fakeStorage'

// Its own file: disableTabLock sets a module flag for good, which must not leak into tabLock.test.ts.
const storage = installFakeStorage()
const { OWNER_KEY, disableTabLock, isOwner } = await import('../tabLock')

const stampForeign = () => storage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'someone-else', at: Date.now() }))

describe('disableTabLock (desktop: one window only)', () => {
  it('owns the save from then on and removes any owner stamp, fresh or not', () => {
    stampForeign()
    expect(isOwner()).toBe(false)
    disableTabLock()
    expect(isOwner()).toBe(true)
    expect(storage.getItem(OWNER_KEY)).toBeNull()
    // A stamp that turns up later cannot take the save away either.
    stampForeign()
    expect(isOwner()).toBe(true)
  })
})
