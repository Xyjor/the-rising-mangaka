// The rig's tables keep the spec's rules for every part, pose, key frame and animation (0.11.0): pure data, node
// environment. Each art task's drawings are checked here as they land.
import { describe, expect, it } from 'vitest'
import { partRules, poseRules } from '../rig/assemble'
import { ANIMS, ANIM_IDS } from '../rig/anims'
import type { AnimId } from '../rig/anims'
import { MOODS, faceArtOf, faceOf, frontHand, rigFrame } from '../rig/frames'
import { FACE_ART } from '../rig/head'
import { PARTS } from '../rig/parts'
import { POSES } from '../rig/poses'
import type { PoseDef, PoseId } from '../rig/poses'
import type { AnchorName } from '../rig/types'
import { frameRules } from '../spriteCore'

/** The anchors a part must carry, by its name: the layer it is drawn on decides. */
function needs(name: string): AnchorName[] {
  if (name === 'head' || name.endsWith('-head')) return ['neck']
  if (name === 'torso' || name.endsWith('-torso')) return ['neck', 'shoulderL', 'shoulderR', 'hipL', 'hipR']
  if (name.startsWith('arm-l-')) return ['shoulderL', 'hand']
  if (name.startsWith('arm-r-')) return ['shoulderR', 'hand']
  if (name.startsWith('leg-l-')) return ['hipL']
  if (name.startsWith('leg-r-')) return ['hipR']
  return ['hand']
}

const ENTRIES = Object.entries(POSES) as [PoseId, PoseDef][]

