// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame } from '../../sim'
import type { PollResult } from '../../sim'
import { withPendingResult } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { CareerModal } from '../panels/CareerModal'

describe('CareerModal rival section', () => {
  it('names the rival, their series and magazine, their usual scores and the head-to-head record', () => {
    // seed 1: Iori Hayama, craft 57, "Robo Pals Go!" in Kids Comic Go! (57 - 8 to 57 + 8)
    const base = withPendingResult().pendingResult!
    const met = (rank: number, rivalRank: number): PollResult =>
      ({ ...base, rank, rival: { name: 'Iori Hayama', score: 50, rank: rivalRank } })
    // two wins (2 < 6, 1 < 3), one loss (8 > 2), one poll without the rival
    const history = [met(2, 6), met(8, 2), met(1, 3), base]
    useStore.setState({ game: { ...createGame('Rin', 1), history }, readOnly: false })
    render(<CareerModal />)
    const section = screen.getByRole('region', { name: 'Rival' })
    expect(section.textContent).toContain(
      'Iori Hayama draws "Robo Pals Go!" for Kids Comic Go! Usually scores 49 to 65. Head to head: 2 wins, 1 loss.',
    )
  })

  it('starts a career at no wins and no losses', () => {
    useStore.setState({ game: createGame('Rin', 1), readOnly: false })
    render(<CareerModal />)
    expect(screen.getByRole('region', { name: 'Rival' }).textContent).toContain('Head to head: 0 wins, 0 losses.')
  })
})
