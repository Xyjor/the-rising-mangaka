// The cast's pose families keep their contracts (0.11.0): written from each family's rules, not cell literals, so a
// redraw that keeps the rules passes. Pure data, node environment.
import { describe, expect, it } from 'vitest'
import { MANGAKA_SEAT } from '../actors'
import { placeLayers } from '../rig/assemble'
import { ANIMS } from '../rig/anims'
import type { AnimId } from '../rig/anims'
import { frontHand, rigFrame } from '../rig/frames'
import { EDITOR_EYES } from '../rig/head'
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
/** The first row holding hair (H): where the head's crown sits. */
const crown = (map: SpriteMap) => map.findIndex((row) => row.includes('H'))
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
    // the mangaka's walk parts (the editor's suit sleeves, 0.12.0 task 8, are checked with his walk)
    const walkParts = Object.keys(PARTS).filter((name) => /-(step|step-bend|plant-bend|lift|reach|swing-fwd|swing-back)$/.test(name) && !name.includes('-suit-'))
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
    expect(MANGAKA_SEAT.y + 40).toBe(98)
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

describe('the idle moments (task 15)', () => {
  it('catalogues the moments\' arms and props', () => {
    expectCatalogue({
      'arm-l-mug': [7, 9, { shoulderL: [2, 8], hand: [5, 1] }], 'arm-l-mug-half': [6, 6, { shoulderL: [2, 5], hand: [4, 1] }],
      mug: [5, 4, { hand: [0, 2] }],
      'arm-l-out': [8, 5, { shoulderL: [7, 1], hand: [1, 2] }], 'arm-r-out': [8, 5, { shoulderR: [0, 1], hand: [6, 2] }],
      'arm-l-up': [8, 10, { shoulderL: [7, 9], hand: [1, 0] }], 'arm-r-up': [8, 10, { shoulderR: [0, 9], hand: [6, 0] }],
      'arm-l-flip-a': [6, 11, { shoulderL: [2, 0], hand: [4, 10] }], 'arm-l-flip-b': [7, 9, { shoulderL: [5, 0], hand: [2, 6] }],
      'arm-l-flip-c': [9, 10, { shoulderL: [8, 0], hand: [1, 9] }], page: [5, 4, { hand: [2, 3] }],
      'arm-l-rub-a': [6, 14, { shoulderL: [2, 13], hand: [3, 1] }], 'arm-l-rub-b': [6, 13, { shoulderL: [2, 12], hand: [3, 1] }],
    })
  })

  it('times each moment', () => {
    const steps = (id: AnimId) => ANIMS[id].steps.map((s) => `${s.pose} ${s.ms}`)
    expect(steps('stand-look')).toEqual(['stand.look-l 500', 'stand.idle 150', 'stand.look-r 500', 'stand.idle 150'])
    expect(steps('stand-sip')).toEqual(['stand.sip-raise 200', 'stand.sip 700', 'stand.sip-raise 200'])
    expect(steps('seat-sip')).toEqual(['seat.sip-raise 200', 'seat.sip 700', 'seat.sip-raise 200'])
    expect(steps('seat-stretch')).toEqual(['seat.stretch-a 250', 'seat.stretch-b 700', 'seat.stretch-a 250'])
    expect(steps('seat-flip')).toEqual(['seat.flip-a 200', 'seat.flip-b 200', 'seat.flip-c 200'])
    expect(steps('seat-rub')).toEqual(['seat.rub-a 250', 'seat.rub-b 250', 'seat.rub-a 250', 'seat.rub-b 250'])
  })

  it('sips with the mug over the mouth and the eyes closed, raising it from under the chin', () => {
    // the mouth slot: the head's cols 10-13, rows 15-16, at the head's place in the frame
    const overlaps = (id: PoseId) => {
      const head = at(id, 'head')!
      const mug = at(id, 'prop')!
      return mug.x <= head.x + 13 && mug.x + 4 >= head.x + 10 && mug.y <= head.y + 16 && mug.y + 3 >= head.y + 15
    }
    expect([overlaps('stand.sip'), overlaps('seat.sip')]).toEqual([true, true])
    expect([overlaps('stand.sip-raise'), overlaps('seat.sip-raise')]).toEqual([false, false])
    expect([part('stand.sip').face, part('seat.sip').face]).toEqual([{ eyes: 'closed' }, { eyes: 'closed' }])
  })

  it('stretches with the arms out, then up beside the head with the eyes closed, the fists outside the head', () => {
    expect([part('seat.stretch-a').armFront?.part, part('seat.stretch-a').armBack?.part]).toEqual(['arm-l-out', 'arm-r-out'])
    expect(part('seat.stretch-b').face).toEqual({ eyes: 'closed' })
    const hands = (id: PoseId) => [at(id, 'armFront')!.x + PARTS['arm-l-up'].anchors.hand!.x, at(id, 'armBack')!.x + PARTS['arm-r-up'].anchors.hand!.x]
    const [left, right] = hands('seat.stretch-b')
    expect(left).toBeLessThan(at('seat.stretch-b', 'head')!.x)
    expect(right).toBeGreaterThan(at('seat.stretch-b', 'head')!.x + 23)
  })

  it('flips a page from right to left', () => {
    expect((['seat.flip-a', 'seat.flip-b', 'seat.flip-c'] as const).map((id) => at(id, 'prop')?.x)).toEqual([9, 4, 0])
  })

  it('rubs the left eye when tired, squinting', () => {
    for (const id of ['seat.rub-a', 'seat.rub-b'] as const) {
      const head = at(id, 'head')!
      const arm = at(id, 'armFront')!
      const hand = { x: arm.x + PARTS[part(id).armFront!.part].anchors.hand!.x, y: arm.y + PARTS[part(id).armFront!.part].anchors.hand!.y }
      // inside the eye slot's left half: head cols 4-11, rows 10-13
      expect(hand.x >= head.x + 4 && hand.x <= head.x + 11 && hand.y >= head.y + 10 && hand.y <= head.y + 13, id).toBe(true)
      expect(part(id).face).toEqual({ eyes: 'squint' })
    }
  })

  it('looks around: the head a column left, then right', () => {
    expect([at('stand.look-l', 'head'), at('stand.look-r', 'head')]).toEqual([{ x: 3, y: 0 }, { x: 5, y: 0 }])
  })

  it('outlines each moment arm all round but where it joins the shoulder, the mug and the page all round', () => {
    // the assembler outlines only against clear cells, so a fist or a sleeve drawn over the face (skin beside skin)
    // must carry its own outline; only the join, within two cells of the shoulder anchor, meets the torso open
    const arms = ['arm-l-mug', 'arm-l-mug-half', 'arm-l-out', 'arm-r-out', 'arm-l-up', 'arm-r-up',
      'arm-l-flip-a', 'arm-l-flip-b', 'arm-l-flip-c', 'arm-l-rub-a', 'arm-l-rub-b']
    for (const name of arms) {
      const s = (PARTS[name].anchors.shoulderL ?? PARTS[name].anchors.shoulderR)!
      expect(openCells(PARTS[name].map).filter(({ x, y }) => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) > 2), name).toEqual([])
    }
    for (const name of ['mug', 'page']) expect(openCells(PARTS[name].map), name).toEqual([])
  })

  it('joins every moment with a near arm moved closed by itself', () => {
    // not the glances (the shifted chin bares a collar tip) nor the raised stretch, whose far arm leaves the far
    // shoulder cap's underside open under the torso: the assembler closes those
    for (const id of ['stand.sip-raise', 'stand.sip', 'seat.sip-raise', 'seat.sip', 'seat.stretch-a',
      'seat.flip-a', 'seat.flip-b', 'seat.flip-c', 'seat.rub-a', 'seat.rub-b'] as const) {
      expect(openCells(rawFrame(id)), id).toEqual([])
    }
  })

  it('keeps every seated moment\'s arms, mug and page above the desk top (frame row 40), where the scene draws them over the stack', () => {
    const seated: PoseId[] = ['seat.sip-raise', 'seat.sip', 'seat.stretch-a', 'seat.stretch-b', 'seat.flip-a', 'seat.flip-b', 'seat.flip-c', 'seat.rub-a', 'seat.rub-b']
    for (const id of seated) {
      for (const layer of ['armFront', 'armBack', 'prop'] as const) {
        const place = part(id)[layer]
        if (place) expect(at(id, layer)!.y + PARTS[place.part].map.length - 1, `${id} ${layer}`).toBeLessThanOrEqual(39)
      }
    }
  })
})

