// @vitest-environment happy-dom
// Hiding the desk (the status card and the desk tray) to look at the studio: a button by Settings and the d key, never
// in the way of a decision (the auto-pause shows the desk again).
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, getPhase, startProject, tick } from '../../sim'
import type { GameState } from '../../sim'
import { DRAFT } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { App } from '../App'

beforeEach(() => {
  useStore.setState({
    game: createGame('Rin', 1), speed: 0, modal: 'none', toasts: [], tutorialStep: -1, readOnly: false, deskHidden: false,
  })
})

const dock = (container: HTMLElement) => container.querySelector('.dock') as HTMLElement

describe('hiding the desk', () => {
  it('hides the dock with the button and shows it again', () => {
    const { container } = render(<App />)
    expect(dock(container).hidden).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Hide the desk' }))
    expect(dock(container).hidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Show the desk' }))
    expect(dock(container).hidden).toBe(false)
  })

  it('toggles on d', () => {
    const { container } = render(<App />)
    fireEvent.keyDown(window, { key: 'd' })
    expect(dock(container).hidden).toBe(true)
    fireEvent.keyDown(window, { key: 'd' })
    expect(dock(container).hidden).toBe(false)
  })

  it('shows the desk again when the game stops for a decision', () => {
    // one tick short of a finished manuscript
    let s: GameState = startProject(createGame('Rin', 1), DRAFT)
    let guard = 0
    while (getPhase(tick(s)) !== 'ready' && guard++ < 400) s = tick(s)
    useStore.setState({ game: s, speed: 1, deskHidden: true })
    useStore.getState().tick()
    expect(getPhase(useStore.getState().game!)).toBe('ready')
    expect(useStore.getState().deskHidden).toBe(false)
  })

  it('keeps the desk hidden across an ordinary day', () => {
    useStore.setState({ game: startProject(createGame('Rin', 1), DRAFT), speed: 1, deskHidden: true })
    useStore.getState().tick()
    expect(useStore.getState().deskHidden).toBe(true)
  })
})
