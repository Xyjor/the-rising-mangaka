import { afterEach, describe, expect, it } from 'vitest'
import { isDesktop } from '../env'

const g = globalThis as { isTauri?: unknown }

afterEach(() => {
  delete g.isTauri
})

describe('isDesktop', () => {
  it('is false in a browser, where nothing sets isTauri', () => {
    expect(isDesktop()).toBe(false)
  })

  it('is true once the desktop shell has set globalThis.isTauri', () => {
    g.isTauri = true
    expect(isDesktop()).toBe(true)
  })
})
