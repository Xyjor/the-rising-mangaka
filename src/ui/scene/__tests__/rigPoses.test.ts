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

describe('the walk (task 11)', () => {
  const WALK: PoseId[] = ['walk.contact-l', 'walk.down-l', 'walk.pass-l', 'walk.up-l', 'walk.contact-r', 'walk.down-r', 'walk.pass-r', 'walk.up-r']

  it('catalogues the walk\'s legs and arms', () => {
    // the step legs are 10 wide, not the plan's 8 (hipL (7, 0), not (5, 0)): 8 wide left the contact's shoe two
    // columns past the stance, which at 1x read as standing; 10 puts it four past, as 0.10's contact was past its idle
    expectCatalogue({
      'leg-l-step': [10, 14, { hipL: [7, 0] }], 'leg-l-step-bend': [10, 13, { hipL: [7, 0] }], 'leg-l-plant-bend': [6, 13, { hipL: [3, 0] }],
      'leg-l-lift': [6, 12, { hipL: [3, 0] }], 'leg-l-reach': [7, 12, { hipL: [4, 0] }],
      'leg-r-step': [10, 14, { hipR: [2, 0] }], 'leg-r-step-bend': [10, 13, { hipR: [2, 0] }], 'leg-r-plant-bend': [6, 13, { hipR: [2, 0] }],
      'leg-r-lift': [6, 12, { hipR: [2, 0] }], 'leg-r-reach': [7, 12, { hipR: [2, 0] }],
      'arm-l-swing-fwd': [6, 10, { shoulderL: [4, 0], hand: [2, 9] }], 'arm-l-swing-back': [5, 12, { shoulderL: [3, 0], hand: [1, 11] }],
      'arm-r-swing-fwd': [6, 10, { shoulderR: [1, 0], hand: [3, 9] }], 'arm-r-swing-back': [5, 12, { shoulderR: [1, 0], hand: [3, 11] }],
    })
  })

  it('walks in eight 75 ms steps: contact, down, pass, up, on each leg', () => {
    expect(ANIMS.walk.steps).toEqual(WALK.map((pose) => ({ pose, ms: 75 })))
  })

  it('bobs: the down steps carry the head and the torso a row lower', () => {
    expect(WALK.map((id) => at(id, 'torso')?.y)).toEqual([21, 22, 21, 21, 21, 22, 21, 21])
    expect(WALK.map((id) => at(id, 'head')?.y)).toEqual([0, 1, 0, 0, 0, 1, 0, 0])
  })

  it('swings the arm opposite the forward leg on the contact and down steps, both hanging on the pass and up steps', () => {
    const arms = (id: PoseId) => [part(id).armFront?.part, part(id).armBack?.part]
    const hang = ['arm-l-hang', 'arm-r-hang']
    const leftLeads = ['arm-l-swing-back', 'arm-r-swing-fwd']
    const rightLeads = ['arm-l-swing-fwd', 'arm-r-swing-back']
    expect(WALK.map(arms)).toEqual([leftLeads, leftLeads, hang, hang, rightLeads, rightLeads, hang, hang])
  })

  it('steps with the left leg on the first half and the right on the second, the halves mirroring each other\'s parts', () => {
    const legs = (id: PoseId) => [part(id).legFront?.part, part(id).legBack?.part]
    expect(WALK.map(legs)).toEqual([
      ['leg-l-step', 'leg-r-stand'], ['leg-l-step-bend', 'leg-r-plant-bend'], ['leg-l-stand', 'leg-r-lift'], ['leg-l-stand', 'leg-r-reach'],
      ['leg-l-stand', 'leg-r-step'], ['leg-l-plant-bend', 'leg-r-step-bend'], ['leg-l-lift', 'leg-r-stand'], ['leg-l-reach', 'leg-r-stand'],
    ])
  })

  it('keeps a foot on row 47 on every step, the passing foot lifted clear of it', () => {
    for (const id of WALK) expect(frame(id)[47], id).toMatch(/[^.]/)
    const bottom = (id: PoseId, layer: 'legFront' | 'legBack') => at(id, layer)!.y + PARTS[part(id)[layer]!.part].map.length - 1
    for (const [id, layer] of [['walk.pass-l', 'legBack'], ['walk.up-l', 'legBack'], ['walk.pass-r', 'legFront'], ['walk.up-r', 'legFront']] as const) {
      expect(bottom(id, layer), id).toBeLessThan(47)
    }
  })

  it('steps rather than slides: each contact step\'s shoe reaches past the standing stance on row 47', () => {
    const span = (id: PoseId) => {
      const row = frame(id)[47]
      return [row.search(/[^.]/), row.length - 1 - [...row].reverse().join('').search(/[^.]/)]
    }
    expect(span('walk.contact-l')[0]).toBeLessThan(span('stand.idle')[0])
    expect(span('walk.contact-r')[1]).toBeGreaterThan(span('stand.idle')[1])
  })

  it('strides four columns past the stance on each contact, and keeps the shoe planted through the down step', () => {
    const edge = (id: PoseId, side: 'left' | 'right') => {
      const row = frame(id)[47]
      return side === 'left' ? row.search(/[^.]/) : row.length - 1 - [...row].reverse().join('').search(/[^.]/)
    }
    expect(edge('stand.idle', 'left') - edge('walk.contact-l', 'left')).toBe(4)
    expect(edge('walk.contact-r', 'right') - edge('stand.idle', 'right')).toBe(4)
    expect(frame('walk.down-l').slice(45)).toEqual(frame('walk.contact-l').slice(45))
    expect(frame('walk.down-r').slice(45)).toEqual(frame('walk.contact-r').slice(45))
  })

  it('outlines each walk part all round but its top, and joins every step closed by itself', () => {
    const walkParts = Object.keys(PARTS).filter((name) => /-(step|step-bend|plant-bend|lift|reach|swing-fwd|swing-back)$/.test(name))
    expect(walkParts).toHaveLength(14)
    for (const name of walkParts) expect(openCells(PARTS[name].map).filter(({ y }) => y !== 0), name).toEqual([])
    for (const id of WALK) expect(openCells(rawFrame(id)), id).toEqual([])
  })
})
