// Plain node environment (no `window` global at all): the SSR/build-tooling case.
import { describe, expect, it } from 'vitest'
import { prefersReducedMotion } from '../motion'

describe('prefersReducedMotion (node)', () => {
  it('returns false when there is no window to query', () => {
    expect(typeof window).toBe('undefined')
    expect(prefersReducedMotion()).toBe(false)
  })
})
