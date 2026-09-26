// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, hireAssistant } from '../../sim'
import type { GameState, StudioTierId } from '../../sim'
import { useStore } from '../../state/store'
import { StaffModal } from '../panels/StaffModal'

/** Seed 42 with ¥100,000, in `tier`, with the first `hires` candidates hired. */
function staffed(tier: StudioTierId, hires: number): GameState {
  const g = createGame('Rin', 42)
  let s: GameState = { ...g, player: { ...g.player, money: 100_000 }, studio: { tier, owned: [] } }
  for (let i = 0; i < hires; i++) s = hireAssistant(s, s.candidates[0].id)
  if (s.assistants.length !== hires) throw new Error(`the fixture needs ${hires} assistants hired`)
  return s
}

const hireButtons = () => screen.getAllByRole('button').filter((b) => b.closest('section')?.textContent?.includes('Looking for work'))

beforeEach(() => {
  useStore.setState({ game: staffed('apartment', 0), modal: 'staff', readOnly: false })
})

describe('StaffModal desks', () => {
  it('counts the desks the studio has: one in the apartment', () => {
    render(<StaffModal />)
    expect(screen.getByText('(0 of 1 desk)')).toBeTruthy()
    expect(hireButtons().map((b) => b.textContent)).toEqual(['Hire', 'Hire', 'Hire'])
  })

  it('with the only desk taken, the hire buttons say to move to a bigger studio and open the Studio panel', () => {
    const game = staffed('apartment', 1)
    useStore.setState({ game })
    render(<StaffModal />)
    expect(screen.getByText('(1 of 1 desk)')).toBeTruthy()
    const buttons = hireButtons()
    expect(buttons).toHaveLength(2)
    for (const b of buttons) {
      expect(b.textContent).toBe('Move to a bigger studio for another desk')
      expect((b as HTMLButtonElement).disabled).toBe(false)
    }
    fireEvent.click(buttons[0])
    expect(useStore.getState().modal).toBe('studio')
    // nobody was hired: the button only opens the panel
    expect(useStore.getState().game).toBe(game)
  })

  it('has a free desk in the flat, and names the rent in the weekly costs', () => {
    const g = staffed('flat', 1)
    useStore.setState({ game: g })
    render(<StaffModal />)
    expect(screen.getByText('(1 of 2 desks)')).toBeTruthy()
    expect(hireButtons().map((b) => b.textContent)).toEqual(['Hire', 'Hire'])
    const salary = g.assistants[0].salary
    expect(screen.getByText(new RegExp(`Weekly costs ¥${(550 + salary).toLocaleString('en-US')}: living ¥400, rent ¥150, salaries ¥${salary}\\.`)))
      .toBeTruthy()
  })

  it('in the loft with every desk taken, someone has to go first', () => {
    // three hires empty the candidate list; seed 7's candidates stand in for next month's
    useStore.setState({ game: { ...staffed('loft', 3), candidates: createGame('Rin', 7).candidates } })
    render(<StaffModal />)
    expect(screen.getByText('(3 of 3 desks)')).toBeTruthy()
    const buttons = hireButtons()
    expect(buttons).toHaveLength(3)
    for (const b of buttons) {
      expect(b.textContent).toBe('Full, let someone go first')
      expect((b as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
