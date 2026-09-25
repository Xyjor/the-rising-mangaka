// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { fakeContext } from '../../test/fakeCanvas'
import type { FakeContext } from '../../test/fakeCanvas'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { useStore } from '../../state/store'
import { StudioScene } from '../scene/StudioScene'

const PETAL = '#f7b6c8'
const SNOW = '#f4f8ff'

let fake: FakeContext
let restoreMotion: () => void
let game: GameState

beforeEach(() => {
  // Under reduced motion the component repaints at once on a state change, so a test reads the paint synchronously.
  restoreMotion = stubReducedMotion(true)
  fake = fakeContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake.ctx as never)
  game = createGame('Rin', 1)
  useStore.setState({ game, speed: 0, modal: 'none', toasts: [], tutorialStep: 0, readOnly: false })
})

afterEach(() => {
  vi.restoreAllMocks()
  restoreMotion()
})

describe('StudioScene', () => {
  it('paints the season of the game day in the window', () => {
    render(<StudioScene running={false} />)

    act(() => useStore.setState({ game: { ...game, day: 260 } }))
    expect(fake.log.some((c) => c.style === SNOW)).toBe(true)
    expect(fake.log.some((c) => c.style === PETAL)).toBe(false)

    fake.log.length = 0
    act(() => useStore.setState({ game: { ...game, day: 336 + 20 } }))
    expect(fake.log.some((c) => c.style === PETAL)).toBe(true)
    expect(fake.log.some((c) => c.style === SNOW)).toBe(false)
  })
})
