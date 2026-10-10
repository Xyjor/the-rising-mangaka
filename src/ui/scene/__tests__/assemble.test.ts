// The rig's assembler is pure (no DOM): parts placed by their anchors, layered back to front, the outline closed where
// they meet, the face stamped into the head. Tiny literal parts; the default node environment.
import { describe, expect, it } from 'vitest'
import { assemblePose, closeSilhouette, partRules, placeLayers, poseRules, stampFace } from '../rig/assemble'
import type { Face, FaceArt, HeadPart, Part, PartLib, PartPose } from '../rig/types'

const TORSO: Part = {
  map: ['LJJJL', 'LJYJL', 'LJYJL', 'LLLLL'],
  anchors: { neck: { x: 2, y: 0 }, shoulderL: { x: 0, y: 1 }, shoulderR: { x: 4, y: 1 }, hipL: { x: 1, y: 3 }, hipR: { x: 3, y: 3 } },
}
const HEAD: HeadPart = {
  map: ['LLLLL..', 'LHHHL..', 'LESEL..', 'LSSSL..', 'LLLLL..'],
  anchors: { neck: { x: 2, y: 4 } },
  slots: { eyes: { x: 1, y: 2, w: 3, h: 1 }, mouth: { x: 2, y: 3, w: 1, h: 1 }, mark: { x: 5, y: 0, w: 2, h: 2 } },
}
const LIB: PartLib = {
  torso: TORSO, head: HEAD,
  'arm-f': { map: ['LSL', 'LSL', 'LLL'], anchors: { shoulderL: { x: 1, y: 0 }, hand: { x: 1, y: 2 } } },
  'arm-b': { map: ['LSL', 'LSL', 'LLL'], anchors: { shoulderR: { x: 0, y: 0 } } },
  'leg-f': { map: ['LFL', 'LFL', 'LLL'], anchors: { hipL: { x: 1, y: 0 } } },
  'leg-b': { map: ['LFL', 'LFL', 'LLL'], anchors: { hipR: { x: 1, y: 0 } } },
  mug: { map: ['LLL', 'LWL', 'LLL'], anchors: { hand: { x: 2, y: 0 } } },
}
const ART: FaceArt = {
  eyes: { open: ['ESE'], blink: ['LSL'], closed: ['LSL'], ring: ['WEW'], squint: ['LSL'], happy: ['LSL'] },
  mouths: { closed: ['S'], open: ['M'], smile: ['M'], frown: ['L'], o: ['W'] },
  marks: { sweat: ['.W', 'WA'], sparkle: ['X.', '.X'], bang: ['L.', 'L.'], zee: ['LL', 'LL'] },
}
const NEUTRAL: Face = { eyes: 'open', mouth: 'closed', mark: 'none' }
const POSE: PartPose = {
  kind: 'parts', w: 11, h: 10, torso: { part: 'torso', x: 3, y: 4 }, head: { part: 'head' },
  armBack: { part: 'arm-b' }, legBack: { part: 'leg-b' }, legFront: { part: 'leg-f' }, armFront: { part: 'arm-f' },
}

describe('placeLayers', () => {
  it('puts the torso at its cell and every other part with its anchor on its parent\'s, nudged by dx and dy', () => {
    const at = [...placeLayers({ ...POSE, prop: { part: 'mug' } }, LIB)].map(([layer, p]) => [layer, p.at.x, p.at.y])
    // the head's neck (2, 4) on the torso's (3 + 2, 4 + 0); the front arm's shoulderL (1, 0) on (3 + 0, 4 + 1); the mug's
    // hand (2, 0) on the front arm's hand (2 + 1, 5 + 2)
    expect(at).toEqual([['torso', 3, 4], ['armBack', 7, 5], ['legBack', 5, 7], ['legFront', 3, 7], ['head', 3, 0], ['armFront', 2, 5], ['prop', 1, 7]])
    expect(placeLayers({ ...POSE, head: { part: 'head', dx: -1, dy: 1 } }, LIB).get('head')?.at).toEqual({ x: 2, y: 1 })
  })
})

