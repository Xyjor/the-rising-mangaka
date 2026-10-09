// The cast's pose families keep their contracts (0.11.0): written from each family's rules, not cell literals, so a
// redraw that keeps the rules passes. Pure data, node environment.
import { describe, expect, it } from 'vitest'
import { RIG_SPOTS } from '../actors'
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
const key = (id: PoseId): SpriteMap => {
  const p = POSES[id].pose
  if (p.kind !== 'key') throw new Error(`${id} is built from parts`)
  return p.map
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

describe('the desk (task 12)', () => {
  it('catalogues the seated legs, the desk arms and the pen', () => {
    expectCatalogue({
      'leg-l-seat': [6, 8, { hipL: [3, 0] }], 'leg-r-seat': [6, 8, { hipR: [2, 0] }],
      'arm-l-desk-a': [10, 11, { shoulderL: [8, 0], hand: [1, 9] }], 'arm-l-desk-b': [9, 11, { shoulderL: [7, 0], hand: [2, 10] }],
      'arm-l-desk-c': [8, 11, { shoulderL: [6, 0], hand: [3, 10] }], 'arm-l-rest': [8, 11, { shoulderL: [6, 0], hand: [2, 10] }],
      'arm-r-desk': [7, 11, { shoulderR: [1, 0], hand: [3, 10] }], pen: [2, 6, { hand: [1, 5] }],
    })
  })

  it('seats the head at rows 6-27 and the hips on row 40, the desk top\'s line at the seat', () => {
    expect([at('seat.rest', 'head'), at('seat.rest', 'torso'), at('seat.rest', 'legFront')]).toEqual([{ x: 4, y: 6 }, { x: 7, y: 27 }, { x: 10, y: 40 }])
    expect(RIG_SPOTS.mangaka.seat.y + 40).toBe(98)
    expect(frame('seat.rest')[47]).toMatch(/[^.]/)
  })

  it('moves the pen across the page and back: left, middle, right, middle, 150 ms each', () => {
    expect(ANIMS['seat-draw'].steps).toEqual([
      { pose: 'seat.draw-a', ms: 150 }, { pose: 'seat.draw-b', ms: 150 }, { pose: 'seat.draw-c', ms: 150 }, { pose: 'seat.draw-b', ms: 150 },
    ])
    expect((['seat.draw-a', 'seat.draw-b', 'seat.draw-c'] as const).map((id) => at(id, 'prop')?.x)).toEqual([1, 3, 5])
  })

  it('rests both forearms on the desk when not drawing, breathing, blinking once in 2 s', () => {
    expect(ANIMS['seat-idle'].steps).toEqual([
      { pose: 'seat.rest', ms: 500 }, { pose: 'seat.breath', ms: 500 }, { pose: 'seat.rest', ms: 500 },
      { pose: 'seat.breath', ms: 380 }, { pose: 'seat.blink', ms: 120 },
    ])
    expect(at('seat.breath', 'head')).toEqual({ x: 4, y: 7 })
  })

  it('runs late: four 160 ms panic steps, then five drawing cycles (3640 ms, the panic as often as 0.10\'s 40 frames in 240)', () => {
    const s = ANIMS['seat-draw-late'].steps
    expect(s.slice(0, 4).map((x) => x.ms)).toEqual([160, 160, 160, 160])
    expect(s.slice(4)).toEqual(Array.from({ length: 5 }, () => ANIMS['seat-draw'].steps).flat())
  })

  it('lays every hand on the desk top: both arms end on row 39, over the desk\'s line, in every seated pose', () => {
    for (const id of ['seat.rest', 'seat.breath', 'seat.blink', 'seat.draw-a', 'seat.draw-b', 'seat.draw-c'] as const) {
      for (const layer of ['armFront', 'armBack'] as const) {
        expect(at(id, layer)!.y + PARTS[part(id)[layer]!.part].map.length - 1, `${id} ${layer}`).toBe(39)
      }
    }
  })

  it('outlines each seated leg and desk arm all round but its top, and joins every seated pose closed by itself but the pen\'s nib', () => {
    for (const name of ['leg-l-seat', 'leg-r-seat', 'arm-l-desk-a', 'arm-l-desk-b', 'arm-l-desk-c', 'arm-l-rest', 'arm-r-desk']) {
      expect(openCells(PARTS[name].map).filter(({ y }) => y !== 0), name).toEqual([])
    }
    for (const id of ['seat.rest', 'seat.breath', 'seat.blink'] as const) expect(openCells(rawFrame(id)), id).toEqual([])
    // the pen is a line one cell wide, all outline but its steel nib, which lands on the hand at the silhouette's edge
    // (the outline the assembler closes there)
    const hand = PARTS.pen.anchors.hand!
    expect(openCells(PARTS.pen.map)).toEqual([hand])
    for (const id of ['seat.draw-a', 'seat.draw-b', 'seat.draw-c'] as const) {
      const pen = at(id, 'prop')!
      expect(openCells(rawFrame(id)), id).toEqual([{ x: pen.x + hand.x, y: pen.y + hand.y }])
    }
  })

  it('leaves the seated mark slot (cols 28-30, rows 6-10) clear for the mood mark', () => {
    for (const id of ['seat.rest', 'seat.draw-a', 'seat.draw-b', 'seat.draw-c'] as const) {
      for (let r = 6; r <= 10; r++) expect(frame(id)[r].slice(28, 31), `${id} row ${r}`).toBe('...')
    }
  })
})

describe('the bed and the ready stance (task 13)', () => {
  it('draws the bed\'s three key frames 48x32, drawn at the bed', () => {
    for (const id of ['bed.lie-0', 'bed.lie-1', 'bed.sit'] as const) {
      expect(POSES[id].at).toBe('bed')
      expect([key(id)[0].length, key(id).length], id).toEqual([48, 32])
    }
  })

  it('lays the head on the pillow, eyes shut: the crown on row 8, no open eye, the head in cols 23-46', () => {
    for (const id of ['bed.lie-0', 'bed.lie-1'] as const) {
      const m = key(id)
      expect(m.findIndex((row) => /[^.]/.test(row)), id).toBe(8)
      expect(m.join(''), id).not.toContain('E')
      for (let r = 8; r < 22; r++) expect(m[r].slice(0, 23), `${id} row ${r}`).toMatch(/^\.*$/)
    }
    expect(key('bed.lie-1')).not.toEqual(key('bed.lie-0'))
    expect(key('bed.lie-1').slice(0, 22)).toEqual(key('bed.lie-0').slice(0, 22))
  })

  it('breathes in bed, 900 ms a frame', () => {
    expect(ANIMS.sleep.steps).toEqual([{ pose: 'bed.lie-0', ms: 900 }, { pose: 'bed.lie-1', ms: 900 }])
  })

  it('sits up in bed, the head on rows 0-21', () => {
    expect(key('bed.sit').findIndex((row) => /[^.]/.test(row))).toBe(0)
    expect(key('bed.sit').join('')).toContain('E')
  })

  it('catalogues the ready stance\'s arm and the manuscript, held at the chest', () => {
    expectCatalogue({ 'arm-l-hold': [7, 9, { shoulderL: [5, 0], hand: [2, 7] }], manuscript: [8, 10, { hand: [6, 6] }] })
    expect(at('ready.idle', 'prop')).toEqual({ x: 0, y: 24 })
    const all = frame('ready.idle', 'neutral', true).join('')
    expect(all).toContain('W')
    expect(all).toContain('w')
  })

  it('breathes and blinks in the ready stance as standing does, the mark slot clear for the !', () => {
    expect(ANIMS['stand-ready'].steps).toEqual([
      { pose: 'ready.idle', ms: 500 }, { pose: 'ready.breath', ms: 500 }, { pose: 'ready.idle', ms: 500 },
      { pose: 'ready.breath', ms: 380 }, { pose: 'ready.blink', ms: 120 },
    ])
    for (let r = 0; r < 5; r++) expect(frame('ready.idle', 'tired', true)[r].slice(28, 31)).toBe('...')
  })
})

describe('the transitions (task 14)', () => {
  it('catalogues the half-sitting legs', () => {
    expectCatalogue({ 'leg-l-half': [6, 11, { hipL: [3, 0] }], 'leg-r-half': [6, 11, { hipR: [2, 0] }] })
  })

  it('halves the way down at the seat: the head at row 3, between standing (0) and seated (6), the hips on row 37', () => {
    expect(POSES['seat.half'].at).toBe('seat')
    expect([at('seat.half', 'head'), at('seat.half', 'torso')]).toEqual([{ x: 4, y: 3 }, { x: 7, y: 24 }])
    expect(frame('seat.half')[47]).toMatch(/[^.]/)
  })

  it('sits down through the half pose in 140 ms and stands up through it in 80 ms, lies down and gets up through sitting up in bed in 220 ms', () => {
    // standing up, the actor already walks (decision 1), so the walk shows where it has got to when the half pose ends:
    // at 140 ms that was 8 px from the seat in the scene (four 24 fps frames held, then the jump), at 80 ms 5 (two held)
    expect([ANIMS['sit-down'].steps, ANIMS['stand-up'].steps]).toEqual([[{ pose: 'seat.half', ms: 140 }], [{ pose: 'seat.half', ms: 80 }]])
    expect([ANIMS['lie-down'].steps, ANIMS['get-up'].steps]).toEqual([[{ pose: 'bed.sit', ms: 220 }], [{ pose: 'bed.sit', ms: 220 }]])
  })

  it('outlines each half-sitting leg all round but its top, and joins the half pose closed by itself', () => {
    for (const name of ['leg-l-half', 'leg-r-half']) expect(openCells(PARTS[name].map).filter(({ y }) => y !== 0), name).toEqual([])
    expect(openCells(rawFrame('seat.half'))).toEqual([])
  })
})
