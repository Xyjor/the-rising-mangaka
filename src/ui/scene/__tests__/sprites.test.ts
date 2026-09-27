// The sprite maps obey the frame rules: every row the frame's width, every key in the palette, the last row painted and
// the outline closed on every row. Pure data, the default node environment.
import { describe, expect, it } from 'vitest'
import { ASSISTANT_PALS, CAT_SLEEP, HUMAN_FRAMES, MANGAKA_IDLE, MANGAKA_LIE, MANGAKA_PANIC, MANGAKA_SIT, MANGAKA_WALK, PAL, frameRules } from '../sprites'
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../../looks'

describe('the sprites', () => {
  it('passes the frame rules for every 24x32 frame, the 30x14 bed pose and the 12x8 cat', () => {
    expect(HUMAN_FRAMES).toHaveLength(MANGAKA_IDLE.length + MANGAKA_WALK.length + MANGAKA_SIT.length + MANGAKA_PANIC.length)
    expect(HUMAN_FRAMES).toHaveLength(10)
    HUMAN_FRAMES.forEach((f, i) => {
      expect(f.every((row) => row.length === 24), `frame ${i}`).toBe(true)
      expect(frameRules(f), `frame ${i}`).toEqual([])
    })
    expect(frameRules(MANGAKA_LIE, 30, 14)).toEqual([])
    expect(frameRules(CAT_SLEEP, 12, 8)).toEqual([])
  })

  it('reports a short row, an unknown key and an empty last row', () => {
    const broken = MANGAKA_IDLE[0].slice()
    broken[5] = broken[5].slice(0, 23)
    broken[8] = broken[8].replace('E', '#')
    broken[31] = '.'.repeat(24)
    expect(frameRules(broken)).toHaveLength(3)
    // and an open outline
    const open = MANGAKA_IDLE[0].slice()
    open[7] = '....SSSSSSSSSSSSSsL.....'
    expect(frameRules(open)).toEqual(['row 7 is open'])
  })

  it('keeps the anchor\'s hair, face and shoes where the scene tests read them', () => {
    const a = MANGAKA_IDLE[0]
    expect([a[2][8], a[7][8], a[30][6]]).toEqual(['H', 'S', 'O'])
    expect(MANGAKA_LIE[2][20]).toBe('H')
    expect(MANGAKA_PANIC[0][4][3]).toBe('S')
    expect(MANGAKA_SIT[0][4][3]).toBe('.')
  })

  it('dresses each assistant in their look, with its shade', () => {
    expect(ASSISTANT_PALS).toHaveLength(LOOK_SHIRTS.length)
    ASSISTANT_PALS.forEach((p, i) => {
      expect([p.H, p.h, p.R, p.r]).toEqual([LOOK_HAIRS[i], LOOK_HAIRS_SHADE[i], LOOK_SHIRTS[i], LOOK_SHIRTS_SHADE[i]])
    })
    expect(ASSISTANT_PALS[0]).toEqual(PAL)
  })
})
