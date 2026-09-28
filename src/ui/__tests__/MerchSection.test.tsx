// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import { orderMerch } from '../../sim'
import { withMerchSerial } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { CareerModal } from '../panels/CareerModal'
import { SeriesModal } from '../panels/SeriesModal'

function row(item: string): HTMLElement {
  return document.querySelector(`.merch-row[data-item="${item}"]`) as HTMLElement
}

describe('Series panel goods', () => {
  it('names the licence rule before the licence', () => {
    useStore.setState({ game: withMerchSerial(80, false), readOnly: false })
    render(<SeriesModal />)
    expect(screen.getByText('A goods maker licenses series from year two, once a volume has shipped.')).toBeTruthy()
    expect(document.querySelector('.merch-row')).toBeNull()
  })

  it('shows each row with its forecast, and a loss in the negative colour', () => {
    useStore.setState({ game: withMerchSerial(80), readOnly: false })
    render(<SeriesModal />)
    const k = row('keychain')
    expect(k.textContent).toContain('About ¥8,560 back over 4 weeks if popularity holds (net +¥2,260).')
    expect(k.querySelector('.merch-net.neg')).toBeNull()
    expect(within(k).getByRole('button', { name: 'Order a run for ¥6,300' })).toHaveProperty('disabled', false)
  })

  it('marks a loss and disables a gated item with its reason', () => {
    useStore.setState({ game: withMerchSerial(50), readOnly: false })
    render(<SeriesModal />)
    expect(row('keychain').querySelector('.merch-net.neg')?.textContent).toBe('net -¥940')
    const fig = row('figure')
    expect(fig.textContent).toContain('Figures need a signed anime deal for this series.')
    expect(within(fig).getByRole('button', { name: 'Order a run for ¥64,000' })).toHaveProperty('disabled', true)
  })

  it('orders a run from the button and shows it with weeks left and the money so far', () => {
    useStore.setState({ game: withMerchSerial(80), readOnly: false })
    render(<SeriesModal />)
    fireEvent.click(within(row('keychain')).getByRole('button', { name: 'Order a run for ¥6,300' }))
    expect(useStore.getState().game!.merch.runs.length).toBe(1)
    const run = document.querySelector('.merch-run') as HTMLElement
    expect(run.textContent).toContain('Keychains: 4 weeks left')
    expect(run.textContent).toContain('¥0 so far')
    expect(row('keychain').textContent).toContain('Keychains are already selling for this series.')
  })
})

describe('Career goods line', () => {
  it('shows the goods total', () => {
    const g = orderMerch(withMerchSerial(80), 'keychain', 1)
    useStore.setState({ game: { ...g, merch: { ...g.merch, earned: 8560 } }, readOnly: false })
    render(<CareerModal />)
    expect(screen.getByText('¥8,560 from 1 run of goods.')).toBeTruthy()
  })
})
