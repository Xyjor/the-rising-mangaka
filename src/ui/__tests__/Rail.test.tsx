// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, hireAssistant } from '../../sim'
import type { LogEntry } from '../../sim'
import { markLogSeen } from '../../state/clock'
import { useStore } from '../../state/store'
import { LogButton, Rail, SettingsButton } from '../hud/Rail'

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), modal: 'none', readOnly: false })
  markLogSeen(0)
})

describe('Rail', () => {
  it('lists the studio menus in order, Series disabled with no serial', () => {
    render(<Rail />)
    const buttons = within(screen.getByRole('navigation', { name: 'Studio menus' })).getAllByRole('button') as HTMLButtonElement[]
    expect(buttons.map((b) => b.textContent)).toEqual(
      ['Notebook', 'Stats', 'Staff', 'Studio', 'Trips', 'Series', 'History', 'Career', 'Badges'])
    expect(buttons[5].disabled).toBe(true)
    fireEvent.click(buttons[0])
    expect(useStore.getState().modal).toBe('notebook')
    fireEvent.click(screen.getByTitle('Badges (G)'))
    expect(useStore.getState().modal).toBe('badges')
  })

  it('badges discoveries, skill points and staff', () => {
    const g = createGame('Rin', 1)
    const hired = hireAssistant(g, g.candidates[0].id)
    useStore.setState({
      game: {
        ...hired,
        notebook: { ...hired.notebook, genreTheme: { 'action|samurai': 3 }, themeAudience: { 'samurai|teens': 2 } },
        player: { ...hired.player, skillPoints: 3 },
      },
    })
    render(<Rail />)
    expect(screen.getByLabelText('2 pairs discovered')).toBeTruthy()
    expect(screen.getByLabelText('3 points to spend')).toBeTruthy()
    expect(screen.getByLabelText('1 assistant')).toBeTruthy()
  })

  it('counts unread log entries and opens the log', () => {
    const g = createGame('Rin', 1)
    const log: LogEntry[] = [1, 2, 3].map((id) => ({ id, day: 0, kind: 'info', text: `Entry ${id}`, toast: false }))
    useStore.setState({ game: { ...g, log, nextLogId: 4 } })
    markLogSeen(2)
    render(<LogButton />)
    expect(screen.getByLabelText('2 unread')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Studio log (L)'))
    expect(useStore.getState().modal).toBe('log')
  })

  it('opens settings, and has exactly one button named Studio', () => {
    render(<><Rail /><LogButton /><SettingsButton /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(useStore.getState().modal).toBe('settings')
    expect(screen.getAllByRole('button', { name: 'Studio' })).toHaveLength(1)
  })
})
