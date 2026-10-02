// The sprite maps obey the frame rules: every row the frame's width, every key in the palette, the last row painted and
// the outline closed on every row. Pure data, the default node environment.
import { describe, expect, it } from 'vitest'
import {
  ANCHOR_HEAD, breathOf,
  ASSISTANT_DOZE, ASSISTANT_PALS, CAT_GROOM, CAT_SIT, CAT_SLEEP, CAT_STRETCH, CAT_WALK, EDITOR_IDLE, EDITOR_WALK, HUMAN_FRAMES,
  MANGAKA_IDLE, MANGAKA_LIE, MANGAKA_PANIC, MANGAKA_SIP, MANGAKA_SIT, MANGAKA_STRETCH, MANGAKA_WALK, OUTFIT_PALS, PAL,
  PROP_CONTRACT, PROP_ENVELOPE, PROP_LETTER, PROP_PAL, PROP_TROPHY, faceRules, frameRules, outfitOf, type SpriteMap,
} from '../sprites'
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../../looks'
import { runCount } from '../../art/pixelOps'
import { ASSISTANT_DOZE_C2 } from '../generated/assistant-doze'

/**
 * The run-count caps: 1.3x each frame's `runCount` before Release B's redraw, floored. A redraw may add detail up to the
 * cap and never past it, so every scene fill baseline stays inside its 1.5x budget by construction (render.test.ts 673
 * to at most 792, studioArt.test.ts 1079 to 1309, the rest scene 509 to 570). Never raise a cap.
 */
const RUN_CAPS: readonly [string, readonly SpriteMap[], readonly number[]][] = [
  ['MANGAKA_IDLE', MANGAKA_IDLE, [253, 249]],
  ['MANGAKA_STRETCH', MANGAKA_STRETCH, [254, 250]],
  ['MANGAKA_SIP', MANGAKA_SIP, [262, 249]],
  ['MANGAKA_WALK', MANGAKA_WALK, [257, 231, 257, 231]],
  ['MANGAKA_SIT', MANGAKA_SIT, [239, 243]],
  ['MANGAKA_PANIC', MANGAKA_PANIC, [330, 325]],
  ['MANGAKA_LIE', [MANGAKA_LIE], [93]],
  ['ASSISTANT_DOZE', [ASSISTANT_DOZE], [130]],
  ['EDITOR_IDLE', EDITOR_IDLE, [263, 254]],
  ['EDITOR_WALK', EDITOR_WALK, [265, 245, 266, 245]],
  ['CAT_SLEEP', [CAT_SLEEP], [40]],
  ['CAT_SIT', [CAT_SIT], [44]],
  ['CAT_WALK', CAT_WALK, [48, 45]],
  ['CAT_GROOM', CAT_GROOM, [42, 45]],
  ['CAT_STRETCH', [CAT_STRETCH], [32]],
]

/** The row of the first `S` (a hand) in cols `from`-`to`, searched from row 16 down (below the head's own skin). */
function handRow(f: SpriteMap, from: number, to: number): number {
  for (let r = 16; r < f.length; r++) if (f[r].slice(from, to + 1).includes('S')) return r
  return -1
}

