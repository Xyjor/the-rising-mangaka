// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, dismissResult } from '../../sim'
import { useStore } from '../../state/store'
import { withPendingResult } from '../../test/fixtures'
import { HistoryModal } from '../panels/HistoryModal'

describe('HistoryModal', () => {
  it('lists a published work with its cover spine and numbers', () => {
    useStore.setState({ game: dismissResult(withPendingResult()), modal: 'history', readOnly: false })
    const { container } = render(<HistoryModal />)
    const headers = [...container.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toEqual(['Cover', 'When', 'Title', 'Pairing', 'Magazine', 'Rank', 'Score', 'Paid'])
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.querySelector('.spine[data-tone="accent"]')).toBeTruthy()
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent)
    expect(cells[2]).toBe('Blade Club')
    expect(cells[5]).toBe('#12/13')
    expect(cells[6]).toBe('45')
    expect(cells[7]).toBe('¥866')
  })

  it('says what happens next when nothing is published', () => {
    useStore.setState({ game: createGame('Rin', 1), modal: 'history', readOnly: false })
    render(<HistoryModal />)
    expect(screen.getByText('Nothing published yet. Your first poll result will show up here.')).toBeTruthy()
  })
})
