// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, startProject, submitProject, tickMany } from '../../sim'
import type { GameState, RivalPlacing } from '../../sim'
import { DRAFT, drawUntilReady, withPendingResult } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { ResultsModal } from '../panels/ResultsModal'

beforeEach(() => {
  useStore.setState({ game: withPendingResult(), tutorialStep: 0, readOnly: false })
})

/**
 * ResultsModal assumes it is only ever mounted while `pendingResult` is set (App.tsx renders it as
 * `{hasResult && <ResultsModal />}` and unmounts it the instant dismissal clears the result). Mirror
 * that guard here so the component is not asked to render itself against a null result.
 */
function Harness() {
  const hasResult = useStore((s) => !!s.game?.pendingResult)
  return hasResult ? <ResultsModal /> : null
}

describe('ResultsModal', () => {
  it('clears the pending result and the tutorial hint when closed', () => {
    render(<Harness />)
    const closeButton = screen.getByRole('button', { name: /Back to the studio/i })

    fireEvent.click(closeButton)

    expect(useStore.getState().game!.pendingResult).toBeNull()
    expect(useStore.getState().tutorialStep).toBe(-1)
  })
})

describe('ResultsModal rival line', () => {
  /** The seed-42 Weekly Bolt result, recast with the player at `rank` and the rival placing `rival`. */
  function withRival(rank: number, rival?: RivalPlacing): GameState {
    const g = withPendingResult()
    return { ...g, pendingResult: { ...g.pendingResult!, rank, rival } }
  }

  it('says where the rival placed and that the player finished ahead', () => {
    useStore.setState({ game: withRival(2, { name: 'Natsume Kujo', score: 51, rank: 4 }) })
    render(<Harness />)
    expect(screen.getByText('Natsume Kujo placed #4 with 51. You finished ahead.')).toBeTruthy()
  })

  it('or behind', () => {
    useStore.setState({ game: withRival(9, { name: 'Natsume Kujo', score: 51, rank: 4 }) })
    render(<Harness />)
    expect(screen.getByText('Natsume Kujo placed #4 with 51. You finished behind.')).toBeTruthy()
  })

  it('says nothing about a rival who was not in the poll', () => {
    // the seed-42 poll is at Weekly Bolt; the year-one rival runs in Kids Comic Go!
    expect(useStore.getState().game!.pendingResult!.rival).toBeUndefined()
    render(<Harness />)
    expect(screen.queryByText(/ placed #/)).toBeNull()
  })

  it('shows the line for a real Kids Comic Go! poll, where the year-one rival runs', () => {
    let s = drawUntilReady(startProject(createGame('Rin', 42), { ...DRAFT, audience: 'kids' }))
    s = tickMany(submitProject(s, 'kids-comic'), 7)
    const r = s.pendingResult!
    expect(r.rival).toBeDefined()
    useStore.setState({ game: s })
    render(<Harness />)
    // seed 42's rival is Natsume Kujo; the line names the rival's own rank and score from the result
    const line = screen.getByText((text) => text.startsWith('Natsume Kujo placed #'))
    expect(line.textContent).toContain(`placed #${r.rival!.rank} with ${r.rival!.score}`)
    expect(line.textContent).toMatch(r.rank < r.rival!.rank ? /You finished (just )?ahead\.$/ : /You finished (just )?behind\.$/)
  })
})
