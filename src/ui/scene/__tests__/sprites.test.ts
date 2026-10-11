// The sprite maps obey the frame rules: every row the frame's width, every key in the palette, the last row painted and
// the outline closed on every row. Pure data, the default node environment. Since 0.11.0 the rig draws the mangaka and
// the assistants (rig.test, rigPoses.test), and since 0.12.0 the editor (rigHead.test, rigPoses.test): these are the
// cat's frames, the palettes, and the anchor head the --sprite graft keeps (spriteCore.ts).
import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_PALS, CAT_GROOM, CAT_SIT, CAT_SLEEP, CAT_STRETCH, CAT_WALK, EDITOR_PAL, OUTFIT_PALS, PAL, frameRules, outfitOf,
  type SpriteMap,
} from '../sprites'
import { ANCHOR_HEAD, faceRules } from '../spriteCore'
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../../looks'
import { runCount } from '../../art/pixelOps'

/**
 * The run-count caps: 1.3x each frame's `runCount` before Release B's redraw, floored. A redraw may add detail up to the
 * cap and never past it. Since 0.12.0 only the cat is drawn from string maps (the rig draws the mangaka, the assistants
 * and the editor), so only its rows are left. Never raise a cap.
 */
const RUN_CAPS: readonly [string, readonly SpriteMap[], readonly number[]][] = [
  ['CAT_SLEEP', [CAT_SLEEP], [40]],
  ['CAT_SIT', [CAT_SIT], [44]],
  ['CAT_WALK', CAT_WALK, [48, 45]],
  ['CAT_GROOM', CAT_GROOM, [42, 45]],
  ['CAT_STRETCH', [CAT_STRETCH], [32]],
]

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

  it('passes the frame rules for the 12x8 cat', () => {
    for (const cat of [CAT_SLEEP, CAT_SIT, ...CAT_WALK, ...CAT_GROOM, CAT_STRETCH]) expect(frameRules(cat, 12, 8)).toEqual([])
  })

  it('faceRules: the FACES window holds only face keys, the mark slot is clear, the head stays in the avatar crop', () => {
    // the anchor head passes; scripts/pixelate.ts still reports it for the --sprite graft
    expect(faceRules(ANCHOR_HEAD)).toEqual([])
    // hair inside the FACES window (rows 9-12, cols 4-17)
    const hair = ANCHOR_HEAD.slice()
    hair[10] = hair[10].slice(0, 5) + 'H' + hair[10].slice(6)
    expect(faceRules(hair)).toEqual(['row 10 col 5 is H, not a face key'])
    // something in the mark slot (rows 0-2, cols 20-22)
    const mark = ANCHOR_HEAD.slice()
    mark[1] = mark[1].slice(0, 21) + 'L' + mark[1].slice(22)
    expect(faceRules(mark)).toContain('row 1 col 21 is in the mark slot')
    // the head spilling out of the avatar crop (rows 0-15, cols 2-19)
    const wide = ANCHOR_HEAD.slice()
    wide[4] = 'L' + wide[4].slice(1)
    expect(faceRules(wide)).toEqual(['row 4 col 0 is outside the avatar crop'])
  })

  it('keeps every frame under its run-count cap (RUN_CAPS)', () => {
    for (const [name, frames, caps] of RUN_CAPS) {
      expect(frames.length, name).toBe(caps.length)
      frames.forEach((f, i) => expect(runCount(f), `${name}[${i}]`).toBeLessThanOrEqual(caps[i]))
    }
  })

  it('reports a short row, an unknown key and an empty last row', () => {
    const broken = CAT_SIT.slice()
    broken[5] = broken[5].slice(0, 11)
    broken[3] = broken[3].replace('E', '#')
    broken[7] = '.'.repeat(12)
    expect(frameRules(broken, 12, 8)).toHaveLength(3)
    // and an open outline
    const open = CAT_SIT.slice()
    open[2] = 'CCCCcL......'
    expect(frameRules(open, 12, 8)).toEqual(['row 2 is open'])
  })

  it('keeps the cat\'s cells where the scene tests read them', () => {
    // the cat (task B5): the sit's eye row 3 col 2 (render.test reads it at (46, 153) in the kitchen), the walk's paw
    expect([CAT_SIT[3][2], CAT_WALK[1][6][1], CAT_WALK[0][6][1]]).toEqual(['E', 'C', 'L'])
  })

  it('gives the hoodie and every assistant look the collar and tie keys in their own colours, the cardigan and blazer a white collar and red tie', () => {
    // the hoodie and every assistant keep the colours those cells had: the hoodie J, the shirt's W and R stripes
    expect([PAL.K, PAL.Y, PAL.y]).toEqual([PAL.J, PAL.W, PAL.R])
    for (const pal of ASSISTANT_PALS) expect([pal.K, pal.Y, pal.y]).toEqual([pal.J, pal.W, pal.R])
    for (const o of ['cardigan', 'blazer'] as const) {
      expect([OUTFIT_PALS[o].K, OUTFIT_PALS[o].Y]).toEqual(['#f6f6f6', '#c0392b'])
    }
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

  it('keeps the anchor head for the --sprite graft: 24 wide, 16 rows, faceRules clean', () => {
    expect(ANCHOR_HEAD).toHaveLength(16)
    for (const row of ANCHOR_HEAD) expect(row, row).toHaveLength(24)
    expect(faceRules(ANCHOR_HEAD)).toEqual([])
  })
})
