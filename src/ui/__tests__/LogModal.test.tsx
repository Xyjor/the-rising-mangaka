// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame } from '../../sim'
import type { LogEntry } from '../../sim'
import { markLogSeen, useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { LogModal } from '../panels/LogModal'

const LOG: LogEntry[] = [
  { id: 1, day: 0, kind: 'info', text: 'Opened the studio', toast: false },
  { id: 2, day: 9, kind: 'money', text: 'Paid the rent', toast: false },
]

beforeEach(() => {
  useStore.setState({ game: { ...createGame('Rin', 1), log: LOG, nextLogId: 3 }, modal: 'log', readOnly: false })
  markLogSeen(0)
})

describe('LogModal', () => {
  it('lists entries newest first and marks them seen', () => {
    const { container } = render(<LogModal />)
    expect(screen.getByRole('dialog', { name: 'Studio log' })).toBeTruthy()
    const items = screen.getAllByRole('listitem')
    expect(items[0].textContent).toContain('Month 1, week 2, day 3')
    expect(items[1].textContent).toContain('Month 1, week 1, day 1')
    expect(container.ownerDocument.querySelector("li[data-kind='money']")).toBeTruthy()
    expect(useClock.getState().logSeenId).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useStore.getState().modal).toBe('none')
  })

  it('says so when nothing is logged', () => {
    useStore.setState({ game: { ...createGame('Rin', 1), log: [], nextLogId: 1 } })
    render(<LogModal />)
    expect(screen.getByText('Nothing logged yet.')).toBeTruthy()
  })
})