describe('the reactions (task 16)', () => {
  const s = (id: AnimId) => ANIMS[id].steps.map((x) => `${x.pose} ${x.ms}`)

  it('times each reaction, and opens the late loop on the panic so reduced motion still shows it', () => {
    expect(s('stand-cheer')).toEqual(['key.cheer-stand-0 200', 'key.cheer-stand-1 200', 'key.cheer-stand-0 200', 'key.cheer-stand-1 200', 'key.cheer-stand-0 400'])
    expect(s('seat-cheer')).toEqual(['key.cheer-seat-0 200', 'key.cheer-seat-1 200', 'key.cheer-seat-0 200', 'key.cheer-seat-1 200', 'key.cheer-seat-0 400'])
    expect(s('stand-slump')).toEqual(['key.slump-stand-0 800', 'key.slump-stand-1 800'])
    expect(s('seat-slump')).toEqual(['key.slump-seat-0 800', 'key.slump-seat-1 800'])
    expect(s('seat-panic')).toEqual(['key.panic-0 160', 'key.panic-1 160', 'key.panic-0 160', 'key.panic-1 160'])
    expect(s('seat-tear')).toEqual(['key.tear-0 250', 'key.tear-1 200', 'key.tear-2 300', 'key.tear-1 200', 'key.tear-2 300'])
    expect(ANIMS['seat-draw-late'].steps.slice(0, 4)).toEqual(ANIMS['seat-panic'].steps)
  })

  it('cheers with both hands above the head, standing and seated', () => {
    for (const id of ['key.cheer-stand-0', 'key.cheer-stand-1', 'key.cheer-seat-0', 'key.cheer-seat-1'] as const) {
      const m = key(id)
      expect(m.slice(0, 6).join(''), id).toContain('S')
      const hands = m.slice(0, 6).map((row) => [row.slice(0, 16).includes('S'), row.slice(16).includes('S')])
      expect(hands.some(([l]) => l) && hands.some(([, r]) => r), id).toBe(true)
    }
    expect(crown(key('key.cheer-stand-0'))).toBeGreaterThan(crown(frame('stand.idle')) + 2)
    expect(crown(key('key.cheer-seat-0'))).toBeGreaterThanOrEqual(crown(frame('seat.rest')))
  })

  it('slumps lower than its posture, the eyes shut', () => {
    for (const id of ['key.slump-stand-0', 'key.slump-stand-1'] as const) expect(crown(key(id)), id).toBeGreaterThan(crown(frame('stand.idle')) + 2)
    for (const id of ['key.slump-seat-0', 'key.slump-seat-1'] as const) expect(crown(key(id)), id).toBeGreaterThanOrEqual(crown(frame('seat.rest')) + 3)
    for (const id of ['key.slump-stand-0', 'key.slump-stand-1', 'key.slump-seat-0', 'key.slump-seat-1'] as const) expect(key(id).join(''), id).not.toContain('E')
  })

  it('panics with a hand on each side of the head\'s top, the eyes wide', () => {
    for (const id of ['key.panic-0', 'key.panic-1'] as const) {
      const m = key(id)
      const top = crown(m)
      const band = m.slice(Math.max(0, top - 2), top + 4)
      expect(band.some((row) => row.slice(0, 16).includes('S')) && band.some((row) => row.slice(16).includes('S')), id).toBe(true)
      expect(m.join(''), id).toContain('E')
    }
  })

  it('tears a page at the chest: whole, then in two halves apart', () => {
    const runs = (row: string) => row.match(/[Ww]{2,}/g) ?? []
    const chest = (id: PoseId) => key(id).slice(24, 41)
    expect(chest('key.tear-0').some((row) => runs(row).some((r) => r.length >= 6))).toBe(true)
    expect(chest('key.tear-2').some((row) => runs(row).length >= 2)).toBe(true)
  })
})