describe('assemblePose', () => {
  it('layers the parts back to front, closes the outline where they meet and keeps each part\'s colours inside', () => {
    expect(assemblePose(POSE, LIB, ART, NEUTRAL)).toEqual([
      '...LLLLL...',
      '...LHHHL...',
      '...LESEL...',
      '...LSSSL...',
      '...LLLLL...', // the head's chin outline over the torso's top row
      '..LSLYJLLL.', // the front arm over the torso's left edge; the back arm's open top closed to L
      '..LSLYJLSL.', // the back arm's sleeve behind the torso's right outline
      '..LLLLLLLL.',
      '...LFLFL...', // the legs under the torso's hem, the front one over the back one at col 5
      '...LLLLL...',
    ])
  })

  it('stamps the face\'s eyes and mouth into the head and its mark beside the hair, after the outline is closed', () => {
    expect(assemblePose(POSE, LIB, ART, { eyes: 'ring', mouth: 'o', mark: 'sweat' }).slice(0, 4)).toEqual([
      '...LLLLL.W.',
      '...LHHHLWA.',
      '...LWEWL...',
      '...LSWSL...',
    ])
  })

  it('refuses a part that lands outside the frame, a missing anchor or part, a prop with no hand, a head with no slots, a mark on a painted cell', () => {
    expect(() => assemblePose({ ...POSE, torso: { part: 'torso', x: 7, y: 4 } }, LIB, ART, NEUTRAL)).toThrow('armBack arm-b: cell 0,0 lands outside the frame at 11,5')
    expect(() => assemblePose({ ...POSE, legFront: { part: 'arm-f' } }, LIB, ART, NEUTRAL)).toThrow('legFront arm-f has no hipL anchor')
    expect(() => assemblePose({ ...POSE, armFront: undefined, prop: { part: 'mug' } }, LIB, ART, NEUTRAL)).toThrow('prop mug needs the armFront layer')
    expect(() => assemblePose({ ...POSE, head: { part: 'mug' } }, LIB, ART, NEUTRAL)).toThrow('head mug has no neck anchor')
    expect(() => assemblePose({ ...POSE, head: { part: 'nope' } }, LIB, ART, NEUTRAL)).toThrow('head: no part nope')
    expect(() => assemblePose({ ...POSE, head: { part: 'torso' } }, LIB, ART, NEUTRAL)).toThrow('head torso has no face slots')
    expect(() => assemblePose({ ...POSE, armBack: { part: 'arm-b', dx: 1, dy: -5 } }, LIB, ART, { ...NEUTRAL, mark: 'zee' })).toThrow('mark zee lands on a painted cell at 8,0')
  })
})

describe('closeSilhouette and stampFace', () => {
  it('turns every painted cell beside a clear one (the frame edge counts) into outline, judged on the map as it was', () => {
    expect(closeSilhouette(['.....', '.SSS.', '.SSS.', '.SSS.', '.....'])).toEqual(['.....', '.LLL.', '.LSL.', '.LLL.', '.....'])
    expect(closeSilhouette(['JJJ', 'JJJ', 'JJJ'])).toEqual(['LLL', 'LJL', 'LLL'])
  })

  it('fills the eye and mouth slots whole, leaving the rest of the head', () => {
    expect(stampFace(HEAD, ART, { eyes: 'ring', mouth: 'o', mark: 'none' })).toEqual(['LLLLL..', 'LHHHL..', 'LWEWL..', 'LSWSL..', 'LLLLL..'])
    expect(stampFace(HEAD, ART, NEUTRAL)).toEqual(HEAD.map)
  })
})

describe('the rules', () => {
  it('partRules: one width, palette keys, each needed anchor present, inside and on a painted cell', () => {
    expect(partRules(TORSO, ['neck', 'shoulderL', 'shoulderR', 'hipL', 'hipR'])).toEqual([])
    expect(partRules({ map: ['LS', 'L', 'L#'], anchors: {} }, [])).toEqual(['row 1 is 1 wide, not 2', 'row 2 has key #'])
    expect(partRules({ map: ['LS', 'L.'], anchors: { hand: { x: 1, y: 1 }, hipL: { x: 3, y: 0 } } }, ['hand', 'hipL', 'neck']))
      .toEqual(['hand at 1,1 is on a clear cell', 'hipL at 3,0 is outside the part', 'no neck anchor'])
  })

  it('poseRules: every face assembles, and the mark-free ones keep the frame rules at the pose\'s size', () => {
    expect(poseRules(POSE, LIB, ART, [NEUTRAL, { eyes: 'happy', mouth: 'smile', mark: 'sparkle' }])).toEqual([])
    expect(poseRules({ ...POSE, armBack: { part: 'arm-b', dx: 1, dy: -5 } }, LIB, ART, [NEUTRAL, { ...NEUTRAL, mark: 'zee' }]))
      .toEqual(['mark zee lands on a painted cell at 8,0'])
    // one row taller: the feet are no longer on the last row
    expect(poseRules({ ...POSE, h: 11 }, LIB, ART, [NEUTRAL])).toEqual(['the last row is empty'])
  })
})
