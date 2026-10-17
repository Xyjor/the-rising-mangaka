import { describe, expect, it } from 'vitest'
import { loudness } from '../music/measure'

function sine(n: number, amp = 1): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * 440 * i) / 44100)
  return out
}

describe('loudness', () => {
  it('reads silence as minus infinity', () => {
    const l = loudness([new Float32Array(1000)])
    expect(l.rmsDb).toBe(-Infinity)
    expect(l.peakDb).toBe(-Infinity)
  })

  it('reads a full-scale sine as -3.01 dB RMS and 0 dB peak', () => {
    const l = loudness([sine(44100)])
    expect(l.rmsDb).toBeCloseTo(-3.01, 1)
    expect(l.peakDb).toBeCloseTo(0, 2)
  })

  it('averages stereo channels by power', () => {
    // A full-scale sine on the left and silence on the right: half the power, 3.01 dB lower.
    const l = loudness([sine(44100), new Float32Array(44100)])
    expect(l.rmsDb).toBeCloseTo(-6.02, 1)
    expect(l.peakDb).toBeCloseTo(0, 2)
  })
})
