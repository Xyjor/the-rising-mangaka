// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame } from '../../sim'
import { useStore } from '../../state/store'
import { SettingsModal } from '../panels/SettingsModal'

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), theme: 'auto', modal: 'settings', readOnly: false })
})

describe('SettingsModal', () => {
  it('switches the theme when a segment button is clicked, updating aria-pressed', () => {
    render(<SettingsModal />)
    const dark = screen.getByRole('button', { name: 'Dark' })
    const auto = screen.getByRole('button', { name: 'Auto' })

    fireEvent.click(dark)

    expect(useStore.getState().theme).toBe('dark')
    expect(dark.getAttribute('aria-pressed')).toBe('true')
    expect(auto.getAttribute('aria-pressed')).toBe('false')
  })
})