describe('the doze (task 18)', () => {
  it('dozes at the desk, 900 ms a breath', () => {
    expect(ANIMS.doze.steps).toEqual([{ pose: 'key.doze-0', ms: 900 }, { pose: 'key.doze-1', ms: 900 }])
  })

  it('lays the head on the folded arms: the crown at row 16 or below, the eyes shut, the sleeves across rows 33-39', () => {
    for (const id of ['key.doze-0', 'key.doze-1'] as const) {
      const m = key(id)
      expect(crown(m), id).toBeGreaterThanOrEqual(16)
      expect(m.join(''), id).not.toContain('E')
      expect(m.slice(33, 40).join(''), id).toContain('j')
    }
  })

  it('leaves the Z\'s cells clear above the head (cols 25-27, rows 11-15)', () => {
    for (const id of ['key.doze-0', 'key.doze-1'] as const) {
      for (let r = 11; r <= 15; r++) expect(key(id)[r].slice(25, 28), `${id} row ${r}`).toBe('...')
    }
  })
})

describe('the editor\'s suit and standing loop (0.12.0, task 4)', () => {
  it('catalogues the suit torso, the hanging sleeve and the case sleeve', () => {
    expectCatalogue({
      'editor-torso': [18, 14, { neck: [9, 0], shoulderL: [2, 2], shoulderR: [15, 2], hipL: [6, 13], hipR: [11, 13] }],
      'arm-l-suit-hang': [5, 12, { shoulderL: [3, 0], hand: [2, 10] }],
      'arm-r-suit-case': [7, 19, { shoulderR: [1, 0], hand: [2, 10] }],
    })
  })

  it('stands the editor as the mangaka stands: the head (4, 0), the torso (7, 21), the legs from row 34, the feet on row 47, the front hand at (8, 33)', () => {
    expect([at('editor.stand', 'head'), at('editor.stand', 'torso'), at('editor.stand', 'legFront'), at('editor.stand', 'legBack'), at('editor.stand', 'armBack')])
      .toEqual([{ x: 4, y: 0 }, { x: 7, y: 21 }, { x: 10, y: 34 }, { x: 16, y: 34 }, { x: 21, y: 23 }])
    expect(frontHand('editor.stand')).toEqual({ x: 8, y: 33 })
    expect(frame('editor.stand')[47]).toMatch(/[^.]/)
    expect(part('editor.stand').head.part).toBe('editor-head')
    expect([part('editor.stand').legFront?.part, part('editor.stand').legBack?.part]).toEqual(['leg-l-stand', 'leg-r-stand'])
  })

  it('dresses the editor: the suit G/g, the collar W, the tie N down col 9 of the torso, the case D/d; none of the mangaka\'s keys', () => {
    const torso = PARTS['editor-torso'].map
    for (let r = 3; r <= 11; r++) expect(torso[r][9], `torso row ${r}`).toBe('N')
    expect(torso[0].slice(3, 15)).toMatch(/^WWs+WW$/)
    for (const name of ['editor-torso', 'arm-l-suit-hang', 'arm-r-suit-case']) {
      expect(PARTS[name].map.join(''), name).toMatch(/G/)
      expect(PARTS[name].map.join(''), name).not.toMatch(/[JjKRYyFfOo]/)
    }
    const all = frame('editor.stand').join('')
    for (const k of 'GgWNDdSs') expect(all, k).toContain(k)
  })

  it('hangs the 6x7 briefcase under the far fist: an L box of D/d at the sleeve\'s cols 1-6, rows 11-18, in the frame at cols 22-27', () => {
    const box = PARTS['arm-r-suit-case'].map.slice(11, 19).map((row) => row.slice(1, 7))
    expect(box[0]).toBe('LLLLLL')
    expect(box[7]).toBe('LLLLLL')
    for (const row of box.slice(1, 6)) expect(row).toMatch(/^L[Dd]{4}L$/)
    expect(box[6]).toMatch(/^Ld{4}L$/)
    // in the frame the case sits at cols 22-27, rows 34-41, right of the far leg's shoe (to col 21); col 31 stays clear
    const m = frame('editor.stand')
    for (let r = 34; r <= 41; r++) expect(m[r].slice(22, 28), `row ${r}`).toMatch(/^L[LDd]{4}L$/)
    for (let r = 0; r < 48; r++) expect(m[r][31], `row ${r} col 31`).toBe('.')
  })

  it('breathes and blinks on the mangaka\'s timing, the blink behind the lenses', () => {
    expect(ANIMS['editor-stand'].steps).toEqual([
      { pose: 'editor.stand', ms: 500 }, { pose: 'editor.breath', ms: 500 }, { pose: 'editor.stand', ms: 500 },
      { pose: 'editor.breath', ms: 500 }, { pose: 'editor.stand', ms: 500 }, { pose: 'editor.breath', ms: 380 },
      { pose: 'editor.blink', ms: 120 },
    ])
    expect(at('editor.breath', 'head')).toEqual({ x: 4, y: 1 })
    expect(frame('editor.breath').slice(23)).toEqual(frame('editor.stand').slice(23))
    expect(frame('editor.blink').slice(10, 14).map((row) => row.slice(8, 24))).toEqual(EDITOR_EYES.blink)
    expect(frame('editor.stand').slice(10, 14).map((row) => row.slice(8, 24))).toEqual(EDITOR_EYES.open)
  })

  it('names the editor\'s neutral frame by its pose and face, the mark slot (cols 28-30, rows 0-4) clear', () => {
    expect(rigFrame('editor.stand', 'neutral', false).id).toBe('editor.stand~open.closed.none')
    for (let r = 0; r < 5; r++) expect(frame('editor.stand')[r].slice(28, 31)).toBe('...')
  })
})

