// The cast's pose families keep their contracts (0.11.0): written from each family's rules, not cell literals, so a
// redraw that keeps the rules passes. Pure data, node environment.
import { describe, expect, it } from 'vitest'
import { placeLayers } from '../rig/assemble'
import { ANIMS } from '../rig/anims'
import { rigFrame } from '../rig/frames'
import { PARTS } from '../rig/parts'
import { POSES } from '../rig/poses'
import type { PoseId } from '../rig/poses'
import { LAYERS } from '../rig/types'
import type { AnchorName, Layer, Mood, PartPose, SpriteMap } from '../rig/types'

const part = (id: PoseId): PartPose => {
  const p = POSES[id].pose
  if (p.kind !== 'parts') throw new Error(`${id} is a key frame`)
  return p
}
const at = (id: PoseId, layer: Layer) => placeLayers(part(id), PARTS).get(layer)?.at
const frame = (id: PoseId, mood: Mood = 'neutral', ready = false): SpriteMap => rigFrame(id, mood, ready).map
/** A map's painted cells but L with a clear cell (or the map's edge) beside, above or below them: where it is open. */
function openCells(map: SpriteMap): { x: number; y: number }[] {
  const clear = (x: number, y: number) => y < 0 || y >= map.length || x < 0 || x >= map[y].length || map[y][x] === '.'
  const out: { x: number; y: number }[] = []
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '.' && row[x] !== 'L' && (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1))) out.push({ x, y })
    }
  })
  return out
}
/** A part pose's layers painted back to front as drawn (the head bare, nothing closed): how the parts join by themselves. */
function rawFrame(id: PoseId): SpriteMap {
  const pose = part(id)
  const grid = Array.from({ length: pose.h }, () => Array.from({ length: pose.w }, () => '.'))
  const placed = placeLayers(pose, PARTS)
  for (const layer of LAYERS) {
    const p = placed.get(layer)
    p?.part.map.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] !== '.') grid[p.at.y + r][p.at.x + c] = row[c]
    })
  }
  return grid.map((row) => row.join(''))
}
/** Each listed part's size and anchors, as the plan's catalogue fixes them. */
function expectCatalogue(want: Record<string, [number, number, Partial<Record<AnchorName, [number, number]>>]>) {
  for (const [name, [w, h, anchors]] of Object.entries(want)) {
    const p = PARTS[name]
    expect(p, name).toBeDefined()
    expect([p.map[0].length, p.map.length], name).toEqual([w, h])
    expect(p.anchors, name).toEqual(Object.fromEntries(Object.entries(anchors).map(([k, [x, y]]) => [k, { x, y }])))
  }
}

describe('the standing base (task 8)', () => {
  it('catalogues the head, the torso, the hanging arms and the standing legs', () => {
    expectCatalogue({
      head: [27, 22, { neck: [12, 21] }],
      torso: [18, 14, { neck: [9, 0], shoulderL: [2, 2], shoulderR: [15, 2], hipL: [6, 13], hipR: [11, 13] }],
      'arm-l-hang': [5, 12, { shoulderL: [3, 0], hand: [2, 10] }],
      'arm-r-hang': [5, 12, { shoulderR: [1, 0], hand: [2, 10] }],
      'leg-l-stand': [6, 14, { hipL: [3, 0] }],
      'leg-r-stand': [6, 14, { hipR: [2, 0] }],
    })
  })

  it('outlines each standing part all round but where it joins another: the neck and shoulder caps of the torso, the tops of the arms and legs', () => {
    const { shoulderL, shoulderR } = PARTS.torso.anchors
    if (!shoulderL || !shoulderR) throw new Error('the torso has no shoulders')
    // the torso is open on row 0 (the neck, under the head's jaw) and on the shoulder row outside its seams (the caps
    // the sleeves hang under); an arm or a leg only on its top row (under the shoulder cap, under the hem)
    const torsoJoint = ({ x, y }: { x: number; y: number }) => y === 0 || (y === shoulderL.y && (x <= shoulderL.x || x >= shoulderR.x))
    expect(openCells(PARTS.torso.map).filter((c) => !torsoJoint(c)), 'torso').toEqual([])
    for (const name of ['arm-l-hang', 'arm-r-hang', 'leg-l-stand', 'leg-r-stand']) {
      expect(openCells(PARTS[name].map).filter(({ y }) => y !== 0), name).toEqual([])
    }
  })

  it('joins the standing parts closed by themselves, breathing or not: nothing left for the assembler to close', () => {
    for (const id of ['stand.idle', 'stand.breath'] as const) expect(openCells(rawFrame(id)), id).toEqual([])
  })

  it('stands the head over the torso over the legs: head (4, 0), torso (7, 21), legs from row 34, feet on row 47', () => {
    expect([at('stand.idle', 'head'), at('stand.idle', 'torso'), at('stand.idle', 'legFront'), at('stand.idle', 'legBack')])
      .toEqual([{ x: 4, y: 0 }, { x: 7, y: 21 }, { x: 10, y: 34 }, { x: 16, y: 34 }])
    expect(frame('stand.idle')[47]).toMatch(/[^.]/)
  })

  it('breathes by sinking the head a row, the body below the collar unchanged', () => {
    expect(at('stand.breath', 'head')).toEqual({ x: 4, y: 1 })
    expect(frame('stand.breath')[0]).toBe('.'.repeat(32))
    expect(frame('stand.breath').slice(23)).toEqual(frame('stand.idle').slice(23))
  })

  it('blinks for 120 ms in every 3 s of the standing loop, which opens on the plain stance', () => {
    expect(ANIMS.stand.steps).toEqual([
      { pose: 'stand.idle', ms: 500 }, { pose: 'stand.breath', ms: 500 }, { pose: 'stand.idle', ms: 500 },
      { pose: 'stand.breath', ms: 500 }, { pose: 'stand.idle', ms: 500 }, { pose: 'stand.breath', ms: 380 },
      { pose: 'stand.blink', ms: 120 },
    ])
  })

  it('dresses the body: the hoodie J/j, the collar K, the shirt R, the drawstring Y, trousers F/f, shoes O/o', () => {
    const all = frame('stand.idle').join('')
    for (const k of 'JjKRYFfOo') expect(all, k).toContain(k)
  })

  it('leaves the mark slot (cols 28-30, rows 0-4) for the mood mark and the ! and ? glyphs', () => {
    for (let r = 0; r < 5; r++) expect(frame('stand.idle')[r].slice(28, 31)).toBe('...')
    expect(frame('stand.idle', 'tired').slice(0, 5).map((row) => row.slice(28, 31))).toEqual(['.W.', 'WAW', 'WAW', '.W.', '...'])
  })
})
