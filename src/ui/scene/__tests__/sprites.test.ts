// The sprite maps obey the frame rules: every row the frame's width, every key in the palette, the last row painted and
// the outline closed on every row. Pure data, the default node environment.
import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_DOZE, ASSISTANT_PALS, CAT_SIT, CAT_SLEEP, CAT_WALK, EDITOR_IDLE, EDITOR_WALK, HUMAN_FRAMES, MANGAKA_IDLE, MANGAKA_LIE,
  MANGAKA_PANIC, MANGAKA_SIT, MANGAKA_WALK, PAL, PROP_CONTRACT, PROP_ENVELOPE, PROP_LETTER, PROP_PAL, PROP_TROPHY, frameRules,
} from '../sprites'
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../../looks'

describe('the sprites', () => {
  it('passes the frame rules for every 24x32 frame, the 30x14 bed pose and the 12x8 cat', () => {
    expect(HUMAN_FRAMES).toHaveLength(MANGAKA_IDLE.length + MANGAKA_WALK.length + MANGAKA_SIT.length + MANGAKA_PANIC.length + 1 + EDITOR_IDLE.length + EDITOR_WALK.length)
    expect(HUMAN_FRAMES).toHaveLength(17)
    expect(HUMAN_FRAMES).toContain(ASSISTANT_DOZE)
    HUMAN_FRAMES.forEach((f, i) => {
      expect(f.every((row) => row.length === 24), `frame ${i}`).toBe(true)
      expect(frameRules(f), `frame ${i}`).toEqual([])
    })
    expect(frameRules(MANGAKA_LIE, 30, 14)).toEqual([])
    for (const cat of [CAT_SLEEP, CAT_SIT, ...CAT_WALK]) expect(frameRules(cat, 12, 8)).toEqual([])
    expect(frameRules(PROP_ENVELOPE, 6, 4, PROP_PAL)).toEqual([])
    expect(frameRules(PROP_LETTER, 5, 6, PROP_PAL)).toEqual([])
    expect(frameRules(PROP_CONTRACT, 5, 7, PROP_PAL)).toEqual([])
    expect(frameRules(PROP_TROPHY, 5, 6, PROP_PAL)).toEqual([])
    // a prop key is not a person's
    expect(frameRules(PROP_TROPHY, 5, 6)).not.toEqual([])
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
    // the editor: hair row 2 col 8, suit row 20 col 4, glasses row 8 col 6, briefcase row 24 col 20
    const e = EDITOR_IDLE[0]
    expect([e[2][8], e[20][4], e[8][6], e[24][20]]).toEqual(['H', 'G', 'P', 'F'])
    expect(ASSISTANT_DOZE[8][10]).toBe('H')
    expect(ASSISTANT_DOZE[2][8]).toBe('.')
    expect([CAT_SIT[3][3], CAT_WALK[1][6][1], CAT_WALK[0][6][1]]).toEqual(['E', 'C', 'L'])
    expect([PROP_ENVELOPE[1][2], PROP_TROPHY[1][2]]).toEqual(['W', 'Y'])
  })

  it('dresses each assistant in their look, with its shade', () => {
    expect(ASSISTANT_PALS).toHaveLength(LOOK_SHIRTS.length)
    ASSISTANT_PALS.forEach((p, i) => {
      expect([p.H, p.h, p.R, p.r]).toEqual([LOOK_HAIRS[i], LOOK_HAIRS_SHADE[i], LOOK_SHIRTS[i], LOOK_SHIRTS_SHADE[i]])
    })
    expect(ASSISTANT_PALS[0]).toEqual(PAL)
  })
})
