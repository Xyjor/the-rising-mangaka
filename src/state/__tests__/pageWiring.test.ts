// @vitest-environment happy-dom
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createGame } from '../../sim'
import { OWNER_KEY } from '../tabLock'

// A second browser tab: the first tab's fresh owner stamp is in storage before this one's store loads.
localStorage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'the-first-tab', at: Date.now() }))
const { useStore } = await import('../store')

const st = () => useStore.getState()

let visibility: DocumentVisibilityState = 'visible'
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })

function setVisibility(v: DocumentVisibilityState) {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

afterAll(() => {
  delete (document as { visibilityState?: unknown }).visibilityState
})

describe('the store in a browser tab', () => {
  it('keeps the tab lock: a second tab mirrors the first read-only until it takes over', () => {
    expect(st().readOnly).toBe(true)
    expect(localStorage.getItem(OWNER_KEY)).toContain('the-first-tab')
  })

  describe('page visibility', () => {
    beforeEach(() => {
      useStore.setState({ game: createGame('Rin', 42), speed: 0, resumeSpeed: 1, windowHidden: false })
      visibility = 'visible'
    })

    it('hiding the page stops the clock, and showing it again leaves the clock stopped', () => {
      useStore.setState({ speed: 2 })
      setVisibility('hidden')
      expect(st().windowHidden).toBe(true)
      expect(st().speed).toBe(0)
      setVisibility('visible')
      expect(st().windowHidden).toBe(false)
      expect(st().speed).toBe(0)
      expect(st().resumeSpeed).toBe(2)
    })
  })
})
