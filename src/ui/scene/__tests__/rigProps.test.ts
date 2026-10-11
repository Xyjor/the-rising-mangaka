// The visit's props (0.12.0): the four small cast frames the editor holds in the front hand. Pure data, node environment.
import { describe, expect, it } from 'vitest'
import { partRules } from '../rig/assemble'
import { VISIT_PROPS } from '../rig/props'
import type { VisitPropId } from '../rig/props'
import { frameRules } from '../spriteCore'

const IDS: VisitPropId[] = ['envelope', 'letter', 'contract', 'trophy']
const SIZES: Record<VisitPropId, [number, number]> = { envelope: [6, 4], letter: [5, 6], contract: [5, 7], trophy: [5, 6] }

describe('the visit props', () => {
  it('draws each prop at its size in PAL keys with a closed outline and a painted hand cell, its frame named prop.<id>', () => {
    for (const id of IDS) {
      const p = VISIT_PROPS[id]
      const [w, h] = SIZES[id]
      expect(frameRules(p.map, w, h), id).toEqual([])
      expect(partRules(p, ['hand']), id).toEqual([])
      expect(p.frame, id).toEqual({ id: `prop.${id}`, map: p.map })
    }
  })

  it('reads each prop: paper with its lines, the contract\'s blue heading and red seal, the gold cup on a wooden base', () => {
    expect(VISIT_PROPS.envelope.map).toEqual(['LLLLLL', 'LwWWwL', 'LWwwWL', 'LLLLLL'])
    // the letter: paper W with lines of writing w inside, framed all round by the outline
    const letter = VISIT_PROPS.letter.map
    expect([letter[0], letter[letter.length - 1]]).toEqual(['LLLLL', 'LLLLL'])
    expect(letter.join('')).toContain('W')
    expect(letter.join('')).toContain('w')
    expect([VISIT_PROPS.contract.map[2], VISIT_PROPS.contract.map[5]]).toEqual(['LRRRL', 'LWMWL'])
    expect([VISIT_PROPS.trophy.map[1], VISIT_PROPS.trophy.map[4]]).toEqual(['LXXXL', 'LDDDL'])
    expect([VISIT_PROPS.envelope.anchors.hand, VISIT_PROPS.contract.anchors.hand]).toEqual([{ x: 3, y: 1 }, { x: 2, y: 1 }])
  })
})