describe('the editor\'s walk and his turns (0.12.0, task 8)', () => {
  const WALK: PoseId[] = [
    'editor.walk-contact-l', 'editor.walk-down-l', 'editor.walk-pass-l', 'editor.walk-up-l',
    'editor.walk-contact-r', 'editor.walk-down-r', 'editor.walk-pass-r', 'editor.walk-up-r',
  ]
  const MANGAKA: PoseId[] = ['walk.contact-l', 'walk.down-l', 'walk.pass-l', 'walk.up-l', 'walk.contact-r', 'walk.down-r', 'walk.pass-r', 'walk.up-r']
  const CASE_ARMS = ['arm-r-suit-case', 'arm-r-suit-case-fwd', 'arm-r-suit-case-back']

  it('catalogues the suit\'s swinging sleeves and the case sleeves', () => {
    expectCatalogue({
      'arm-l-suit-swing-fwd': [6, 10, { shoulderL: [4, 0], hand: [2, 9] }], 'arm-l-suit-swing-back': [5, 12, { shoulderL: [3, 0], hand: [1, 11] }],
      'arm-r-suit-case-fwd': [8, 18, { shoulderR: [1, 0], hand: [3, 9] }], 'arm-r-suit-case-back': [6, 20, { shoulderR: [1, 0], hand: [3, 11] }],
    })
  })

  it('walks in eight 75 ms steps on the mangaka\'s legs with his bob, the suit torso throughout', () => {
    expect(ANIMS['editor-walk'].steps).toEqual(WALK.map((pose) => ({ pose, ms: 75 })))
    WALK.forEach((id, i) => {
      const e = part(id)
      const m = part(MANGAKA[i])
      expect([e.legFront?.part, e.legBack?.part], id).toEqual([m.legFront?.part, m.legBack?.part])
      expect([e.torso.part, e.torso.y, at(id, 'head')?.y], id).toEqual(['editor-torso', m.torso.y, at(MANGAKA[i], 'head')?.y])
    })
  })

  it('swings the sleeves against the legs, the case with the far hand: forward on the left contact, back on the right', () => {
    const arms = (id: PoseId) => [part(id).armFront?.part, part(id).armBack?.part]
    const hang = ['arm-l-suit-hang', 'arm-r-suit-case']
    const leftLeads = ['arm-l-suit-swing-back', 'arm-r-suit-case-fwd']
    const rightLeads = ['arm-l-suit-swing-fwd', 'arm-r-suit-case-back']
    expect(WALK.map(arms)).toEqual([leftLeads, leftLeads, hang, hang, rightLeads, rightLeads, hang, hang])
  })

  it('keeps the case under the far fist in every case sleeve: a 6x8 L box of D/d from the row under the fist', () => {
    for (const name of CASE_ARMS) {
      const p = PARTS[name]
      const hand = p.anchors.hand!
      const rows = p.map.slice(hand.y + 1, hand.y + 9)
      const col = rows[0].indexOf('LLLLLL')
      expect(col, name).toBeGreaterThanOrEqual(0)
      const box = rows.map((row) => row.slice(col, col + 6))
      expect([box[0], box[7]], name).toEqual(['LLLLLL', 'LLLLLL'])
      for (const row of box.slice(1, 6)) expect(row, name).toMatch(/^L[Dd]{4}L$/)
      expect(box[6], name).toMatch(/^Ld{4}L$/)
      expect(p.map.join(''), name).not.toMatch(/[JjKRYyFfOo]/)
    }
  })

  it('keeps a foot on row 47 on every step, the passing foot lifted, and every editor frame clear of col 31', () => {
    for (const id of WALK) expect(frame(id)[47], id).toMatch(/[^.]/)
    const bottom = (id: PoseId, layer: 'legFront' | 'legBack') => at(id, layer)!.y + PARTS[part(id)[layer]!.part].map.length - 1
    for (const [id, layer] of [['editor.walk-pass-l', 'legBack'], ['editor.walk-up-l', 'legBack'], ['editor.walk-pass-r', 'legFront'], ['editor.walk-up-r', 'legFront']] as const) {
      expect(bottom(id, layer), id).toBeLessThan(47)
    }
    for (const [id, def] of Object.entries(POSES) as [PoseId, { pose: { kind: string } }][]) {
      if (!id.startsWith('editor.') || def.pose.kind !== 'parts') continue
      for (let r = 0; r < 48; r++) expect(frame(id)[r][31], `${id} row ${r}`).toBe('.')
    }
  })

  it('outlines each suit sleeve all round but its top, and joins every walk step closed by itself', () => {
    for (const name of ['arm-l-suit-swing-fwd', 'arm-l-suit-swing-back', ...CASE_ARMS]) {
      expect(openCells(PARTS[name].map).filter(({ y }) => y !== 0), name).toEqual([])
    }
    for (const id of WALK) expect(openCells(rawFrame(id)), id).toEqual([])
  })

  it('turns at the spot in 160 ms: the head toward the desk arriving, toward the door leaving, both feet planted', () => {
    expect(ANIMS['editor-arrive'].steps).toEqual([{ pose: 'editor.turn', ms: 160 }])
    expect(ANIMS['editor-leave'].steps).toEqual([{ pose: 'editor.turn-back', ms: 160 }])
    expect([at('editor.turn', 'head'), at('editor.turn-back', 'head')]).toEqual([{ x: 3, y: 0 }, { x: 5, y: 0 }])
    for (const id of ['editor.turn', 'editor.turn-back'] as const) {
      expect([part(id).legFront?.part, part(id).legBack?.part], id).toEqual(['leg-l-stand', 'leg-r-stand'])
      expect(frame(id)[47], id).toMatch(/[^.]/)
    }
    expect([part('editor.turn').armFront?.part, part('editor.turn-back').armFront?.part]).toEqual(['arm-l-suit-swing-back', 'arm-l-suit-swing-fwd'])
  })
})

