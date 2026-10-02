// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { fakeContext } from '../../test/fakeCanvas'
import { PLACES, addLog, createGame, startTrip } from '../../sim'
import type { GameState } from '../../sim'
import { withPendingResult } from '../../test/fixtures'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { StudioScene } from '../scene/StudioScene'
import { BUBBLE_MS } from '../scene/Bubble'

let restoreMotion: () => void
let game: GameState

const bubbles = (who: string) => document.querySelectorAll(`.bubble[data-who=${who}]`)

beforeEach(() => {
  vi.useFakeTimers()
  restoreMotion = stubReducedMotion(true)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext().ctx as never)
  game = createGame('Rin', 1)
  useStore.setState({ game, speed: 0, modal: 'none', toasts: [], tutorialStep: -1, readOnly: false })
  useClock.setState({ t: 0.3 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  restoreMotion()
})

describe('speech bubbles', () => {
  it('shows an info line above the mangaka for BUBBLE_MS', () => {
    expect(BUBBLE_MS).toBe(4000)
    render(<StudioScene running={false} />)
    act(() => useStore.setState({ game: addLog(game, 'info', 'Coffee first.', false) }))
    const b = bubbles('mangaka')
    expect(b).toHaveLength(1)
    expect(b[0].textContent).toBe('Coffee first.')
    expect(b[0].getAttribute('role')).toBe('status')
    expect(b[0].classList.contains('pixel-bubble')).toBe(true)
    act(() => { vi.advanceTimersByTime(4000) })
    expect(bubbles('mangaka')).toHaveLength(0)
  })

  it('a newer line replaces the bubble', () => {
    render(<StudioScene running={false} />)
    const one = addLog(game, 'info', 'One.', false)
    act(() => useStore.setState({ game: one }))
    act(() => useStore.setState({ game: addLog(one, 'info', 'Two.', false) }))
    const b = bubbles('mangaka')
    expect(b).toHaveLength(1)
    expect(b[0].textContent).toBe('Two.')
  })

  it('never shows a warn line or a toast', () => {
    render(<StudioScene running={false} />)
    act(() => useStore.setState({ game: addLog(game, 'warn', 'Careful.', false) }))
    expect(document.querySelectorAll('.bubble')).toHaveLength(0)
    act(() => useStore.setState({ game: addLog(game, 'info', 'Loud.', true) }))
    expect(document.querySelectorAll('.bubble')).toHaveLength(0)
  })

  it('the editor greets on arrival, and the greeting goes when they leave', () => {
    render(<StudioScene running={false} />)
    const pending = withPendingResult()
    act(() => useStore.setState({ game: pending }))
    const b = bubbles('editor')
    expect(b).toHaveLength(1)
    expect(b[0].textContent).toBe('The poll results are in.')
    act(() => useStore.setState({ game: { ...pending, pendingResult: null } }))
    expect(bubbles('editor')).toHaveLength(0)
  })

  it('hides the editor greeting while a tutorial step is showing', () => {
    render(<StudioScene running={false} />)
    act(() => useStore.setState({ game: withPendingResult() }))
    expect(bubbles('editor')).toHaveLength(1)
    act(() => useStore.setState({ tutorialStep: 8 }))
    expect(bubbles('editor')).toHaveLength(0)
    act(() => useStore.setState({ tutorialStep: -1 }))
    expect(bubbles('editor')).toHaveLength(1)
  })

  it('the editor visiting for the tutorial says nothing in the scene', () => {
    render(<StudioScene running={false} />)
    act(() => useStore.setState({ tutorialStep: 0 }))
    act(() => useStore.setState({ tutorialStep: -1 }))
    expect(bubbles('editor')).toHaveLength(0)
  })

  it('a loaded save with a new info line shows no bubble', () => {
    render(<StudioScene running={false} />)
    act(() => useStore.setState({ game: addLog(game, 'info', 'From the file.', false), saveLoads: useStore.getState().saveLoads + 1 }))
    expect(document.querySelectorAll('.bubble')).toHaveLength(0)
  })

  it('no mangaka bubble while away on a trip', () => {
    render(<StudioScene running={false} />)
    const rich = { ...game, player: { ...game.player, money: 1_000_000 } }
    const away = startTrip(rich, PLACES[0].id)
    expect(away.trip).not.toBeNull()
    act(() => useStore.setState({ game: away }))
    act(() => useStore.setState({ game: addLog(away, 'info', 'Postcard.', false) }))
    expect(bubbles('mangaka')).toHaveLength(0)
  })
})
