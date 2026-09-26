// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { acceptOffer, createGame } from '../../sim'
import type { GameState } from '../../sim'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { withPendingResult } from '../../test/fixtures'
import { TopLeft } from '../hud/TopLeft'

const OFFER = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const

/** The same helper as deadline.test: seed 1 with a Kids Comic Go! serial, chapter 3 due in `daysLeft` days. */
function chapterDue(daysLeft: number, pagesDone = 12): GameState {
  const s = acceptOffer({ ...createGame('Rin', 1), pendingOffer: OFFER })
  return {
    ...s,
    project: { ...s.project!, chapter: 3, pagesDone },
    serial: { ...s.serial!, chaptersSent: 2, nextDueDay: s.day + daysLeft },
  }
}

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), speed: 0, readOnly: false, tutorialStep: -1 })
  useClock.setState({ t: 0.3 })
})

describe('TopLeft', () => {
  it('shows the date, the weekday and whether it is day or night', () => {
    useStore.setState({ game: { ...createGame('Rin', 1), day: 45 } })
    const { unmount } = render(<TopLeft />)
    expect(screen.getByText('Year 1, month 2, week 3')).toBeTruthy()
    expect(screen.getByText('Day 4 of 7')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Day' })).toBeTruthy()
    unmount()
    useClock.setState({ t: 0.8 })
    render(<TopLeft />)
    expect(screen.getByRole('img', { name: 'Night' })).toBeTruthy()
  })

  it('sets the game speed, and locks it while a decision waits', () => {
    const { unmount } = render(<TopLeft />)
    const group = within(screen.getByRole('group', { name: 'Game speed' }))
    expect(group.getAllByRole('button')).toHaveLength(4)
    fireEvent.click(group.getByRole('button', { name: 'Double speed' }))
    expect(useStore.getState().speed).toBe(2)
    unmount()
    useStore.setState({ game: withPendingResult() })
    render(<TopLeft />)
    const locked = within(screen.getByRole('group', { name: 'Game speed' })).getAllByRole('button') as HTMLButtonElement[]
    expect(locked.every((b) => b.disabled)).toBe(true)
  })

  it('shows the chapter deadline, with a warning tone when it is at risk', () => {
    useStore.setState({ game: chapterDue(5) })
    const { unmount } = render(<TopLeft />)
    const ok = screen.getByLabelText('Deadline in 5 days, on track')
    expect(ok.getAttribute('data-tone')).toBe('ok')
    expect(ok.textContent).toContain('5 d')
    unmount()
    useStore.setState({ game: chapterDue(3) })
    render(<TopLeft />)
    expect(screen.getByLabelText('Deadline in 3 days, at this pace you will miss the issue').getAttribute('data-tone')).toBe('warn')
  })

  it('has no deadline chip without a serial', () => {
    const { container } = render(<TopLeft />)
    expect(container.querySelector('.deadline')).toBeNull()
  })
})