describe('the rig tables', () => {
  it('gives every part its anchors, inside it and painted, every row one width, every key in PAL', () => {
    for (const [name, part] of Object.entries(PARTS)) expect(partRules(part, needs(name)), name).toEqual([])
  })

  it('assembles every part pose 32x48 with every face it can show, ready or not, inside its frame', () => {
    for (const [id, def] of ENTRIES) {
      if (def.pose.kind !== 'parts') continue
      expect([def.pose.w, def.pose.h], id).toEqual([32, 48])
      const pose = def.pose
      const faces = MOODS.flatMap((m) => [faceOf(pose, m, false), faceOf(pose, m, true)])
      expect(poseRules(pose, PARTS, faceArtOf(pose), faces), id).toEqual([])
    }
  })

  it("picks the face art by the pose's head, and refuses a head it has no art for", () => {
    const stand = POSES['stand.idle'].pose
    if (stand.kind !== 'parts') throw new Error('stand.idle is a key frame')
    expect(faceArtOf(stand)).toBe(FACE_ART)
    expect(() => faceArtOf({ ...stand, head: { part: 'nope' } })).toThrow('no face art for the head nope')
  })

  it("finds each part pose's front hand once: the hanging arm's fist at (8, 33) standing, none for a key frame", () => {
    // arm-l-hang at (6, 23), its hand anchor (2, 10); the walk's swung-back arm's fist a column in and a row down
    expect(frontHand('stand.idle')).toEqual({ x: 8, y: 33 })
    expect(frontHand('stand.idle')).toBe(frontHand('stand.idle'))
    expect(frontHand('walk.contact-l')).toEqual({ x: 7, y: 34 })
    expect(frontHand('key.panic-0')).toBeNull()
  })

  it('draws every key frame to its size, the frame rules kept: 48x32 in bed, 32x48 otherwise', () => {
    for (const [id, def] of ENTRIES) {
      if (def.pose.kind !== 'key') continue
      const [w, h] = def.at === 'bed' ? [48, 32] : [32, 48]
      expect(frameRules(def.pose.map, w, h), id).toEqual([])
    }
  })

  it('closes every key frame\'s outline: no painted cell but L beside a clear one or the frame\'s edge', () => {
    // the parts close only where they meet; a key frame is drawn whole, so nothing of it may be open
    for (const [id, def] of ENTRIES) {
      if (def.pose.kind !== 'key') continue
      const map = def.pose.map
      const clear = (x: number, y: number) => y < 0 || y >= map.length || x < 0 || x >= map[y].length || map[y][x] === '.'
      const open: string[] = []
      map.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '.' && row[x] !== 'L' && (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1))) open.push(`${x},${y}`)
        }
      })
      expect(open, id).toEqual([])
    }
  })

  it('places only the bed\'s frames at the bed and only the half-sitting pose at the seat', () => {
    // by name: every bed.* pose at the bed, seat.half at the seat, the rest at the actor
    const place = (id: string) => (id.startsWith('bed.') ? 'bed' : id === 'seat.half' ? 'seat' : 'actor')
    for (const [id, def] of ENTRIES) expect(def.at, id).toBe(place(id))
  })

  it('builds every animation from known poses, each step at least one 24 fps frame (41 ms)', () => {
    expect(Object.keys(ANIMS).sort()).toEqual([...ANIM_IDS].sort())
    for (const id of ANIM_IDS) {
      const a = ANIMS[id]
      expect(a.id).toBe(id)
      expect(a.steps.length, id).toBeGreaterThan(0)
      for (const st of a.steps) {
        expect(POSES[st.pose], `${id} ${st.pose}`).toBeDefined()
        expect(st.ms, `${id} ${st.pose}`).toBeGreaterThanOrEqual(41)
      }
    }
  })

  it('keeps one body through each animation: every part-built step shares its torso', () => {
    for (const id of ANIM_IDS) {
      const torsos = new Set(ANIMS[id].steps.flatMap((st) => {
        const p = POSES[st.pose].pose
        return p.kind === 'parts' ? [p.torso.part] : []
      }))
      expect(torsos.size, id).toBeLessThanOrEqual(1)
    }
  })

  it('gives each animation its posture and its looping', () => {
    const table = Object.fromEntries(ANIM_IDS.map((id) => [id, `${ANIMS[id].posture} ${ANIMS[id].loop ? 'loop' : 'once'}`]))
    expect(table).toEqual({
      stand: 'stand loop', 'stand-ready': 'stand loop', walk: 'walk loop', 'seat-draw': 'seat loop', 'seat-draw-late': 'seat loop',
      'seat-idle': 'seat loop', sleep: 'bed loop', doze: 'bed loop', 'sit-down': 'seat once', 'stand-up': 'walk once',
      'lie-down': 'bed once', 'get-up': 'walk once', 'stand-look': 'stand once', 'stand-sip': 'stand once',
      'seat-stretch': 'seat once', 'seat-sip': 'seat once', 'seat-flip': 'seat once', 'seat-rub': 'seat once',
      'stand-cheer': 'stand once', 'seat-cheer': 'seat once', 'stand-slump': 'stand once', 'seat-slump': 'seat once',
      'seat-panic': 'seat once', 'seat-tear': 'seat once',
      'editor-stand': 'stand loop', 'editor-walk': 'walk loop', 'editor-arrive': 'stand once', 'editor-leave': 'walk once',
      'editor-glasses': 'stand once', 'editor-watch': 'stand once', 'editor-glance': 'stand once', 'editor-nod': 'stand once',
      'editor-sigh': 'stand once',
    } satisfies Record<AnimId, string>)
  })

  it("keeps the editor's poses on the editor's head and torso at the actor, everyone else's off them, and his animations on his poses", () => {
    for (const [id, def] of ENTRIES) {
      if (def.pose.kind !== 'parts') continue
      const editor = id.startsWith('editor.')
      expect(def.pose.head.part, id).toBe(editor ? 'editor-head' : 'head')
      expect(def.pose.torso.part, id).toBe(editor ? 'editor-torso' : 'torso')
      if (editor) expect(def.at, id).toBe('actor')
    }
    for (const id of ANIM_IDS) {
      const editor = id.startsWith('editor-')
      for (const st of ANIMS[id].steps) expect(st.pose.startsWith('editor.'), `${id} ${st.pose}`).toBe(editor)
    }
  })

  it('builds each frame once and names it by its pose and face (no mark while ready)', () => {
    expect(rigFrame('stand.idle', 'happy', false)).toBe(rigFrame('stand.idle', 'happy', false))
    expect(rigFrame('stand.idle', 'happy', false).id).toBe('stand.idle~happy.smile.sparkle')
    expect(rigFrame('stand.idle', 'tired', true).id).toBe('stand.idle~squint.frown.none')
    expect(rigFrame('stand.blink', 'happy', false).id).toBe('stand.blink~blink.smile.sparkle')
  })
})
