// The 0.10 frames as cast frames (0.11.0): each map with the id the sprite cache names it by, built once. render draws
// a character from these with one drawImage until its rig replaces them: the mangaka's went at Task 17 of the 0.11.0
// plan and the assistants' at Task 19 (both draw from the rig only); the editor and the cat remain, the editor's until
// 0.12.0, the cat's until 0.13.0.
import { CAT_GROOM, CAT_SIT, CAT_SLEEP, CAT_STRETCH, CAT_WALK, EDITOR_IDLE, EDITOR_WALK } from './sprites'
import type { SpriteMap } from './sprites'
import type { CastFrame } from './rig/types'

function frames(name: string, maps: readonly SpriteMap[]): readonly CastFrame[] {
  return maps.map((map, i) => ({ id: `${name}.${i}`, map }))
}

export const OLD_CAST = {
  editorIdle: frames('editor.idle', EDITOR_IDLE),
  editorWalk: frames('editor.walk', EDITOR_WALK),
  catSleep: { id: 'cat.sleep', map: CAT_SLEEP } as CastFrame,
  catSit: { id: 'cat.sit', map: CAT_SIT } as CastFrame,
  catWalk: frames('cat.walk', CAT_WALK),
  catGroom: frames('cat.groom', CAT_GROOM),
  catStretch: { id: 'cat.stretch', map: CAT_STRETCH } as CastFrame,
} as const
