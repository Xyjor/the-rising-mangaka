// The 0.10 frames as cast frames (0.11.0): each map with the id the sprite cache names it by, built once. render draws
// a character from these with one drawImage until its rig replaces them: the mangaka's at Task 17 and the assistants'
// at Task 19 of the 0.11.0 plan, the editor's in 0.12.0, the cat's in 0.13.0.
import {
  ASSISTANT_DOZE, CAT_GROOM, CAT_SIT, CAT_SLEEP, CAT_STRETCH, CAT_WALK, EDITOR_IDLE, EDITOR_WALK, MANGAKA_IDLE,
  MANGAKA_LIE, MANGAKA_PANIC, MANGAKA_SIP, MANGAKA_SIT, MANGAKA_STRETCH, MANGAKA_WALK,
} from './sprites'
import type { SpriteMap } from './sprites'
import type { CastFrame } from './rig/types'

function frames(name: string, maps: readonly SpriteMap[]): readonly CastFrame[] {
  return maps.map((map, i) => ({ id: `${name}.${i}`, map }))
}

export const OLD_CAST = {
  mangakaIdle: frames('mangaka.idle', MANGAKA_IDLE),
  mangakaStretch: frames('mangaka.stretch', MANGAKA_STRETCH),
  mangakaSip: frames('mangaka.sip', MANGAKA_SIP),
  mangakaWalk: frames('mangaka.walk', MANGAKA_WALK),
  mangakaSit: frames('mangaka.sit', MANGAKA_SIT),
  mangakaPanic: frames('mangaka.panic', MANGAKA_PANIC),
  mangakaLie: { id: 'mangaka.lie', map: MANGAKA_LIE } as CastFrame,
  assistantDoze: { id: 'assistant.doze', map: ASSISTANT_DOZE } as CastFrame,
  editorIdle: frames('editor.idle', EDITOR_IDLE),
  editorWalk: frames('editor.walk', EDITOR_WALK),
  catSleep: { id: 'cat.sleep', map: CAT_SLEEP } as CastFrame,
  catSit: { id: 'cat.sit', map: CAT_SIT } as CastFrame,
  catWalk: frames('cat.walk', CAT_WALK),
  catGroom: frames('cat.groom', CAT_GROOM),
  catStretch: { id: 'cat.stretch', map: CAT_STRETCH } as CastFrame,
} as const