describe('the editor\'s waiting moments (0.12.0, task 9)', () => {
  it('catalogues the raised, glasses and watch sleeves', () => {
    expectCatalogue({
      'arm-l-suit-raise': [6, 9, { shoulderL: [2, 4], hand: [4, 1] }],
      'arm-l-suit-glasses': [6, 14, { shoulderL: [2, 13], hand: [3, 1] }],
      'arm-l-suit-watch': [7, 9, { shoulderL: [5, 0], hand: [2, 7] }],
    })
  })

  it('times the moments: the glasses pushed up 900 ms, the watch checked 1100 ms, a glance at the pile 700 ms', () => {
    expect(ANIMS['editor-glasses'].steps).toEqual([{ pose: 'editor.raise', ms: 200 }, { pose: 'editor.glasses', ms: 500 }, { pose: 'editor.raise', ms: 200 }])
    expect(ANIMS['editor-watch'].steps).toEqual([{ pose: 'editor.raise', ms: 200 }, { pose: 'editor.watch', ms: 700 }, { pose: 'editor.raise', ms: 200 }])
    expect(ANIMS['editor-glance'].steps).toEqual([{ pose: 'editor.glance', ms: 700 }])
  })

  it('raises the near hand to the chin, then to the left lens\'s rim with the eyes blinking behind it', () => {
    expect([at('editor.raise', 'armFront'), frontHand('editor.raise')]).toEqual([{ x: 7, y: 19 }, { x: 11, y: 20 }])
    expect([at('editor.glasses', 'armFront'), frontHand('editor.glasses')]).toEqual([{ x: 7, y: 10 }, { x: 10, y: 11 }])
    expect(part('editor.glasses').face).toEqual({ eyes: 'blink' })
    // the fist, not the lens (ruling D1: the lens interior is S, so an S over the lens's columns proves nothing): an S
    // where the hand's anchor lands, the fist's cells over the left lens's outer rim (frame col 8, rows 11-12), where
    // the bare head has the rim L, and the fist's top outline across the lens on row 10 (cols 8-11), where it has skin
    const m = frame('editor.glasses')
    const bare = frame('editor.blink')
    expect(m[11][10]).toBe('S')
    expect([bare[11][8], bare[12][8]]).toEqual(['L', 'L'])
    expect([m[11][8], m[12][8]]).toEqual(['S', 'S'])
    expect(bare[10].slice(9, 12)).toBe('SSS')
    expect(m[10].slice(8, 12)).toBe('LLLL')
  })

  it('checks the watch with the head bowed, the watch face on the wrist', () => {
    expect([at('editor.watch', 'armFront'), frontHand('editor.watch'), at('editor.watch', 'head')]).toEqual([{ x: 4, y: 23 }, { x: 6, y: 30 }, { x: 4, y: 1 }])
    expect(PARTS['arm-l-suit-watch'].map.join('')).toContain('W')
    // the gaze goes down to the wrist (task 10): the heavy lid over the low pupils, the squint (closed read as asleep)
    expect(part('editor.watch').face).toEqual({ eyes: 'squint' })
    expect(rigFrame('editor.watch', 'neutral', false).id).toBe('editor.watch~squint.closed.none')
  })

  it('glances toward the manuscript pile: the head a column toward the desk, the body unchanged', () => {
    expect(at('editor.glance', 'head')).toEqual({ x: 3, y: 0 })
    expect(frame('editor.glance').slice(23)).toEqual(frame('editor.stand').slice(23))
  })

  it('keeps the suit keys and the case through every moment', () => {
    for (const id of ['editor.raise', 'editor.glasses', 'editor.watch', 'editor.glance'] as const) {
      expect(part(id).armBack?.part, id).toBe('arm-r-suit-case')
      expect(frame(id).join(''), id).not.toMatch(/[JjKRYy]/)
    }
  })
})

