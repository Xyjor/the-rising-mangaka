// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, startProject } from '../../sim'
import { DRAFT } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { App } from '../App'

beforeEach(() => {
  useStore.setState({
    game: createGame('Rin', 1), speed: 0, modal: 'none', toasts: [], tutorialStep: -1, readOnly: false,
  })
})

describe('log hotkey', () => {
  it('opens the studio log on l', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'l' })
    expect(useStore.getState().modal).toBe('log')
    expect(screen.getByRole('dialog', { name: 'Studio log' })).toBeTruthy()
  })

  it('is a no-op once the log is already open', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'l' })
    fireEvent.keyDown(window, { key: 'l' })
    expect(useStore.getState().modal).toBe('log')
  })

  it('leaves another modal open', () => {
    useStore.setState({ modal: 'stats' })
    render(<App />)
    fireEvent.keyDown(window, { key: 'l' })
    expect(useStore.getState().modal).toBe('stats')
  })

  it('still opens the notebook on b', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'b' })
    expect(useStore.getState().modal).toBe('notebook')
  })

  it('does nothing when typed into an input', () => {
    render(<App />)
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'l' })
    expect(useStore.getState().modal).toBe('none')
    document.body.removeChild(input)
  })
})

describe('hotkeys with the tutorial guide showing', () => {
  const guide = () => document.querySelector('.tutorial-bubble')

  it('l and b still open their windows over a guided step', () => {
    useStore.setState({ tutorialStep: 8 })
    render(<App />)
    expect(guide()).not.toBeNull()
    fireEvent.keyDown(document.activeElement ?? window, { key: 'l' })
    expect(useStore.getState().modal).toBe('log')
    useStore.setState({ modal: 'none' })
    fireEvent.keyDown(window, { key: 'b' })
    expect(useStore.getState().modal).toBe('notebook')
  })

  it('Space still runs the clock (and completes the clock step), even with focus on the guide', () => {
    useStore.setState({ game: startProject(createGame('Rin', 1), DRAFT), tutorialStep: 4 })
    render(<App />)
    expect(guide()).not.toBeNull()
    screen.getByRole('button', { name: 'Skip the tutorial' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: ' ' })
    expect(useStore.getState().speed).toBeGreaterThan(0)
    expect(useStore.getState().tutorialStep).toBe(5)
  })

  it('n still opens the wizard on the first step', () => {
    useStore.setState({ tutorialStep: 0 })
    render(<App />)
    expect(guide()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'n' })
    expect(useStore.getState().modal).toBe('wizard')
    expect(useStore.getState().tutorialStep).toBe(1)
  })
})
