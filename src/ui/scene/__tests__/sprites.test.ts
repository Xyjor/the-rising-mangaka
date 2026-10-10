// The sprite maps obey the frame rules: every row the frame's width, every key in the palette, the last row painted and
// the outline closed on every row. Pure data, the default node environment. Since 0.11.0 the rig draws the mangaka and
// the assistants (rig.test, rigPoses.test); these are the editor's and the cat's frames, the props, and the 0.10
// standing and walk frames the editor is cut from (LEGACY_IDLE, LEGACY_WALK).
import { describe, expect, it } from 'vitest'
import {
  ANCHOR_HEAD, ASSISTANT_PALS, CAT_GROOM, CAT_SIT, CAT_SLEEP, CAT_STRETCH, CAT_WALK, EDITOR_FRAMES, EDITOR_IDLE, EDITOR_PAL, EDITOR_WALK,
  LEGACY_IDLE, LEGACY_WALK, OUTFIT_PALS, PAL, PROP_CONTRACT, PROP_ENVELOPE, PROP_LETTER, PROP_PAL, PROP_TROPHY, faceRules,
  frameRules, outfitOf, type SpriteMap,
} from '../sprites'
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../../looks'
import { hexToRgb, rgbToOklab, runCount } from '../../art/pixelOps'

/**
 * The run-count caps: 1.3x each frame's `runCount` before Release B's redraw, floored. A redraw may add detail up to the
 * cap and never past it. Since 0.11.0 only the editor and the cat are drawn from string maps (the rig draws the mangaka
 * and the assistants), so only their rows are left. Never raise a cap.
 */