describe('the editor\'s verdicts (0.12.0, task 10)', () => {
  it('nods twice in 800 ms and sighs for 1200 ms', () => {
    expect(ANIMS['editor-nod'].steps).toEqual([
      { pose: 'editor.nod', ms: 200 }, { pose: 'editor.stand', ms: 150 }, { pose: 'editor.nod', ms: 200 }, { pose: 'editor.stand', ms: 250 },
    ])
    expect(ANIMS['editor-sigh'].steps).toEqual([{ pose: 'editor.sigh-a', ms: 300 }, { pose: 'editor.sigh-b', ms: 900 }])
  })

  it('nods with the head two rows lower into the collar, the body unchanged, the eyes open', () => {
    expect(at('editor.nod', 'head')).toEqual({ x: 4, y: 2 })
    expect(crown(frame('editor.nod'))).toBe(crown(frame('editor.stand')) + 2)
    expect(frame('editor.nod').slice(24)).toEqual(frame('editor.stand').slice(24))
    expect(part('editor.nod').face).toBeUndefined()
    // the head nods, the hand (and the prop in it) stays where it stands
    expect(frontHand('editor.nod')).toEqual({ x: 8, y: 33 })
  })

  it('sighs with the shoulders dropping a row then two, the feet still on row 47, the eyes closed and the mouth down', () => {
    expect([at('editor.sigh-a', 'torso'), at('editor.sigh-b', 'torso')]).toEqual([{ x: 7, y: 22 }, { x: 7, y: 23 }])
    expect([at('editor.sigh-a', 'head'), at('editor.sigh-b', 'head')]).toEqual([{ x: 4, y: 1 }, { x: 4, y: 2 }])
    for (const id of ['editor.sigh-a', 'editor.sigh-b'] as const) {
      expect(at(id, 'legFront'), id).toEqual({ x: 10, y: 34 })
      expect(at(id, 'legBack'), id).toEqual({ x: 16, y: 34 })
      expect(frame(id)[47], id).toMatch(/[^.]/)
      expect(part(id).face, id).toEqual({ eyes: 'closed', mouth: 'frown' })
      expect(frame(id).join(''), id).not.toContain('E')
    }
    expect(rigFrame('editor.sigh-b', 'neutral', false).id).toBe('editor.sigh-b~closed.frown.none')
    // the hand, and so the prop, drops with the shoulders: a row, then two
    expect([frontHand('editor.sigh-a'), frontHand('editor.sigh-b')]).toEqual([{ x: 8, y: 34 }, { x: 8, y: 35 }])
  })
})
