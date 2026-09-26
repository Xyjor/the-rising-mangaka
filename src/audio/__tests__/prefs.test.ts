import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND, levelToGain, normalizeSound } from '../types'

describe('sound preferences', () => {
  it('defaults to unmuted, half volume, music on', () => {
    expect(DEFAULT_SOUND).toEqual({ muted: false, volume: 0.5, music: true })
  })

  it('squares the slider level into a gain, clamped to 0..1', () => {
    expect(levelToGain(0.5)).toBe(0.25)
    expect(levelToGain(2)).toBe(1)
    expect(levelToGain(-1)).toBe(0)
    expect(levelToGain(Number.NaN)).toBe(0)
  })

  it('clamps an out-of-range volume', () => {
    expect(normalizeSound({ volume: 7 })).toEqual({ muted: false, volume: 1, music: true })
    expect(normalizeSound({ muted: true, volume: -2, music: false })).toEqual({ muted: true, volume: 0, music: false })
  })

  it('keeps valid fields and replaces missing or mistyped ones with the defaults', () => {
    expect(normalizeSound({ volume: 0.3 })).toEqual({ muted: false, volume: 0.3, music: true })
    expect(normalizeSound({ muted: 'yes', volume: 'loud', music: 1 })).toEqual({ muted: false, volume: 0.5, music: true })
    expect(normalizeSound({ volume: Number.NaN })).toEqual({ muted: false, volume: 0.5, music: true })
    expect(normalizeSound(null)).toEqual({ muted: false, volume: 0.5, music: true })
    expect(normalizeSound(undefined)).toEqual({ muted: false, volume: 0.5, music: true })
  })
})
