// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { acceptOffer, createGame } from '../../sim'
import type { GameState } from '../../sim'
import { useStore } from '../../state/store'
import { KIDS_OFFER } from '../../test/fixtures'
import { AnimeOfferCard } from '../AnimeOfferCard'
import { ANIME_ART } from '../art/registry'
import { DeskTray } from '../hud/DeskTray'

const TITLE = 'Two studios want to animate "Magic Club"'

/** Seed 1 on day 100 with its Kids Comic Go! serial (id 1) offered an adaptation `daysLeft` days before it lapses. */
function offered(daysLeft = 14): GameState {
  const s = acceptOffer({ ...createGame('Rin', 1), day: 100, pendingOffer: KIDS_OFFER })
  return { ...s, animeOffer: { serialId: 1, expiresDay: 100 + daysLeft }, animeOfferedFor: [1] }
}

/** The store's own actions, put back before each test because some tests swap in spies. */
const { signAnime: realSign, declineAnime: realDecline } = useStore.getState()

beforeEach(() => {
  useStore.setState({
    game: createGame('Rin', 1), tutorialStep: -1, readOnly: false, speed: 0, toasts: [],
    signAnime: realSign, declineAnime: realDecline,
  })
})

describe('AnimeOfferCard', () => {
  it('renders nothing when no offer is waiting', () => {
    const { container } = render(<AnimeOfferCard />)
    expect(container.firstChild).toBeNull()
  })

  it('states both studios\' exact terms', () => {
    useStore.setState({ game: offered() })
    render(<AnimeOfferCard />)
    const card = screen.getByRole('region', { name: TITLE })
    expect(card.textContent).toContain('"Magic Club" is a hit: popularity 70 or more and 37,000 or more copies sold.')
    expect(screen.getByRole('group', { name: 'Studio Kumo' }).querySelector(`img[src="${ANIME_ART.kumo.src}"]`)).not.toBeNull()
    const kumo = within(screen.getByRole('group', { name: 'Studio Kumo' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(kumo).toEqual([
      'Pays you ¥2,000 when you sign.',
      'Airs in 6 weeks and runs 12 weeks: +400 fans and ¥500 a week.',
      'Volumes sell 1.3x from the premiere until 12 weeks after the finale.',
      'Popularity +5 at the premiere, if the series is still running.',
    ])
    const hoshi = within(screen.getByRole('group', { name: 'Hoshi Animation' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(hoshi).toEqual([
      'No signing fee.',
      'Airs in 16 weeks and runs 24 weeks: +900 fans and ¥1,000 a week.',
      'Volumes sell 1.6x from the premiere until 24 weeks after the finale.',
      'Popularity +12 at the premiere, if the series is still running.',
    ])
    expect(screen.getByText('Answer within 14 days. Studios ask once per series.')).toBeTruthy()
  })

  it('sends each button to its action', () => {
    const signAnime = vi.fn()
    const declineAnime = vi.fn()
    useStore.setState({ game: offered(), signAnime, declineAnime })
    render(<AnimeOfferCard />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign with Studio Kumo' }))
    expect(signAnime).toHaveBeenLastCalledWith('kumo')
    fireEvent.click(screen.getByRole('button', { name: 'Sign with Hoshi Animation' }))
    expect(signAnime).toHaveBeenLastCalledWith('hoshi')
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(declineAnime).toHaveBeenCalledTimes(1)
  })

  it('signs the deal and leaves the desk', () => {
    useStore.setState({ game: offered() })
    render(<AnimeOfferCard />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign with Hoshi Animation' }))
    const g = useStore.getState().game!
    expect(g.animeOffer).toBeNull()
    expect(g.anime).toEqual([{ studio: 'hoshi', serialId: 1, signedDay: 100, airsDay: 212, endsDay: 380, tailEndsDay: 548 }])
    expect(screen.queryByRole('region', { name: TITLE })).toBeNull()
  })

  it('counts the days left down to the last one', () => {
    useStore.setState({ game: offered(1) })
    const { unmount } = render(<AnimeOfferCard />)
    expect(screen.getByText('Answer within 1 day. Studios ask once per series.')).toBeTruthy()
    unmount()
    useStore.setState({ game: offered(0) })
    render(<AnimeOfferCard />)
    expect(screen.getByText('Answer today. Studios ask once per series.')).toBeTruthy()
  })

  it('sits in the desk tray', () => {
    useStore.setState({ game: offered() })
    render(<DeskTray />)
    expect(screen.getByRole('region', { name: TITLE })).toBeTruthy()
  })
})
