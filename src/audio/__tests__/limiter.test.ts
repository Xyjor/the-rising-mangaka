import { describe, expect, it } from 'vitest'
import { createLimiter } from '../limiter'

describe('cue limiter', () => {
  it('holds a cue for its gap after each allowed play', () => {
    const limiter = createLimiter({ page: 600 })
    expect(limiter.allow('page', 0)).toBe(true)
    expect(limiter.allow('page', 500)).toBe(false)
    expect(limiter.allow('page', 600)).toBe(true)
    expect(limiter.allow('page', 1199)).toBe(false)
    expect(limiter.allow('page', 1200)).toBe(true)
  })

  it('keeps each cue independent', () => {
    const limiter = createLimiter({ page: 600, warn: 1500 })
    expect(limiter.allow('page', 0)).toBe(true)
    expect(limiter.allow('warn', 100)).toBe(true)
    expect(limiter.allow('page', 500)).toBe(false)
    expect(limiter.allow('warn', 1000)).toBe(false)
    expect(limiter.allow('page', 600)).toBe(true)
    expect(limiter.allow('warn', 1600)).toBe(true)
  })

  it('never holds a cue that has no gap', () => {
    const limiter = createLimiter({ page: 600 })
    expect(limiter.allow('click', 0)).toBe(true)
    expect(limiter.allow('click', 0)).toBe(true)
    expect(limiter.allow('click', 1)).toBe(true)
  })
})
