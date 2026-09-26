// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { acceptOffer, createGame } from '../../sim'
import type { EventId, GameEvent, GameState, Player } from '../../sim'
import { useStore } from '../../state/store'
import { EventCard } from '../EventCard'
import { DeskTray } from '../hud/DeskTray'
import { TripsModal } from '../panels/TripsModal'

const KIDS_OFFER = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const

/** Seed 1 with `player` patched and `id` waiting on the desk, `daysLeft` days before it expires. */
function withEvent(id: EventId, player: Partial<Player> = {}, daysLeft = 7, base = createGame('Rin', 1)): GameState {
  const event: GameEvent = { id, day: base.day, expiresDay: base.day + daysLeft }
  return { ...base, player: { ...base.player, ...player }, event }
}

/** The store's own action, put back before each test because one test swaps in a spy. */
const realResolveEvent = useStore.getState().resolveEvent

beforeEach(() => {
  useStore.setState({
    game: createGame('Rin', 1), tutorialStep: -1, readOnly: false, speed: 0, toasts: [], resolveEvent: realResolveEvent,
  })
})

describe('EventCard', () => {
  it('renders nothing when no event is waiting', () => {
    const { container } = render(<EventCard />)
    expect(container.firstChild).toBeNull()
  })

  it('states each answer\'s effects on its button and sends that answer to resolveEvent', () => {
    const resolveEvent = vi.fn()
    useStore.setState({ game: withEvent('letter', { fans: 10_000 }), resolveEvent })
    render(<EventCard />)
    const card = screen.getByRole('region', { name: 'A fan letter arrived' })
    expect(card.textContent).toContain('A reader says your manga got them through a hard week.')
    expect(screen.getByText('Answer within 7 days. If you ignore it, nothing happens.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it: stamina +8' }))
    expect(resolveEvent).toHaveBeenLastCalledWith('b')
    fireEvent.click(screen.getByRole('button', { name: 'Write back: fans +200, stamina -5' }))
    expect(resolveEvent).toHaveBeenLastCalledWith('a')
  })

  it('applies the answer and leaves the desk once it is answered', () => {
    useStore.setState({ game: withEvent('letter', { fans: 10_000 }) })
    render(<EventCard />)
    fireEvent.click(screen.getByRole('button', { name: 'Write back: fans +200, stamina -5' }))
    expect(useStore.getState().game!.event).toBeNull()
    expect(useStore.getState().game!.player.fans).toBe(10_200)
    expect(screen.queryByRole('region', { name: 'A fan letter arrived' })).toBeNull()
  })

  it('counts the days left to answer, down to the last one', () => {
    useStore.setState({ game: withEvent('cold', {}, 1) })
    const { unmount } = render(<EventCard />)
    expect(screen.getByText('Answer within 1 day. If you ignore it, nothing happens.')).toBeTruthy()
    unmount()
    useStore.setState({ game: withEvent('cold', {}, 0) })
    render(<EventCard />)
    expect(screen.getByText('Answer today. If you ignore it, nothing happens.')).toBeTruthy()
  })

  it('disables an answer the player cannot afford and says what it needs', () => {
    useStore.setState({ game: withEvent('cold', { money: 120 }) })
    render(<EventCard />)
    const doctor = screen.getByRole('button', { name: 'See a doctor: -¥300, stamina +25' }) as HTMLButtonElement
    expect(doctor.disabled).toBe(true)
    expect(screen.getByText('Need ¥180 more.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Tea and an early night: stamina +8' }) as HTMLButtonElement).disabled)
      .toBe(false)
  })

  it('says how long a trip answer takes away from the desk, and when the chapter is due', () => {
    useStore.setState({ game: withEvent('convention', { fans: 10_000 }) })
    const { unmount } = render(<EventCard />)
    expect(screen.getByRole('button', { name: 'Book a table: -¥500, fans +550' })).toBeTruthy()
    expect(screen.getByText('2 days away from the desk.')).toBeTruthy()
    unmount()
    // a Kids Comic Go! chapter accepted on day 0 is due on day 21: on day 12 that is 9 days away
    const serial = { ...acceptOffer({ ...createGame('Rin', 1), pendingOffer: KIDS_OFFER }), day: 12 }
    useStore.setState({ game: withEvent('workshop', { level: 3 }, 7, serial) })
    render(<EventCard />)
    expect(screen.getByRole('button', { name: 'Attend: -¥400, pacing +3 (your lowest stat)' })).toBeTruthy()
    expect(screen.getByText('3 days away from the desk; chapter due in 9 days.')).toBeTruthy()
  })

  it('sits in the desk tray', () => {
    useStore.setState({ game: withEvent('cold') })
    render(<DeskTray />)
    expect(screen.getByRole('region', { name: 'You caught a cold' })).toBeTruthy()
  })
})

describe('event-only trips', () => {
  it('are never listed in the Trips panel', () => {
    render(<TripsModal />)
    expect(screen.getByText('City Library')).toBeTruthy()
    expect(screen.getByText('Hot Spring')).toBeTruthy()
    expect(screen.queryByText('Comic Convention')).toBeNull()
    expect(screen.queryByText('Manga Masterclass')).toBeNull()
  })
})
