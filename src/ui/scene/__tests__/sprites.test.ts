// The sprite maps obey the frame rules: every row the frame's width, every key in the palette, the last row painted and
// the outline closed on every row. Pure data, the default node environment.
import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_DOZE, ASSISTANT_PALS, CAT_GROOM, CAT_SIT, CAT_SLEEP, CAT_STRETCH, CAT_WALK, EDITOR_IDLE, EDITOR_WALK, HUMAN_FRAMES,
  MANGAKA_IDLE, MANGAKA_LIE, MANGAKA_PANIC, MANGAKA_SIP, MANGAKA_SIT, MANGAKA_STRETCH, MANGAKA_WALK, OUTFIT_PALS, PAL,
  PROP_CONTRACT, PROP_ENVELOPE, PROP_LETTER, PROP_PAL, PROP_TROPHY, frameRules, outfitOf,
} from '../sprites'
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../../looks'

describe('the sprites', () => {
  it('passes the frame rules for every 24x32 frame, the 30x14 bed pose and the 12x8 cat', () => {
    expect(HUMAN_FRAMES).toHaveLength(
      MANGAKA_IDLE.length + MANGAKA_WALK.length + MANGAKA_SIT.length + MANGAKA_PANIC.length + MANGAKA_STRETCH.length
      + MANGAKA_SIP.length + 1 + EDITOR_IDLE.length + EDITOR_WALK.length,
    )
    expect(HUMAN_FRAMES).toHaveLength(21)
    expect(HUMAN_FRAMES).toContain(ASSISTANT_DOZE)
    HUMAN_FRAMES.forEach((f, i) => {
      expect(f.every((row) => row.length === 24), `frame ${i}`).toBe(true)
      expect(frameRules(f), `frame ${i}`).toEqual([])
    })
    expect(frameRules(MANGAKA_LIE, 30, 14)).toEqual([])
    for (const cat of [CAT_SLEEP, CAT_SIT, ...CAT_WALK, ...CAT_GROOM, CAT_STRETCH]) expect(frameRules(cat, 12, 8)).toEqual([])
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
    broken[9] = broken[9].replace('E', '#')
    broken[31] = '.'.repeat(24)
    expect(frameRules(broken)).toHaveLength(3)
    // and an open outline
    const open = MANGAKA_IDLE[0].slice()
    open[7] = '..SHSSSSSSSSSSSSSShL....'
    expect(frameRules(open)).toEqual(['row 7 is open'])
  })

  it('keeps the anchor\'s hair, face and shoes where the scene tests read them', () => {
    const a = MANGAKA_IDLE[0]
    expect([a[2][8], a[9][6], a[10][7], a[12][10], a[31][6], a[30][7]]).toEqual(['H', 'E', 'W', 'M', 'L', 'O'])
    // the breath: rows 0-23 a row lower, so the eye on row 10
    expect(MANGAKA_IDLE[1][0]).toBe('.'.repeat(24))
    expect(MANGAKA_IDLE[1][10][6]).toBe('E')
    // the pen hand (row 22 col 0 is the pen's L, so the hand starts at col 1: see the task 1 report)
    expect(MANGAKA_SIT[0][22][1]).toBe('S')
    // panic: both hands on top of the head, meeting the hair at rows 1-3, the raised arms' elbows out at cols 0 and 23
    expect([MANGAKA_PANIC[0][1][3], MANGAKA_PANIC[0][1][17], MANGAKA_PANIC[0][1][6]]).toEqual(['S', 'S', 'H'])
    expect([MANGAKA_PANIC[1][2][3], MANGAKA_PANIC[1][3][19], MANGAKA_PANIC[1][1][3]]).toEqual(['S', 'S', 'L'])
    expect([MANGAKA_PANIC[0][6][1], MANGAKA_PANIC[0][6][22], MANGAKA_PANIC[0][6][0]]).toEqual(['J', 'j', 'L'])
    for (const f of MANGAKA_PANIC) for (let r = 4; r <= 15; r++) expect(f[r].slice(0, 3), `row ${r}`).not.toContain('S')
    // the bed pose: 30x14, the first hair cell row 2 col 16
    expect(MANGAKA_LIE).toHaveLength(14)
    expect(MANGAKA_LIE.every((row) => row.length === 30)).toBe(true)
    expect(MANGAKA_LIE[2].indexOf('H')).toBe(16)
    // the editor: hair row 2 col 8, glasses row 10 col 5, tie row 17 col 11, suit row 18 col 5, briefcase row 24 col 20
    const e = EDITOR_IDLE[0]
    expect([e[2][8], e[10][5], e[17][11], e[18][5], e[24][20]]).toEqual(['H', 'P', 'N', 'G', 'F'])
    // the doze: the head down 6 and right 2, so row 8 col 10 is hair and row 2 is clear
    expect(ASSISTANT_DOZE[8][10]).toBe('H')
    expect(ASSISTANT_DOZE[2].slice(0, 10)).toBe('..........')
    expect([CAT_SIT[3][3], CAT_WALK[1][6][1], CAT_WALK[0][6][1]]).toEqual(['E', 'C', 'L'])
    expect([PROP_ENVELOPE[1][2], PROP_TROPHY[1][2]]).toEqual(['W', 'Y'])
  })

  it('gives the cat a cream chest patch wherever its chest shows (not curled asleep)', () => {
    for (const cat of [CAT_SIT, ...CAT_WALK, ...CAT_GROOM, CAT_STRETCH]) expect(cat.join('')).toContain('Q')
    expect(CAT_SLEEP.join('')).not.toContain('Q')
    expect([CAT_SIT[4][2], CAT_SIT[5][2], CAT_SIT[5][3]]).toEqual(['Q', 'Q', 'Q'])
  })

  it('draws the groom paw so it reads as distinct from the plain sit (fix round 1)', () => {
    // frame 0: the paw fills the ear gap at row 1, cols 2-3 (CAT_SIT has L there, the ridge between the ears)
    expect(CAT_SIT[1][2]).toBe('L')
    expect(CAT_GROOM[0][1][2]).toBe('C')
    expect(CAT_GROOM[0][1][2]).not.toBe(CAT_SIT[1][2])
    // frame 1: the paw one row up, at row 0, cols 2-3 (CAT_SIT has . there, the gap between the ears)
    expect(CAT_SIT[0][2]).toBe('.')
    expect(CAT_GROOM[1][0][2]).toBe('C')
    expect(CAT_GROOM[1][0][2]).not.toBe(CAT_SIT[0][2])
    // the eye closes to a shade line in both frames, not hidden: CAT_SIT's E at row 3 col 3 becomes c
    expect(CAT_SIT[3][3]).toBe('E')
    expect(CAT_GROOM[0][3][3]).toBe('c')
    expect(CAT_GROOM[1][3][3]).toBe('c')
  })

  it('dresses each assistant in their look, with its shade', () => {
    expect(ASSISTANT_PALS).toHaveLength(LOOK_SHIRTS.length)
    ASSISTANT_PALS.forEach((p, i) => {
      expect([p.H, p.h, p.R, p.r]).toEqual([LOOK_HAIRS[i], LOOK_HAIRS_SHADE[i], LOOK_SHIRTS[i], LOOK_SHIRTS_SHADE[i]])
    })
    expect(ASSISTANT_PALS[0]).toEqual(PAL)
  })

  it('picks the outfit by level (Decision 7)', () => {
    expect(outfitOf(1)).toBe('hoodie')
    expect(outfitOf(4)).toBe('hoodie')
    expect(outfitOf(5)).toBe('cardigan')
    expect(outfitOf(9)).toBe('cardigan')
    expect(outfitOf(10)).toBe('blazer')
    expect(outfitOf(30)).toBe('blazer')
  })

  it('builds the outfit palettes once, swapping only J/j', () => {
    expect(OUTFIT_PALS.hoodie).toEqual(PAL)
    expect(OUTFIT_PALS.cardigan.J).toBe('#c9a24a')
    expect(OUTFIT_PALS.cardigan.j).toBe('#a8832f')
    expect(OUTFIT_PALS.blazer.J).toBe('#2e3a78')
    expect(OUTFIT_PALS.blazer.j).toBe('#222b5c')
  })
})
