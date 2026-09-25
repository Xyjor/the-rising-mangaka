// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { prefersReducedMotion } from '../motion'

describe('prefersReducedMotion', () => {
  it('reads true when the platform requests reduced motion', () => {
    const restore = stubReducedMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    restore()
  })

  it('reads false when the platform does not request reduced motion', () => {
    const restore = stubReducedMotion(false)
    expect(prefersReducedMotion()).toBe(false)
    restore()
  })
})
