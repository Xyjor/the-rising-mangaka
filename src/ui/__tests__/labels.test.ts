import { describe, expect, it } from 'vitest'
import { warningText } from '../labels'

describe('warningText', () => {
  it('reads Safe with no warnings', () => {
    expect(warningText(0)).toBe('Safe')
  })

  it('counts the warning and the chapters left at 1 of 3', () => {
    expect(warningText(1)).toBe('1 warning. 2 more weak chapters in a row cancel it')
  })

  it('gives the last-chance message one warning before cancellation', () => {
    expect(warningText(2)).toBe('One more weak chapter cancels it')
  })
})
