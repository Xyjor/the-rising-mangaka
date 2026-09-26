import { describe, expect, it } from 'vitest'
import { CUES, midiToHz } from '../cues'
import type { CueId } from '../types'

const entries = Object.entries(CUES) as [CueId, (typeof CUES)[CueId]][]
const end = (id: CueId) => Math.max(...CUES[id].voices.map((v) => v.at + v.dur))

describe('midiToHz', () => {
  it('tunes A4 to 440 Hz in equal temperament', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(81)).toBe(880)
    expect(midiToHz(60)).toBeCloseTo(261.626, 3)
  })
})

describe('cue recipes', () => {
  it('defines all thirty-five cues', () => {
    expect(entries).toHaveLength(35)
    for (const id of ['knock', 'pop', 'tab', 'open', 'close'] as const) expect(CUES[id], id).toBeDefined()
  })

  it('spaces the scene and panel cues 800/80/60/150/150 ms', () => {
    expect([CUES.knock.gapMs, CUES.pop.gapMs, CUES.tab.gapMs, CUES.open.gapMs, CUES.close.gapMs])
      .toEqual([800, 80, 60, 150, 150])
  })

  it('pops one 880 Hz sine blip of 0.04 s, varied by 0, 4 and 7 semitones', () => {
    expect(CUES.pop.vary).toEqual([0, 4, 7])
    expect(CUES.pop.voices).toHaveLength(1)
    const v = CUES.pop.voices[0]
    expect(v.wave).toBe('sine')
    expect(v.wave !== 'noise' && v.freq).toBe(880)
    expect(v.dur).toBe(0.04)
  })

  it('knocks twice: noise at 0 and 0.09 s, each with a sine falling 220 to 110 Hz', () => {
    const vs = CUES.knock.voices
    expect(vs).toHaveLength(4)
    expect(vs.filter((v) => v.wave === 'noise').map((v) => v.at)).toEqual([0, 0.09])
    const sines = vs.flatMap((v) => (v.wave === 'sine' ? [v] : []))
    expect(sines.map((v) => [v.at, v.freq, v.to])).toEqual([[0, 220, 110], [0.09, 220, 110]])
  })

  it('clicks a tab with one 0.02 s band-passed noise voice at 1200 Hz', () => {
    expect(CUES.tab.voices).toHaveLength(1)
    const v = CUES.tab.voices[0]
    expect(v.wave).toBe('noise')
    expect(v.dur).toBe(0.02)
    expect(v.filter).toMatchObject({ type: 'bandpass', freq: 1200 })
  })

  it('opens rising and closes falling', () => {
    const freqs = (id: CueId) => CUES[id].voices.map((v) => (v.wave === 'noise' ? 0 : v.freq))
    const [o1, o2] = freqs('open'), [c1, c2] = freqs('close')
    expect(o2).toBeGreaterThan(o1)
    expect(c2).toBeLessThan(c1)
  })

  it('keeps every voice audible and at most 0.3 gain', () => {
    for (const [id, cue] of entries) {
      expect(cue.voices.length, id).toBeGreaterThan(0)
      for (const v of cue.voices) {
        expect(v.gain, id).toBeGreaterThan(0)
        expect(v.gain, id).toBeLessThanOrEqual(0.3)
      }
    }
  })

  it('ends every cue by 1.0 s, and the drumroll by 2.4 s', () => {
    for (const [id] of entries) expect(end(id), id).toBeLessThanOrEqual(id === 'drumroll' ? 2.4 : 1.0)
  })

  it('keeps each attack inside its voice', () => {
    for (const [id, cue] of entries) {
      for (const v of cue.voices) {
        expect(v.dur, id).toBeGreaterThan(0)
        expect(v.attack ?? 0, id).toBeLessThan(v.dur)
      }
    }
  })

  it('pitches every tone above 100 Hz on the C major pentatonic scale', () => {
    const pentatonic = new Set([0, 2, 4, 7, 9])
    for (const [id, cue] of entries) {
      for (const v of cue.voices) {
        if (v.wave === 'noise') continue
        for (const hz of [v.freq, v.to ?? v.freq]) {
          if (hz < 100) continue
          const midi = 69 + 12 * Math.log2(hz / 440)
          expect(Math.abs(midi - Math.round(midi)), id).toBeLessThan(0.001)
          expect(pentatonic.has(Math.round(midi) % 12), `${id} ${hz} Hz`).toBe(true)
        }
      }
    }
  })

  it('makes page a short band-passed noise tick that varies a semitone either way', () => {
    const page = CUES.page
    expect(page.gapMs).toBe(600)
    expect(page.vary).toEqual([-1, 0, 1])
    expect(page.voices).toHaveLength(1)
    expect(page.voices[0].wave).toBe('noise')
    expect(page.voices[0].dur).toBe(0.045)
    expect(page.voices[0].filter?.type).toBe('bandpass')
  })

  it('spaces the gaps: warn 1.5 s, reveal cues none', () => {
    expect(CUES.warn.gapMs).toBe(1500)
    expect(CUES.cancel.gapMs).toBe(1500)
    expect(CUES.click.gapMs).toBe(120)
    expect(CUES.levelup.gapMs).toBe(800)
    expect(CUES.award.gapMs).toBe(1000)
    for (const id of ['drumroll', 'bar', 'stamp', 'fanfare', 'jingle-up', 'jingle-mid', 'jingle-down'] as const) {
      expect(CUES[id].gapMs, id).toBe(0)
    }
  })

  it('rolls the drum 30 times, 70 ms apart, louder each hit', () => {
    const hits = CUES.drumroll.voices
    expect(hits).toHaveLength(30)
    expect(hits.every((v) => v.wave === 'noise')).toBe(true)
    expect(hits[1].at).toBeCloseTo(0.07, 9)
    expect(hits[29].at).toBeCloseTo(2.03, 9)
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].at - hits[i - 1].at).toBeCloseTo(0.07, 9)
      expect(hits[i].gain).toBeGreaterThan(hits[i - 1].gain)
    }
  })

  it('makes bar a 70 ms triangle C5', () => {
    expect(CUES.bar.voices).toHaveLength(1)
    expect(CUES.bar.voices[0]).toMatchObject({ wave: 'triangle', freq: expect.closeTo(523.251, 3), dur: 0.07 })
  })

  it('makes stamp a low noise thud under a sine falling from 80 to 40 Hz', () => {
    const [noise, sine] = CUES.stamp.voices
    expect(noise.wave).toBe('noise')
    expect(noise.filter?.type).toBe('lowpass')
    expect(sine).toMatchObject({ wave: 'sine', freq: 80, to: 40 })
  })
})
