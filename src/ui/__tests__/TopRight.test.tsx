// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { createGame } from '../../sim'
import { useStore } from '../../state/store'
import { TopRight } from '../hud/TopRight'

let restore: () => void = () => {}

beforeEach(() => {
  restore = stubReducedMotion(true)
  useStore.setState({ game: createGame('Rin', 1), modal: 'none', readOnly: false })
})

afterEach(() => restore())

describe('TopRight', () => {
  it('shows money, weekly costs, stamina and experience for a fresh game', () => {
    const { container } = render(<TopRight />)
    expect(screen.getByText('¥3,000')).toBeTruthy()
    expect(screen.getByText('−¥400 a week')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Stamina' }).getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByRole('progressbar', { name: 'Experience' }).getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getAllByText('0/100').length).toBeGreaterThan(0)
    expect(container.querySelector('.badge-hud.money:not(.neg)')).toBeTruthy()
  })

  it('marks money below zero', () => {
    const g = createGame('Rin', 1)
    useStore.setState({ game: { ...g, player: { ...g.player, money: -50 } } })
    const { container } = render(<TopRight />)
    expect(container.querySelector('.badge-hud.stat.neg')).toBeTruthy()
    expect(container.querySelector('.badge-hud.money.neg')).toBeTruthy()
  })

  it('names unspent skill points and opens stats from the level badge', () => {
    const g = createGame('Rin', 1)
    useStore.setState({ game: { ...g, player: { ...g.player, skillPoints: 3 } } })
    render(<TopRight />)
    const level = screen.getByTitle('Open stats (S)')
    expect(level.querySelector('.lbl')!.textContent).toBe('Level 1, 3 points to spend')
    fireEvent.click(level)
    expect(useStore.getState().modal).toBe('stats')
  })
})
