import { describe, expect, it } from 'vitest'
import { shortDate } from '../index'

describe('shortDate', () => {
  it('prints the month alone by default', () => {
    expect(shortDate(0)).toBe('Month 1')
  })
  it('adds week and day on request', () => {
    expect(shortDate(0, { week: true })).toBe('Month 1, week 1, day 1')
    expect(shortDate(3, { week: true })).toBe('Month 1, week 1, day 4')
  })
  it('prefixes the year only after the first one', () => {
    expect(shortDate(336)).toBe('Year 2, month 1')
    expect(shortDate(345, { week: true })).toBe('Year 2, month 1, week 2, day 3')
  })
})
