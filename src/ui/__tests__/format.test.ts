import { describe, expect, it } from 'vitest'
import { bestRank, compact, money, plural } from '../format'

describe('money', () => {
  it('rounds and formats with the yen sign', () => {
    expect(money(1234.4)).toBe('¥1,234')
  })

  it('puts the minus sign before the yen sign', () => {
    expect(money(-50)).toBe('-¥50')
  })

  it('formats zero plainly', () => {
    expect(money(0)).toBe('¥0')
  })
})

describe('compact', () => {
  it('leaves numbers under 10,000 grouped in full', () => {
    expect(compact(9999)).toBe('9,999')
  })

  it('abbreviates thousands with one decimal and a k suffix', () => {
    expect(compact(12_345)).toBe('12.3k')
  })

  it('abbreviates millions with one decimal and an M suffix', () => {
    expect(compact(1_500_000)).toBe('1.5M')
  })
})

describe('plural', () => {
  it('keeps the word singular for a count of 1', () => {
    expect(plural(1, 'day')).toBe('1 day')
  })

  it('adds an s for counts above 1', () => {
    expect(plural(3, 'day')).toBe('3 days')
  })

  it('adds an s for a count of 0', () => {
    expect(plural(0, 'chapter')).toBe('0 chapters')
  })
})

describe('bestRank', () => {
  it('picks the lowest (best) rank across results', () => {
    expect(bestRank([{ rank: 4 }, { rank: 2 }])).toBe('#2')
  })

  it('renders an em dash for an empty result list', () => {
    expect(bestRank([])).toBe('—')
  })
})