const RUN_CAPS: readonly [string, readonly SpriteMap[], readonly number[]][] = [
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

/** The cat's frames where it is awake and its head shows, by name (the curled sleep hides its chest, ears and eye). */
const CAT_AWAKE: readonly [string, SpriteMap][] = [
  ['CAT_SIT', CAT_SIT], ['CAT_WALK[0]', CAT_WALK[0]], ['CAT_WALK[1]', CAT_WALK[1]],
  ['CAT_GROOM[0]', CAT_GROOM[0]], ['CAT_GROOM[1]', CAT_GROOM[1]], ['CAT_STRETCH', CAT_STRETCH],
]

/**
 * How many tabby stripe cells a cat frame has: a `c` cell with fur (`C`) on both sides on its row, counted only on
 * the back and the tail, which lie right of the head's columns 0-4 in every frame. By rows alone the walk's and the
 * stretch's heads share their rows with the back and the tail, so the head is left out by its columns: the groom's
 * raised paw (its shaded underside), the face (the eye, the muzzle) and the chest all sit in cols 0-4. The shade
 * down the body's right edge (`c` against the `L` outline) and a `c` blob (two shade cells side by side) are not
 * stripes either.
 */
function stripes(f: SpriteMap): number {
  let n = 0
  for (const row of f) for (let c = 5; c < row.length - 1; c++) if (row[c] === 'c' && row[c - 1] === 'C' && row[c + 1] === 'C') n++
  return n
}

/**
 * What stops a cat frame's ears reading as points, [] when nothing: on the head's first painted row (the first row with
 * content in cols 0-5, the head's half of the 12-wide frame, so the stretch's raised tail does not count), the `L` cells
 * are exactly two single-cell runs (the tips, each with no `L` beside it), each over a painted cell on the row below,
 * and nothing else is painted outside them: between them only `.`, or the groom's raised paw in fur (`C`).
 */
function earTips(f: SpriteMap): string[] {
  const r = f.findIndex((row) => /[^.]/.test(row.slice(0, 6)))
  if (r < 0) return ['no head']
  const row = f[r].slice(0, 6)
  const out: string[] = []
  const tips: number[] = []
  for (let c = 0; c < row.length; c++) {
    if (row[c] !== 'L') continue
    if (row[c - 1] === 'L' || row[c + 1] === 'L') out.push(`row ${r} col ${c}: an L run wider than one cell`)
    else tips.push(c)
  }
  if (tips.length !== 2) out.push(`row ${r}: ${tips.length} ear tips, not 2`)
  for (const c of tips) if (!f[r + 1] || f[r + 1][c] === '.') out.push(`row ${r} col ${c}: a tip over nothing`)
  if (tips.length === 2) {
    const [a, b] = tips
    if (/[^.]/.test(row.slice(0, a)) || /[^.]/.test(row.slice(b + 1))) out.push(`row ${r}: painted outside the ear tips`)
    if (/[^.C]/.test(row.slice(a + 1, b))) out.push(`row ${r}: something other than the paw between the ears`)
  }
  return out
}

describe('the sprites', () => {
  it("dresses the mangaka's leg parts as the editor's: EDITOR_PAL turns the trousers F/f to the suit G/g and the shoes O/o black", () => {
    expect([EDITOR_PAL.F, EDITOR_PAL.f, EDITOR_PAL.O, EDITOR_PAL.o]).toEqual([PAL.G, PAL.g, PAL.E, PAL.E])
    // everything else is PAL's, the case's leather D/d included
    for (const k of Object.keys(PAL)) if (!'FfOo'.includes(k)) expect(EDITOR_PAL[k], k).toBe(PAL[k])
    expect([PAL.D, PAL.d]).toEqual(['#6d4c33', '#4e3622'])
  })

  it('passes the frame rules for every 24x32 frame (the editor and his 0.10 source) and the 12x8 cat', () => {
    expect(EDITOR_FRAMES).toEqual([...EDITOR_IDLE, ...EDITOR_WALK])
    expect(EDITOR_FRAMES).toHaveLength(6)
    ;[...EDITOR_FRAMES, LEGACY_IDLE, ...LEGACY_WALK].forEach((f, i) => {
      expect(f.every((row) => row.length === 24), `frame ${i}`).toBe(true)
      expect(frameRules(f), `frame ${i}`).toEqual([])
    })
    for (const cat of [CAT_SLEEP, CAT_SIT, ...CAT_WALK, ...CAT_GROOM, CAT_STRETCH]) expect(frameRules(cat, 12, 8)).toEqual([])
    expect(frameRules(PROP_ENVELOPE, 6, 4, PROP_PAL)).toEqual([])
    expect(frameRules(PROP_LETTER, 5, 6, PROP_PAL)).toEqual([])
    expect(frameRules(PROP_CONTRACT, 5, 7, PROP_PAL)).toEqual([])
    expect(frameRules(PROP_TROPHY, 5, 6, PROP_PAL)).toEqual([])
    // a prop key is not a person's
    expect(frameRules(PROP_ENVELOPE, 6, 4)).not.toEqual([]) // its paper-line l
  })

  it('faceRules: the FACES window holds only face keys, the mark slot is clear, the head stays in the avatar crop', () => {
    // the 0.10 standing frame (ANCHOR_HEAD's body, and the editor's source) passes; scripts/pixelate.ts still reports it
    expect(faceRules(LEGACY_IDLE)).toEqual([])
    // hair inside the FACES window (rows 9-12, cols 4-17)
    const hair = LEGACY_IDLE.slice()
    hair[10] = hair[10].slice(0, 5) + 'H' + hair[10].slice(6)
    expect(faceRules(hair)).toEqual(['row 10 col 5 is H, not a face key'])
    // something in the mark slot (rows 0-2, cols 20-22)
    const mark = LEGACY_IDLE.slice()
    mark[1] = mark[1].slice(0, 21) + 'L' + mark[1].slice(22)
    expect(faceRules(mark)).toContain('row 1 col 21 is in the mark slot')
    // the head spilling out of the avatar crop (rows 0-15, cols 2-19)
    const wide = LEGACY_IDLE.slice()
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
    // the editor's legs are read left of the briefcase (cols 18-23, task B4), which hangs beside them on every frame
    const [c0, p1, c2, p3] = EDITOR_WALK
    for (const pass of [p1, p3]) {
      expect(pass[0]).toBe('.'.repeat(24)) // a row lower
      for (let r = 26; r <= 29; r++) expect(oneSpan(pass[r].slice(0, 18)), `pass row ${r}`).toBe(true)
    }
    for (const contact of [c0, c2]) {
      for (let r = 26; r <= 29; r++) expect(oneSpan(contact[r].slice(0, 18)), `contact row ${r}`).toBe(false)
    }
    expect(c0.slice(25)).not.toEqual(c2.slice(25)) // the legs swap
    // the arm swing: in frame 0 one hand sits higher than the other (the one on the frame's right, cols 16-19, at row
    // 20; the one on its left, cols 4-7, hanging to row 22), and frame 2 swaps them; which side swings up against
    // which leg is the test 'swings the arm opposite the forward leg on each contact frame' below
    const [l0, r0, l2, r2] = [handRow(c0, 4, 7), handRow(c0, 16, 19), handRow(c2, 4, 7), handRow(c2, 16, 19)]
    for (const row of [l0, r0, l2, r2]) expect(row).toBeGreaterThan(0)
    expect(l0).not.toBe(r0)
    expect([l2, r2]).toEqual([r0, l0])
  })

  it('reports a short row, an unknown key and an empty last row', () => {
    const broken = LEGACY_IDLE.slice()
    broken[5] = broken[5].slice(0, 23)
    broken[9] = broken[9].replace('E', '#')
    broken[31] = '.'.repeat(24)
    expect(frameRules(broken)).toHaveLength(3)
    // and an open outline
    const open = LEGACY_IDLE.slice()
    open[7] = '..SHSSSSSSSSSSSSSShL....'
    expect(frameRules(open)).toEqual(['row 7 is open'])
  })

  it('keeps the editor\'s, the cat\'s and the props\' cells where the scene tests read them', () => {
    // the editor (task B4): hair row 2 col 8, the left lens's frame row 10 col 6 (col 5 is skin beside it), the tie's
    // knot row 17 col 11, the suit's sleeve row 18 col 5, the briefcase row 24 col 20
    const e = EDITOR_IDLE[0]
    expect([e[2][8], e[10][5], e[10][6], e[17][11], e[18][5], e[24][20]]).toEqual(['H', 'S', 'P', 'N', 'G', 'F'])
    // the cat (task B5): the sit's eye row 3 col 2 (render.test reads it at (46, 153) in the kitchen), the walk's paw
    expect([CAT_SIT[3][2], CAT_WALK[1][6][1], CAT_WALK[0][6][1]]).toEqual(['E', 'C', 'L'])
    expect([PROP_ENVELOPE[1][2], PROP_TROPHY[1][2]]).toEqual(['W', 'Y'])
  })

  it('gives the hoodie and every assistant look the collar and tie keys in their own colours, the cardigan and blazer a white collar and red tie', () => {
    // the hoodie and every assistant keep the colours those cells had: the hoodie J, the shirt's W and R stripes
    expect([PAL.K, PAL.Y, PAL.y]).toEqual([PAL.J, PAL.W, PAL.R])
    for (const pal of ASSISTANT_PALS) expect([pal.K, pal.Y, pal.y]).toEqual([pal.J, pal.W, pal.R])
    for (const o of ['cardigan', 'blazer'] as const) {
      expect([OUTFIT_PALS[o].K, OUTFIT_PALS[o].Y]).toEqual(['#f6f6f6', '#c0392b'])
    }
  })

  it('swings the arm opposite the forward leg on each contact frame, never the same side (a pacing gait)', () => {
    // the forward leg steps out of the idle's stance: its shoe run on row 30 starts furthest from where the idle's same
    // shoe starts (further left on frame 0, the left-facing lead; mirrored, further right on frame 2); the higher hand
    // is the S nearer the top (handRow: cols 4-7 the frame's left hand, cols 16-19 its right)
    const shoes = (f: SpriteMap) => [...f[30].matchAll(/[OoE]+/g)].map((m) => m.index)
    const home = shoes(EDITOR_IDLE[0])
    expect(home).toHaveLength(2)
    const forward = [0, 2].map((i) => {
      const f = EDITOR_WALK[i]
      const moved = shoes(f).map((c, k) => Math.abs(c - home[k]))
      expect(moved, `EDITOR_WALK[${i}]`).toHaveLength(2)
      expect(moved[0], `EDITOR_WALK[${i}]: one leg steps out further`).not.toBe(moved[1])
      const leg = moved[0] > moved[1] ? 'left' : 'right'
      const hand = handRow(f, 4, 7) < handRow(f, 16, 19) ? 'left' : 'right'
      expect(hand, `EDITOR_WALK[${i}]: the higher hand, against the forward ${leg} leg`).not.toBe(leg)
      return leg
    })
    expect(forward).toEqual(['left', 'right'])
  })

  it('shades each leg the same on both contact frames: the stride moves a leg, never re-lights it', () => {
    // each leg's span on rows 26-29 (its outline either side, the trousers between); the frames mirror the stride
    // (which leg steps out), not the light, which stays top left, so a leg reads the same standing or stepping
    const spans = (f: SpriteMap, r: number, to: number) => f[r].slice(0, to).match(/[^.]+/g) ?? []
    for (let r = 26; r <= 29; r++) {
      // the editor's left leg, read left of the briefcase (cols 18-23; the right leg passes behind it on frame 2, so
      // its rows are the next test's)
      const [e0, e2] = [spans(EDITOR_WALK[0], r, 18)[0], spans(EDITOR_WALK[2], r, 18)[0]]
      expect(e2, `EDITOR_WALK row ${r}: the left leg`).toBe(e0)
      // the leg standing under the hip on frame 2 (the left, cols 7-11) keeps the idle's shading, cell for cell
      expect(EDITOR_WALK[2][r].slice(7, 12), `EDITOR_WALK[2] row ${r}`).toBe(EDITOR_IDLE[0][r].slice(7, 12))
    }
  })

  it("walks the editor on the 0.10 mangaka's legs: each walk frame's leg rows are LEGACY_WALK's in the suit, outside the case", () => {
    // the suit's recolour, the test's own: the trousers F/f to G/g, the shoes O/o to black E; the briefcase hangs over
    // cols 18-23, so only cols 0-17 are compared; the leg rows start at 25 (26 on the pass frames, whose hem is on 25)
    const suit: Record<string, string> = { F: 'G', f: 'g', O: 'E', o: 'E' }
    const inSuit = (row: string) => row.replace(/[FfOo]/g, (k) => suit[k])
    EDITOR_WALK.forEach((f, i) => {
      for (let r = i % 2 === 1 ? 26 : 25; r <= 31; r++) {
        expect(f[r].slice(0, 18), `EDITOR_WALK[${i}] row ${r}`).toBe(inSuit(LEGACY_WALK[i][r].slice(0, 18)))
      }
    })
    // and the contact frames' shoulders (rows 16-19) are the standing editor's
    for (const f of [EDITOR_WALK[0], EDITOR_WALK[2]]) expect(f.slice(16, 20)).toEqual(EDITOR_IDLE[0].slice(16, 20))
  })

  // Task B4: the editor on that body, in a suit. Written from the brief's rules, not from cell literals; RED against the
  // pre-redraw editor (the grey G/g, a P bar across row 10 for the glasses, T/t trousers, red O shoes).
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

  it("draws the glasses' frame (P) a mid steel, an OKLab lightness step of at least 0.25 from the eye, its highlight and the skin", () => {
    // 0.10.1: P was #3b3b45 (OKLab L 0.356), only 0.134 above the eye E (0.222), so at scene scale each lens read as
    // one dark block. At least 0.25 either side keeps the eye (E) and its highlight (W) legible inside the frame and the
    // frame legible on the skin (S, 0.876): P's L between 0.472 and 0.626.
    const lightness = (hex: string) => rgbToOklab(...hexToRgb(hex))[0]
    expect(lightness(PAL.P) - lightness(PAL.E), 'P over E').toBeGreaterThanOrEqual(0.25)
    expect(lightness(PAL.W) - lightness(PAL.P), 'W over P').toBeGreaterThanOrEqual(0.25)
    expect(lightness(PAL.S) - lightness(PAL.P), 'S over P').toBeGreaterThanOrEqual(0.25)
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

  it('hangs a 6x7 briefcase (F/f in its L box) at cols 18-23 from the right hand, a row lower on the pass frames', () => {
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
    // the eye closes to a shade cell in both frames, not hidden: CAT_SIT's E at row 3 col 2 (task B5 moved it a column
    // forward from row 3 col 3, the muzzle in front of it) becomes c
    expect(CAT_SIT[3][2]).toBe('E')
    expect(CAT_GROOM[0][3][2]).toBe('c')
    expect(CAT_GROOM[1][3][2]).toBe('c')
  })

  it('stripes the tabby: two to four c cells with fur either side down the back and tail, every frame but the sleep (B5)', () => {
    for (const [name, f] of CAT_AWAKE) {
      expect(stripes(f), name).toBeGreaterThanOrEqual(2)
      expect(stripes(f), name).toBeLessThanOrEqual(4)
    }
    // the groom's raised paw (frame 1's shaded underside, fur either side on the ridge row) is not a stripe: both groom
    // frames have the sit's body, so the sit's stripes
    for (const f of CAT_GROOM) expect(stripes(f)).toBe(stripes(CAT_SIT))
    // nor is a shade mark on the face: a c in the forehead fur (row 2 col 2) leaves the count alone
    const marked = CAT_SIT.slice()
    marked[2] = 'LCcCcL......'
    expect(stripes(marked)).toBe(stripes(CAT_SIT))
  })

  it('points the ears: two single L tips on the first row of the head, each over fur, on every frame but the sleep (B5)', () => {
    for (const [name, f] of CAT_AWAKE) expect(earTips(f), name).toEqual([])
  })

  it('gives the cat one dark eye awake, and none asleep or grooming (B5)', () => {
    const eyes = (f: SpriteMap) => f.join('').split('E').length - 1
    for (const f of [CAT_SIT, ...CAT_WALK, CAT_STRETCH]) expect(eyes(f)).toBe(1)
    for (const f of [CAT_SLEEP, ...CAT_GROOM]) expect(eyes(f)).toBe(0)
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

  it("keeps the anchor head (the graft and the editor's head) equal to the 0.10 standing frame's rows 0-15", () => {
    expect(ANCHOR_HEAD).toEqual(LEGACY_IDLE.slice(0, 16))
    expect(faceRules(ANCHOR_HEAD.concat(LEGACY_IDLE.slice(16)))).toEqual([])
  })
})
