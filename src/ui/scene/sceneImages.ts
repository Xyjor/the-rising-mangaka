// The scene's generated images: one <img> per ref in the registry's ROOM_ART and SCENE_PROP_ART records, built once
// (a module-level memo) into the `SceneArt` render reads. An image draws only once it has loaded (sceneArt.ts
// `ready`), so each load tells the listeners (`onSceneImageLoad`) and the scene repaints once to show it. This is the
// only scene module that imports the registry; render.ts never does.
import type { StudioTierId } from '../../sim'
import { ROOM_ART, SCENE_PROP_ART } from '../art/registry'
import type { ArtRef } from '../art/registry'
import { NO_ART } from './sceneArt'
import type { SceneArt, ScenePropId } from './sceneArt'

const listeners = new Set<() => void>()

function loaded() {
  for (const cb of listeners) cb()
}

/** Calls `cb` whenever a scene image finishes loading; returns the unsubscribe. */
export function onSceneImageLoad(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function image(ref: ArtRef | undefined): HTMLImageElement | null {
  if (!ref) return null
  const img = new Image(ref.w, ref.h)
  img.decoding = 'async'
  img.addEventListener('load', loaded)
  img.src = ref.src
  return img
}

let memo: SceneArt | null = null

/** The scene's images, built on the first call and the same objects ever after. */
export function sceneImages(): SceneArt {
  if (memo) return memo
  const room = { ...NO_ART.room }
  for (const tier of Object.keys(room) as StudioTierId[]) room[tier] = image(ROOM_ART[tier])
  const prop = { ...NO_ART.prop }
  for (const id of Object.keys(prop) as ScenePropId[]) prop[id] = image(SCENE_PROP_ART[id])
  memo = { room, prop }
  return memo
}
