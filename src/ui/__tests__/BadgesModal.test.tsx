// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { BADGES, createGame } from '../../sim'
import { PROFILE_KEY } from '../../state/profile'
import { useStore } from '../../state/store'
import { BadgesModal } from '../panels/BadgesModal'

function tile(title: string) {
  return screen.getAllByRole('listitem').find((li) => li.textContent?.includes(title))!
}

beforeEach(() => {
  localStorage.removeItem(PROFILE_KEY)
})

describe('BadgesModal', () => {
  it('shows the count and every badge, hidden ones as ??? with a category hint', () => {
    useStore.setState({ game: createGame('Rin', 1), readOnly: false })
    render(<BadgesModal />)
    expect(screen.getByText(`0 of ${BADGES.length} badges`)).toBeTruthy()
    const items = within(screen.getByRole('list', { name: 'Badges' })).getAllByRole('listitem')
    expect(items).toHaveLength(15)
    expect(items.filter((li) => li.getAttribute('data-state') === 'locked')).toHaveLength(15)
    expect(screen.queryByText('Pull an all-nighter')).toBeNull()
    expect(screen.getByText('A secret about deadlines')).toBeTruthy()
    // a visible badge shows its title and hint before it is earned
    expect(tile('Millionaire').textContent).toContain('Hold ¥1,000,000')
  })

  it('shows a badge earned in this career with its date, and one from an earlier career dimmed', () => {
    const g = createGame('Rin', 1)
    useStore.setState({ game: { ...g, badges: [{ id: 'stop-presses', day: 30 }] }, readOnly: false })
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ badges: [
      { id: 'stop-presses', day: 3, slot: 2, penName: 'Aoi' },
      { id: 'century', day: 900, slot: 2, penName: 'Aoi' },
    ] }))
    render(<BadgesModal />)
    expect(screen.getByText(`1 of ${BADGES.length} badges`)).toBeTruthy()
    const mine = tile('Stop the presses')
    expect(mine.getAttribute('data-state')).toBe('earned')
    expect(mine.textContent).toContain('Earned Month 2, week 1, day 3')
    const earlier = tile('Century')
    expect(earlier.getAttribute('data-state')).toBe('earlier')
    expect(earlier.textContent).toContain('Earned in an earlier career')
  })
})
