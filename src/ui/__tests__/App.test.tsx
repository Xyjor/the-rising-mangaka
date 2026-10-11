// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { withPendingResult } from '../../test/fixtures'
import { createGame } from '../../sim'
import { useStore } from '../../state/store'
import { App } from '../App'

beforeEach(() => {
  useStore.setState({
    game: createGame('Rin', 1), speed: 0, modal: 'none', toasts: [], tutorialStep: 0, readOnly: false,
  })
})

describe('App smoke test', () => {
  it('opens the new-manga wizard dialog from the desk button on a fresh game', () => {
    render(<App />)
    const button = screen.getByRole('button', { name: /Plan a new manga/i })

    fireEvent.click(button)

    expect(screen.getByRole('dialog', { name: 'Plan a new manga' })).toBeTruthy()
  })
})

describe('the editor brings the results', () => {
  let restore: () => void = () => {}
  afterEach(() => { vi.useRealTimers(); restore() })

  it('mounts the results 1650 ms after they land, once the editor has walked in', () => {
    restore = stubReducedMotion(false)
    vi.useFakeTimers()
    render(<App />)
    act(() => useStore.setState({ game: withPendingResult() }))
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => { vi.advanceTimersByTime(1650) })
    expect(screen.getByRole('dialog', { name: /Reader poll results/i })).toBeTruthy()
  })

  it('mounts them at once under reduced motion', () => {
    restore = stubReducedMotion(true)
    render(<App />)
    act(() => useStore.setState({ game: withPendingResult() }))
    expect(screen.getByRole('dialog', { name: /Reader poll results/i })).toBeTruthy()
  })
})
