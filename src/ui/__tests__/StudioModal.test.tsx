// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, equipmentPrice, moveInCost } from '../../sim'
import type { EquipmentId, GameState, StudioTierId } from '../../sim'
import { useStore } from '../../state/store'
import { App } from '../App'
import { money } from '../format'
import { StatsModal } from '../panels/StatsModal'
import { StudioModal } from '../panels/StudioModal'

// Money is set from the price helpers, so a new price scale leaves these tests standing.

/** Seed 1 with `cash` in the bank, in `tier`, owning `owned`. */
function studio(cash: number, tier: StudioTierId = 'apartment', owned: EquipmentId[] = []): GameState {
  const g = createGame('Rin', 1)
  return { ...g, player: { ...g.player, money: cash }, studio: { tier, owned } }
}

const row = (name: string) => within(screen.getByRole('group', { name }))
const button = (group: string, name: string) => row(group).getByRole('button', { name }) as HTMLButtonElement

/** Exactly the coffee machine's price: the cheapest piece is affordable, everything dearer is not. */
const coffeeMoney = () => equipmentPrice('coffee')

beforeEach(() => {
  useStore.setState({ game: studio(coffeeMoney()), modal: 'studio', speed: 0, toasts: [], tutorialStep: -1, readOnly: false })
})

describe('StudioModal', () => {
  it('marks the current studio and says what the next one costs and needs', () => {
    render(<StudioModal />)
    expect(row('Apartment').getByText('You are here')).toBeTruthy()
    expect(row('Apartment').getByText('No rent.')).toBeTruthy()
    expect(row('Apartment').getByText('1 desk for an assistant')).toBeTruthy()
    expect(row('Studio flat').getByText('2 desks for assistants')).toBeTruthy()
    expect(row('Studio flat').getByText('Rent ¥150 a week.')).toBeTruthy()
    expect(button('Studio flat', `Need ${money(moveInCost('flat') - coffeeMoney())} more`).disabled).toBe(true)
    expect(button('Studio loft', 'Move to the studio flat first').disabled).toBe(true)
    expect(row('Studio loft').getByText(`Rent ¥350 a week. Move-in ${money(moveInCost('loft'))}.`)).toBeTruthy()
  })

  it('moves in when the bank covers it, then offers the loft', () => {
    useStore.setState({ game: studio(moveInCost('flat') + 1000) })
    render(<StudioModal />)
    fireEvent.click(button('Studio flat', `Move in, ${money(moveInCost('flat'))}`))
    const g = useStore.getState().game!
    expect(g.studio.tier).toBe('flat')
    expect(g.player.money).toBe(1000)
    expect(row('Studio flat').getByText('You are here')).toBeTruthy()
    expect(row('Apartment').getByText('Moved out')).toBeTruthy()
    expect(button('Studio loft', `Need ${money(moveInCost('loft') - 1000)} more`).disabled).toBe(true)
    expect(row('Studio loft').getByText('Rent ¥350 a week.')).toBeTruthy()
  })

  it('lists every piece of equipment with its effect and a button that says what it takes', () => {
    render(<StudioModal />)
    expect(row('Daylight lamp').getByText('Art +3 on your pages')).toBeTruthy()
    expect(row('Pen tablet').getByText('15% more pages a day, art +2')).toBeTruthy()
    expect(button('Coffee machine', `Buy, ${money(equipmentPrice('coffee'))}`).disabled).toBe(false)
    expect(button('Ergonomic chair', `Need ${money(equipmentPrice('chair') - coffeeMoney())} more`).disabled).toBe(true)
    // too small comes before too dear: the tablet names the studio it needs
    expect(button('Pen tablet', 'Needs a studio flat').disabled).toBe(true)
  })

  it('buys a piece, which then reads Owned', () => {
    render(<StudioModal />)
    fireEvent.click(button('Coffee machine', `Buy, ${money(equipmentPrice('coffee'))}`))
    const g = useStore.getState().game!
    expect(g.studio.owned).toEqual(['coffee'])
    expect(g.player.money).toBe(0)
    expect(button('Coffee machine', 'Owned').disabled).toBe(true)
  })

  it('sells the pen tablet in the flat', () => {
    useStore.setState({ game: studio(equipmentPrice('tablet'), 'flat') })
    render(<StudioModal />)
    expect(button('Pen tablet', `Buy, ${money(equipmentPrice('tablet'))}`).disabled).toBe(false)
  })

  it('opens from the Studio button on the desk', () => {
    useStore.setState({ modal: 'none' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Studio' }))
    expect(screen.getByRole('dialog', { name: 'Studio' })).toBeTruthy()
  })
})

describe('StatsModal equipment', () => {
  it('lists what the studio owns, with each effect, under the reward tiles', () => {
    useStore.setState({ game: studio(3000, 'apartment', ['lamp', 'coffee']) })
    render(<StatsModal />)
    const list = within(screen.getByRole('list', { name: 'Equipment' }))
    expect(list.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Coffee machine: Resting restores 3 more stamina a day',
      'Daylight lamp: Art +3 on your pages',
    ])
  })

  it('says where to buy equipment when the studio has none', () => {
    render(<StatsModal />)
    expect(screen.getByText('No equipment yet. The Studio sells gear that helps you draw and rest.')).toBeTruthy()
  })
})
