// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
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
