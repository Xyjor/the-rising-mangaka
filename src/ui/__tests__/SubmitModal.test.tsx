// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { acceptOffer, createGame } from '../../sim'
import type { GameState, ProjectDraft } from '../../sim'
import { withReadyOneShot } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { SubmitModal } from '../panels/SubmitModal'

const KIDS_DRAFT: ProjectDraft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'kids' }
const FOOTNOTE =
  'Untested pairings could rate anywhere from Bad to Perfect, so the range is wide until your Notebook knows them.'

/** Seed 1 (pacing 30), the kids manuscript at quality 50/50, both pairings known Good unless `known` is false. */
function readyGame(known = true): GameState {
  const g = createGame('Rin', 1)
  const notebook = known
    ? { genreTheme: { 'action|samurai': 2 as const }, themeAudience: { 'samurai|kids': 2 as const } }
    : g.notebook
  return withReadyOneShot({ ...g, notebook }, KIDS_DRAFT, 50, 50)
}

function card(name: RegExp) {
  return within(screen.getByRole('button', { name }))
}

beforeEach(() => {
  useStore.setState({ game: readyGame(), tutorialStep: -1, readOnly: false })
})

describe('SubmitModal forecast lines', () => {
  it('shows the likely score, rank, offer odds, pay and rival spread for each magazine', () => {
    render(<SubmitModal />)
    // the forecast test's worked example: Kids Comic Go!, 10 rivals at 47
    const kids = card(/Kids Comic Go!/)
    expect(kids.getByText('Likely score 52 to 53. Likely rank #2 to #5 of 11.')).toBeTruthy()
    expect(kids.getByText('Serial offer: likely, 48%.')).toBeTruthy()
    // expected pay 1,422.0, range 803 (51, last) to 2,385 (53, first)
    expect(kids.getByText('Pays about ¥1,422 (¥803 to ¥2,385).')).toBeTruthy()
    // 47 - 8 to 47 + 8
    expect(kids.getByText('Rivals usually score 39 to 55.')).toBeTruthy()
    // Weekly Bolt: a kids manga for teen readers scores about 47 against 12 rivals at 58
    const bolt = card(/Weekly Bolt/)
    expect(bolt.getByText('Serial offer: under 1%.')).toBeTruthy()
    expect(bolt.getByText('Rivals usually score 50 to 66.')).toBeTruthy()
  })

  it('explains the wide range only while a pairing is untested', () => {
    const { unmount } = render(<SubmitModal />)
    expect(screen.queryByText(FOOTNOTE)).toBeNull()
    expect(screen.queryByText(/Estimates assume untested pairings rate Good/)).toBeNull()
    unmount()

    useStore.setState({ game: readyGame(false) })
    render(<SubmitModal />)
    expect(screen.getByText(FOOTNOTE)).toBeTruthy()
  })

  it('names the running serial when no offer can come', () => {
    const offer = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
    const running = acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer })
    useStore.setState({ game: withReadyOneShot(running, KIDS_DRAFT, 50, 50) })
    render(<SubmitModal />)
    expect(card(/Kids Comic Go!/).getByText('Serial offer: none while "Magic Club" runs.')).toBeTruthy()
  })
})
