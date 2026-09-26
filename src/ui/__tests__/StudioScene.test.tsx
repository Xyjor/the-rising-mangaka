// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { fakeContext } from '../../test/fakeCanvas'
import type { FakeContext } from '../../test/fakeCanvas'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { StudioScene } from '../scene/StudioScene'

const PETAL = '#f7b6c8'
const SNOW = '#f4f8ff'
/** One fill from each piece of studio art (studioArt.ts): the noren, the coffee machine, a trophy, the arm lamp. */
const NOREN = { style: '#2e3a78', x: 260, y: 58, w: 13, h: 13 }
const COFFEE = { style: '#3b3b45', x: 183, y: 73, w: 7, h: 7 }
const TROPHY = { style: '#f5b700', x: 194, y: 74, w: 3, h: 3 }
const LAMP_SHADE = { style: '#e8e4d8', x: 157, y: 80, w: 6, h: 2 }

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
  useClock.setState({ t: 0.3 })
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

  it('paints the studio the player has built, and repaints when it changes', () => {
    render(<StudioScene running={false} />)

    const built: GameState = { ...game, studio: { tier: 'flat', owned: ['coffee'] }, awards: [{ id: 'rookie', year: 1 }] }
    act(() => useStore.setState({ game: built }))
    expect(fake.log).toContainEqual(NOREN)
    expect(fake.log).toContainEqual(COFFEE)
    expect(fake.log).toContainEqual(TROPHY)
    expect(fake.log).not.toContainEqual(LAMP_SHADE)

    fake.log.length = 0
    act(() => useStore.setState({ game: { ...built, studio: { tier: 'flat', owned: ['coffee', 'lamp'] } } }))
    expect(fake.log).toContainEqual(LAMP_SHADE)
  })

  it('reads the studio field by field: a new game object with the same studio does not repaint', () => {
    render(<StudioScene running={false} />)
    fake.log.length = 0

    act(() => useStore.setState({ game: { ...game } }))
    expect(fake.log).toHaveLength(0)

    act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
    expect(fake.log).toContainEqual(NOREN)
  })

  it('keeps the frame loop alive while a modal covers the scene', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    useStore.setState({ modal: 'studio' })
    render(<StudioScene running={false} />)

    expect(raf).toHaveBeenCalled()

    fake.log.length = 0
    act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
    expect(fake.log).toContainEqual(NOREN)
  })
})