/** Whether a row's painted cells form one span (no '.' between its first and last painted cell). */
function oneSpan(row: string): boolean {
  return !/[^.]\.+[^.]/.test(row)
}

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
    expect(frameRules(PROP_ENVELOPE, 6, 4)).not.toEqual([]) // its paper-line l
  })

  it('faceRules: the FACES window holds only face keys, the mark slot is clear, the head stays in the avatar crop', () => {
    // every hand-drawn frame that takes the overlay (render.ts: the breathing idle, the seated frames) passes, and the
    // sip too; the stretch does not (its arms leave the avatar crop), and render never draws a face on it (faceSteady)
    for (const f of [...MANGAKA_IDLE, ...MANGAKA_SIT, ...MANGAKA_SIP]) expect(faceRules(f)).toEqual([])
    for (const f of MANGAKA_STRETCH) expect(faceRules(f)).not.toEqual([])
    // hair inside the FACES window (rows 9-12, cols 4-17)
    const hair = MANGAKA_IDLE[0].slice()
    hair[10] = hair[10].slice(0, 5) + 'H' + hair[10].slice(6)
    expect(faceRules(hair)).toEqual(['row 10 col 5 is H, not a face key'])
    // something in the mark slot (rows 0-2, cols 20-22)
    const mark = MANGAKA_IDLE[0].slice()
    mark[1] = mark[1].slice(0, 21) + 'L' + mark[1].slice(22)
    expect(faceRules(mark)).toContain('row 1 col 21 is in the mark slot')
    // the head spilling out of the avatar crop (rows 0-15, cols 2-19)
    const wide = MANGAKA_IDLE[0].slice()
    wide[4] = 'L' + wide[4].slice(1)
    expect(faceRules(wide)).toEqual(['row 4 col 0 is outside the avatar crop'])
  })

  it('keeps every frame under its run-count cap (RUN_CAPS)', () => {
    for (const [name, frames, caps] of RUN_CAPS) {
      expect(frames.length, name).toBe(caps.length)
      frames.forEach((f, i) => expect(runCount(f), `${name}[${i}]`).toBeLessThanOrEqual(caps[i]))
    }
  })

  // The contract tests below pass before Release B's redraw (no RED is possible for them): they are the shape every
  // redraw keeps, written from the rule rather than from cell literals, so a new drawing that keeps the rule passes.
  it('walks with the legs and arms swapping between the contact frames and the legs together on the pass frames', () => {
    // the mangaka's legs span the frame; the editor's are read left of the briefcase (cols 18-23, task B4), which
    // hangs beside them on every frame
    for (const [name, frames, legs] of [['MANGAKA_WALK', MANGAKA_WALK, 24], ['EDITOR_WALK', EDITOR_WALK, 18]] as const) {
      const [c0, p1, c2, p3] = frames
      for (const pass of [p1, p3]) {
        expect(pass[0], name).toBe('.'.repeat(24)) // a row lower
        for (let r = 26; r <= 29; r++) expect(oneSpan(pass[r].slice(0, legs)), `${name} pass row ${r}`).toBe(true)
      }
      for (const contact of [c0, c2]) {
        for (let r = 26; r <= 29; r++) expect(oneSpan(contact[r].slice(0, legs)), `${name} contact row ${r}`).toBe(false)
      }
      expect(c0.slice(25), name).not.toEqual(c2.slice(25)) // the legs swap
      // the arm swing: in frame 0 the hand on the frame's left (cols 4-7; row 21 today) sits higher than the hand on
      // its right (cols 16-19; row 23 today), and frame 2 swaps them
      const [l0, r0, l2, r2] = [handRow(c0, 4, 7), handRow(c0, 16, 19), handRow(c2, 4, 7), handRow(c2, 16, 19)]
      for (const row of [l0, r0, l2, r2]) expect(row, name).toBeGreaterThan(0)
      expect(l0, name).toBeLessThan(r0)
      expect([l2, r2], name).toEqual([r0, l0])
    }
  })

  it('keeps the seated shoes still: the stroke frame moves only the hand', () => {
    expect(MANGAKA_SIT[0].slice(25)).toEqual(MANGAKA_SIT[1].slice(25))
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
    expect([MANGAKA_PANIC[0][6][1], MANGAKA_PANIC[0][6][22], MANGAKA_PANIC[0][6][0]]).toEqual(['j', 'j', 'L'])
    for (const f of MANGAKA_PANIC) for (let r = 4; r <= 15; r++) expect(f[r].slice(0, 3), `row ${r}`).not.toContain('S')
    // the bed pose: 30x14, the first hair cell row 2 col 16
    expect(MANGAKA_LIE).toHaveLength(14)
    expect(MANGAKA_LIE.every((row) => row.length === 30)).toBe(true)
    expect(MANGAKA_LIE[2].indexOf('H')).toBe(16)
    // the editor (task B4): hair row 2 col 8, the left lens's frame row 10 col 6 (col 5 is skin beside it), the tie's
    // knot row 17 col 11, the suit's sleeve row 18 col 5, the briefcase row 24 col 20
    const e = EDITOR_IDLE[0]
    expect([e[2][8], e[10][5], e[10][6], e[17][11], e[18][5], e[24][20]]).toEqual(['H', 'S', 'P', 'N', 'G', 'F'])
    // the doze (generated, task C2): the head down on the folded arms, the hair from row 11, the arms on rows 27-30
    // (sleeves, j, since task B3's manifest remap)
    expect(ASSISTANT_DOZE[11][9]).toBe('H')
    expect(ASSISTANT_DOZE.slice(0, 10).every((r) => r === '.'.repeat(24))).toBe(true)
    expect(ASSISTANT_DOZE[28][4]).toBe('j')
    expect([CAT_SIT[3][3], CAT_WALK[1][6][1], CAT_WALK[0][6][1]]).toEqual(['E', 'C', 'L'])
    expect([PROP_ENVELOPE[1][2], PROP_TROPHY[1][2]]).toEqual(['W', 'Y'])
  })

  it('gives the idle and seated frames a collar (K) and tie (Y/y) that only the cardigan and blazer show', () => {
    for (const f of [...MANGAKA_IDLE, ...MANGAKA_SIT]) {
      const all = f.join('')
      expect(all).toContain('K')
      expect(all).toContain('Y')
    }
    // the hoodie and every assistant keep the colours those cells had: the hoodie J, the shirt's W and R stripes
    expect([PAL.K, PAL.Y, PAL.y]).toEqual([PAL.J, PAL.W, PAL.R])
    for (const pal of ASSISTANT_PALS) expect([pal.K, pal.Y, pal.y]).toEqual([pal.J, pal.W, pal.R])
    for (const o of ['cardigan', 'blazer'] as const) {
      expect([OUTFIT_PALS[o].K, OUTFIT_PALS[o].Y]).toEqual(['#f6f6f6', '#c0392b'])
    }
    // the collar points either side of the neck, the tie down the middle of the shirt from row 18 (row 17 is the V's R,
    // as the idle's); no y on the seated frames since task B3: PAL.y is blue (the old shirt stripe), which would speckle
    // the hoodie's white drawstring, and the idle has none either
    expect([MANGAKA_SIT[0][16].slice(8, 15), MANGAKA_SIT[0][18][11], MANGAKA_SIT[0][22][11]]).toEqual(['KKsssKK', 'Y', 'Y'])
    for (const f of MANGAKA_SIT) expect(f.join('')).not.toContain('y')
  })

  // Task B1: the standing body. Written from the brief's rules, not from cell literals, so a later touch-up that keeps
  // them passes; RED against the 0.8.0 frame (near-black T/t trousers, two-wide J arms, the striped R/W chest).
  it('stands the mangaka in brown trousers (F/f) and red shoes (O/o), never the old near-black T/t', () => {
    const a = MANGAKA_IDLE[0]
    for (let r = 25; r <= 29; r++) expect(a[r], `row ${r}`).toContain('F')
    expect(a.join('')).not.toMatch(/[Tt]/)
    expect(a[30]).toContain('O')
    expect(a[30]).toContain('o')
  })

  it('gives the standing mangaka three-wide sleeves (j) outlined from the torso, ending in hands (S/s) under them', () => {
    const a = MANGAKA_IDLE[0]
    // row 20, from the left edge: L, a j run at least two wide, L (the sleeve as its own run, seamed from the torso)
    const sleeve = /^\.*L(j{2,})L/.exec(a[20])
    expect(sleeve, 'row 20 starts L, j run, L').not.toBeNull()
    const from = a[20].indexOf('L') // the sleeve's outline; the j run fills the columns after it
    const to = from + sleeve![1].length // the j run's last column
    // row 22 at the same columns: the hand, S with one s beside it
    const hand = a[22].slice(from + 1, to + 1)
    expect(hand).toContain('S')
    expect(hand).toContain('s')
    expect(hand).toMatch(/^[Ss]+$/)
    // the hand is under the sleeve: row 21 holds j where row 22 holds S
    const under = [...a[22]].some((ch, c) => ch === 'S' && a[21][c] === 'j')
    expect(under).toBe(true)
    // the sleeve and the hand are separate runs: S never touches j on a row (an L or a row change between them)
    for (const row of a) expect(row, row).not.toMatch(/Sj|jS/)
  })

  it('keeps the collar points either side of the neck and opens a shirt V (R) that narrows from row 17 to row 18', () => {
    const a = MANGAKA_IDLE[0]
    expect(a[16].slice(8, 15)).toBe('KKsssKK')
    // row 17: an R run of three or more between the K cells
    const k0 = a[17].indexOf('K')
    const k1 = a[17].lastIndexOf('K')
    expect(k0).toBeGreaterThan(0)
    expect(k1).toBeGreaterThan(k0)
    const widest = (row: string) => Math.max(0, ...(row.match(/R+/g) ?? []).map((run) => run.length))
    expect(widest(a[17].slice(k0, k1 + 1))).toBeGreaterThanOrEqual(3)
    // row 18: an R run, narrower than row 17's
    expect(a[18]).toContain('R')
    expect(widest(a[18])).toBeLessThan(widest(a[17]))
  })

  it('hangs the drawstring (Y/y, the tie in the other outfits) down the middle of the chest, rows 18-22', () => {
    for (let r = 18; r <= 22; r++) expect(MANGAKA_IDLE[0][r][11], `row ${r}`).toMatch(/^[Yy]$/)
  })

  // Task B2: the stretch, sip and walk on that body. Written from the brief's rules, not from cell literals; RED against
  // the 0.8.0 sets (T/t trousers, two-wide J arms, the stretch's floating arms, the sip's hand that never left the hip,
  // a walk whose contact frames differed by one column).
  it('dresses the stretch, sip and walk in brown trousers (F) and red shoes (O), never the old near-black T/t', () => {
    for (const [name, frames] of [['stretch', MANGAKA_STRETCH], ['sip', MANGAKA_SIP], ['walk', MANGAKA_WALK]] as const) {
      frames.forEach((f, i) => {
        expect(f.join(''), `${name}[${i}]`).not.toMatch(/[Tt]/)
        // the walk's pass frames carry the hem a row lower, on row 25, so their trousers start on row 26
        const from = name === 'walk' && i % 2 === 1 ? 26 : 25
        for (let r = from; r <= 29; r++) expect(f[r], `${name}[${i}] row ${r}`).toContain('F')
        expect(f[30], `${name}[${i}] row 30`).toContain('O')
      })
    }
  })

  it('keeps the standing body under the stretch, sip and walk wherever the pose does not move it', () => {
    const idle = MANGAKA_IDLE[0]
    // the stretch: the shoulder caps (row 17) and everything from the hem down; rows 16 and 18-23 differ because the
    // raised sleeves leave the shoulders and the torso stands alone under them; frame 1 is the breath, as the idle's
    expect(MANGAKA_STRETCH[0][17]).toBe(idle[17])
    expect(MANGAKA_STRETCH[0].slice(24)).toEqual(idle.slice(24))
    expect(MANGAKA_STRETCH[1]).toEqual(breathOf(MANGAKA_STRETCH[0]))
    // the sip: the head above the mug, both sleeves at the shoulders (rows 17-19) and everything from the hem down;
    // rows 12-15 hold the mug and the forearm, row 16 the raised sleeve over the hood's shadow, rows 20-23 lose the
    // hanging arm the sip raised; frame 1 only closes the eyes
    expect(MANGAKA_SIP[0].slice(0, 12)).toEqual(idle.slice(0, 12))
    expect(MANGAKA_SIP[0].slice(17, 20)).toEqual(idle.slice(17, 20))
    expect(MANGAKA_SIP[0].slice(24)).toEqual(idle.slice(24))
    expect(MANGAKA_SIP[1].slice(0, 9)).toEqual(idle.slice(0, 9))
    expect(MANGAKA_SIP[1].slice(12)).toEqual(MANGAKA_SIP[0].slice(12))
    expect(MANGAKA_SIP[1].slice(9, 12)).not.toEqual(MANGAKA_SIP[0].slice(9, 12))
    // the walk's contact frames: the head and shoulders (rows 0-19) and the hem (row 24); the trailing arm hangs as the
    // idle's (frame 0's right, cols 15-23; frame 2's left, cols 0-7) while the leading one swings up; the legs stride
    const [c0, p1, c2, p3] = MANGAKA_WALK
    for (const c of [c0, c2]) {
      expect(c.slice(0, 20)).toEqual(idle.slice(0, 20))
      expect(c[24]).toBe(idle[24])
    }
    for (let r = 20; r <= 23; r++) {
      expect(c0[r].slice(15), `frame 0 row ${r}`).toBe(idle[r].slice(15))
      expect(c2[r].slice(0, 8), `frame 2 row ${r}`).toBe(idle[r].slice(0, 8))
    }
    // the pass frames: the idle a row lower down to and including the hem, then the legs together
    expect(p1).toEqual(p3)
    expect(p1.slice(0, 26)).toEqual(['.'.repeat(24), ...idle.slice(0, 25)])
  })

  it('raises sleeves (j) that end in hands (S) on the stretch and the sip', () => {
    // the stretch: both flung arms show skin and sleeve on rows 12-16 beyond the head (cols 0-3, cols 20-23), one s each
    for (const [from, to] of [[0, 3], [20, 23]] as const) {
      const side = MANGAKA_STRETCH[0].slice(12, 17).map((row) => row.slice(from, to + 1)).join('')
      expect(side, `cols ${from}-${to}`).toContain('S')
      expect(side, `cols ${from}-${to}`).toContain('j')
      expect(side.match(/s/g) ?? [], `cols ${from}-${to}`).toHaveLength(1)
    }
    // the sip: the mug's rim (W in its L outline) on rows 12-13, the hand (S) holding it on row 14, cols 8-11 as today,
    // and the raised sleeve j on rows 15-19 at the leading arm's columns (the idle's left sleeve, cols 4-6)
    const sip = MANGAKA_SIP[0]
    expect(sip[12].slice(8, 12)).toBe('LWWL')
    expect(sip[13].slice(8, 12)).toBe('LWWL')
    expect(sip[14].slice(8, 12)).toMatch(/^L[Ss]{2}L$/)
    for (let r = 15; r <= 19; r++) expect(sip[r].slice(4, 7), `row ${r}`).toContain('j')
  })

  it('steps rather than slides: the contact frames lead with different legs on row 30', () => {
    // the shoe runs on row 30 (O with its o shade), [start, width] each
    const shoes = (f: SpriteMap) => [...f[30].matchAll(/[Oo]+/g)].map((m) => [m.index, m[0].length] as const)
    const [s0, s2] = [shoes(MANGAKA_WALK[0]), shoes(MANGAKA_WALK[2])]
    expect(s0).toHaveLength(2)
    expect(s2).toHaveLength(2)
    // the rule: frame 0's left shoe starts further left than frame 2's left shoe, or the shoe widths swap; the drawing
    // does both (the forward foot reaches out and is the long one), so each is asserted
    expect(s0[0][0]).toBeLessThan(s2[0][0])
    expect(s0[0][1]).toBeGreaterThan(s0[1][1])
    expect(s2[1][1]).toBeGreaterThan(s2[0][1])
    expect([s2[0][1], s2[1][1]]).toEqual([s0[1][1], s0[0][1]])
  })

  // Task B3: the sit, panic and bed on that body. Written from the brief's rules, not from cell literals; RED against
  // the 0.8.0 sets (T/t laps, J arms on the panic, a flat J block under the bed's blanket).
  it('seats and panics the mangaka in brown trousers (F) and red shoes (O), never the old near-black T/t', () => {
    for (const [name, frames] of [['sit', MANGAKA_SIT], ['panic', MANGAKA_PANIC]] as const) {
      frames.forEach((f, i) => {
        expect(f.join(''), `${name}[${i}]`).not.toMatch(/[Tt]/)
        for (let r = 25; r <= 28; r++) expect(f[r], `${name}[${i}] row ${r}`).toContain('F')
        expect(f[30], `${name}[${i}] row 30`).toContain('O')
      })
    }
    expect(MANGAKA_LIE.join('')).not.toMatch(/[Tt]/)
  })

  it('moves only the pen hand between the seated frames: rows 0-19 and 25-31 are shared, rows 20-24 differ', () => {
    expect(MANGAKA_SIT[0].slice(0, 20)).toEqual(MANGAKA_SIT[1].slice(0, 20))
    expect(MANGAKA_SIT[0].slice(25)).toEqual(MANGAKA_SIT[1].slice(25))
    expect(MANGAKA_SIT[0].slice(20, 25)).not.toEqual(MANGAKA_SIT[1].slice(20, 25))
    // the hand (S) beside the pen's L at col 0, a row lower on the stroke frame
    expect(handRow(MANGAKA_SIT[1], 1, 3)).toBe(handRow(MANGAKA_SIT[0], 1, 3) + 1)
    expect(MANGAKA_SIT[0][handRow(MANGAKA_SIT[0], 1, 3)][0]).toBe('L')
  })

  it('raises the panic\'s arms as sleeves (j) down the sides, the hands (S) on top of the head', () => {
    MANGAKA_PANIC.forEach((f, i) => {
      // the forearms beside the head: j in the elbow columns on rows 4-8, and never the torso's J there on rows 3-16
      for (let r = 4; r <= 8; r++) {
        expect(f[r].slice(0, 3), `panic[${i}] row ${r} left`).toContain('j')
        expect(f[r].slice(21), `panic[${i}] row ${r} right`).toContain('j')
      }
      for (let r = 3; r <= 16; r++) {
        expect(f[r].slice(0, 4), `panic[${i}] row ${r} left`).not.toContain('J')
        expect(f[r].slice(20), `panic[${i}] row ${r} right`).not.toContain('J')
      }
      // the hands on the hair: rows 1-2 (frame 0), a row lower on frame 1
      for (const r of i === 0 ? [1, 2] : [2, 3]) {
        expect(f[r].slice(1, 5), `panic[${i}] row ${r} left hand`).toContain('S')
        expect(f[r].slice(17, 21), `panic[${i}] row ${r} right hand`).toContain('S')
      }
    })
  })

  it('shows the hoodie\'s shoulders (j) over the body (J) under the bed\'s blanket', () => {
    // a j shoulder band on row 8 or 9 at cols 1-10, with the J body row right under it
    const band = [8, 9].some((r) => [...MANGAKA_LIE[r].slice(1, 11)].some((ch, c) => ch === 'j' && MANGAKA_LIE[r + 1][c + 1] === 'J'))
    expect(band).toBe(true)
  })

  // Task B4: the editor on that body, in a suit. Written from the brief's rules, not from cell literals; RED against the
  // 0.8.0 editor (the grey G/g, a P bar across row 10 for the glasses, T/t trousers, red O shoes).
  it('recolours the suit keys (G/g) to the sheet\'s navy, apart from the level-10 blazer', () => {
    expect([PAL.G, PAL.g]).toEqual(['#3a3d4c', '#2c3656'])
    expect(OUTFIT_PALS.blazer.J).not.toBe(PAL.G)
    expect(OUTFIT_PALS.blazer.j).not.toBe(PAL.g)
  })

  it('gives the editor glasses: two framed lenses with an eye inside each, joined by one P cell, skin outside', () => {
    for (const f of [EDITOR_IDLE[0], EDITOR_WALK[0], EDITOR_WALK[2]]) {
      // row 10: S, a lens (P, the eye E with its W highlight, P), the bridge P, the other lens, S
      const m = /S(P[EW][EW]P)(P)(P[EW][EW]P)S/.exec(f[10])
      expect(m, f[10]).not.toBeNull()
      const from = m!.index + 1 // the left lens's first column
      const lens = (c: number) => [c, c + 1, c + 2, c + 3] as const
      const [left, right] = [lens(from), lens(from + 5)]
      for (const r of [9, 11]) {
        for (const c of [...left, ...right]) expect(f[r][c], `row ${r} col ${c}`).toBe('P')
        expect(f[r][from + 4], `row ${r} between the lenses`).toBe('S')
        expect(f[r][from - 1], `row ${r} outside the left lens`).toBe('S')
        expect(f[r][from + 9], `row ${r} outside the right lens`).toBe('S')
      }
      // an E in each lens
      expect(f[10].slice(left[1], left[2] + 1)).toContain('E')
      expect(f[10].slice(right[1], right[2] + 1)).toContain('E')
      // never today's bar: P across the whole eye line
      expect(f[10]).not.toMatch(/P{6,}/)
    }
    // the hair rows stay ANCHOR_HEAD's; the breath and the pass frames carry the same head a row lower
    expect(EDITOR_IDLE[0].slice(0, 9)).toEqual(ANCHOR_HEAD.slice(0, 9))
    expect(EDITOR_IDLE[1].slice(1, 13)).toEqual(EDITOR_IDLE[0].slice(0, 12))
    expect(EDITOR_WALK[1].slice(1, 13)).toEqual(EDITOR_IDLE[0].slice(0, 12))
  })

  it('dresses the editor in a navy suit (G/g) over black shoes (E), a white collar (W) and a tie (N) down the chest', () => {
    for (const [name, frames] of [['idle', EDITOR_IDLE], ['walk', EDITOR_WALK]] as const) {
      frames.forEach((f, i) => {
        // never the old near-black T/t trousers or the mangaka's red O/o shoes, and none of the mangaka's own keys
        expect(f.join(''), `${name}[${i}]`).not.toMatch(/[TtOoJjKRYy]/)
        // the trousers: G on every leg row, the shoes E on row 30
        const from = name === 'walk' && i % 2 === 1 ? 26 : 25
        for (let r = from; r <= 29; r++) expect(f[r], `${name}[${i}] row ${r}`).toContain('G')
        expect(f[30], `${name}[${i}] row 30`).toContain('E')
        // the collar: W either side of the neck (s) on row 16 (a row lower on the breath and the pass), the tie's
        // column N from the knot on row 17 to row 21
        const dy = name === 'idle' ? i : i % 2
        expect(f[16 + dy].slice(6, 17), `${name}[${i}] row ${16 + dy}`).toMatch(/^[Gg]+W+s+W+[Gg]+$/)
        for (let r = 17; r <= 21; r++) expect(f[r + dy][11], `${name}[${i}] row ${r + dy}`).toBe('N')
      })
    }
    // the sleeves are the suit's G, three wide and seamed from the torso, the hands S/s under them, as the mangaka's
    const e = EDITOR_IDLE[0]
    expect(e[20]).toMatch(/^\.*L[Gg]{3}L/)
    expect(e[22].slice(4, 7)).toMatch(/^[Ss]+$/)
    for (const row of e) expect(row, row).not.toMatch(/S[Gg]|[Gg]S/)
  })

  it('hangs a 6x7 briefcase (F/f in its L box) at cols 18-23 from the trailing hand, a row lower on the pass frames', () => {
    const box = (f: SpriteMap, top: number) => f.slice(top, top + 7).map((row) => row.slice(18, 24))
    const isCase = (rows: string[]) => {
      expect(rows[0]).toBe('LLLLLL')
      expect(rows[6]).toBe('LLLLLL')
      for (const row of rows.slice(1, 6)) expect(row).toMatch(/^L[Ff]{4}L$/)
      expect(rows.slice(1, 6).join('')).toContain('F')
      expect(rows.slice(1, 6).join('')).toContain('f')
    }
    const [c0, p1, c2, p3] = EDITOR_WALK
    for (const f of [EDITOR_IDLE[0], c0, c2]) isCase(box(f, 22))
    for (const f of [EDITOR_IDLE[1], p1, p3]) isCase(box(f, 23))
    // nothing of the case above its top edge
    for (const f of [EDITOR_IDLE[0], c0, c2]) expect(f[21].slice(20, 24)).toBe('....')
    for (const f of [EDITOR_IDLE[1], p1, p3]) expect(f[22].slice(20, 24)).toBe('....')
    // the pass frames are one map: the idle a row lower down to the hem, the legs together under it
    expect(p1).toEqual(p3)
    expect(p1.slice(0, 26)).toEqual(['.'.repeat(24), ...EDITOR_IDLE[0].slice(0, 25)])
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

  it('keeps the anchor head (the graft and the staff portrait) equal to the standing frame rows 0-15', () => {
    expect(ANCHOR_HEAD).toEqual(MANGAKA_IDLE[0].slice(0, 16))
    expect(faceRules(ANCHOR_HEAD.concat(MANGAKA_IDLE[0].slice(16)))).toEqual([])
  })

  it('derives the breath the way the hand-drawn idle has it', () => {
    // the breath: rows 0-23 a row lower, the hem row 24 tucked under; exactly the hand-drawn idle's frame 1
    expect(breathOf(MANGAKA_IDLE[0])).toEqual(MANGAKA_IDLE[1])
    expect(MANGAKA_IDLE[1][24]).toBe(MANGAKA_IDLE[0][23])
    expect(MANGAKA_IDLE[1].slice(25)).toEqual(MANGAKA_IDLE[0].slice(25))
  })

  it('draws the task C2 readability gate winner, the generated assistant doze, and keeps the hand-drawn idle', () => {
    expect(ASSISTANT_DOZE).toEqual(ASSISTANT_DOZE_C2)
    // fills against the hand-drawn doze it replaced (113, task C2 report); task B3's remap of the folded arms' J to j
    // (sleeves) merged runs: 100 before it
    expect(runCount(ASSISTANT_DOZE)).toBe(91)
    expect(runCount(ASSISTANT_DOZE)).toBeLessThanOrEqual(1.25 * 113)
    // the doze is a valid, faceless 24x32 frame (the doze never takes the FACES overlay)
    expect(frameRules(ASSISTANT_DOZE_C2)).toEqual([])
    // the controller's ruling: the generated idle was retired, the scene draws the hand-drawn standing frame (195 and
    // 192 runs at 0.8.0; task B1's body, with its seamed three-wide sleeves and shirt V, 204 and 201, under RUN_CAPS)
    expect(MANGAKA_IDLE.map(runCount)).toEqual([204, 201])
  })
})
