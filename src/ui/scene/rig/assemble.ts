// The assembler: a pose's parts composed into one frame, back to front, each placed so its anchor lands on its
// parent's; the outline closed where parts meet; the face stamped into the head's slots. Pure: no DOM, no clock.
import { FACE_KEYS, MARK_KEYS, PAL, frameRules } from '../spriteCore'
import { JOIN, LAYERS } from './types'
import type { AnchorName, Face, FaceArt, HeadPart, Layer, Part, PartLib, PartPose, Point, Slot, SpriteMap } from './types'

/** Whether a part is the head (it has face slots). */
export function isHead(p: Part | HeadPart): p is HeadPart {
  return 'slots' in p
}

/** A drawing's painted cells over a grid, its top-left at (x, y); '.' leaves the grid; a cell outside it throws. */
function paint(grid: string[][], map: SpriteMap, x: number, y: number, what: string): void {
  map.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '.') continue
      const gx = x + c
      const gy = y + r
      if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[gy].length) {
        throw new Error(`${what}: cell ${c},${r} lands outside the frame at ${gx},${gy}`)
      }
      grid[gy][gx] = row[c]
    }
  })
}

/**
 * The outline closed: every painted cell but L with a clear cell beside it (left, right, above or below; the frame's
 * edge counts as clear) becomes L, judged against the map as it was, so a new L never spreads.
 */
export function closeSilhouette(rows: SpriteMap): SpriteMap {
  const clear = (x: number, y: number) => y < 0 || y >= rows.length || x < 0 || x >= rows[y].length || rows[y][x] === '.'
  return rows.map((row, y) => row.replace(/./g, (ch, x: number) =>
    ch === '.' || ch === 'L' ? ch : clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1) ? 'L' : ch))
}

/** The head's map with the face's eyes and mouth in their slots (each drawing fills its slot whole). */
export function stampFace(head: HeadPart, art: FaceArt, face: Face): SpriteMap {
  const grid = head.map.map((row) => row.split(''))
  paint(grid, art.eyes[face.eyes], head.slots.eyes.x, head.slots.eyes.y, `eyes ${face.eyes}`)
  paint(grid, art.mouths[face.mouth], head.slots.mouth.x, head.slots.mouth.y, `mouth ${face.mouth}`)
  return grid.map((row) => row.join(''))
}

function partOf(lib: PartLib, name: string, layer: Layer): Part | HeadPart {
  const p = lib[name]
  if (!p) throw new Error(`${layer}: no part ${name}`)
  return p
}

function anchorOf(part: Part, name: AnchorName, what: string): Point {
  const a = part.anchors[name]
  if (!a) throw new Error(`${what} has no ${name} anchor`)
  return a
}

/** One placed layer: its part and the frame cell its top-left lands on. */
export interface Placed { readonly part: Part | HeadPart; readonly at: Point }

/** Where every layer the pose names lands: the torso at its own cell, each other part by its join anchor. */
export function placeLayers(pose: PartPose, lib: PartLib): Map<Layer, Placed> {
  const out = new Map<Layer, Placed>()
  out.set('torso', { part: partOf(lib, pose.torso.part, 'torso'), at: { x: pose.torso.x, y: pose.torso.y } })
  for (const layer of LAYERS) {
    if (layer === 'torso') continue
    const place = pose[layer]
    if (!place) continue
    const part = partOf(lib, place.part, layer)
    const parentLayer: Layer = layer === 'prop' ? 'armFront' : 'torso'
    const parent = out.get(parentLayer)
    if (!parent) throw new Error(`${layer} ${place.part} needs the ${parentLayer} layer`)
    const name = JOIN[layer]
    const pa = anchorOf(parent.part, name, `${parentLayer} ${pose[parentLayer]?.part}`)
    const ca = anchorOf(part, name, `${layer} ${place.part}`)
    out.set(layer, { part, at: { x: parent.at.x + pa.x - ca.x + (place.dx ?? 0), y: parent.at.y + pa.y - ca.y + (place.dy ?? 0) } })
  }
  return out
}

/**
 * A pose composed into one w x h frame: the layers back to front (a later layer paints over an earlier one, '.' is
 * see-through), the head with the face's eyes and mouth in its slots, the outline closed where parts meet
 * (`closeSilhouette`), then the face's mark stamped into the head's mark slot, whose cells must be clear.
 */
export function assemblePose(pose: PartPose, lib: PartLib, art: FaceArt, face: Face): SpriteMap {
  const placed = placeLayers(pose, lib)
  const grid = Array.from({ length: pose.h }, () => Array.from({ length: pose.w }, () => '.'))
  for (const layer of LAYERS) {
    const p = placed.get(layer)
    if (!p) continue
    let map = p.part.map
    if (layer === 'head') {
      if (!isHead(p.part)) throw new Error(`head ${pose.head.part} has no face slots`)
      map = stampFace(p.part, art, face)
    }
    paint(grid, map, p.at.x, p.at.y, `${layer} ${pose[layer]?.part}`)
  }
  const closed = closeSilhouette(grid.map((row) => row.join('')))
  const head = placed.get('head')
  if (face.mark === 'none' || !head || !isHead(head.part)) return closed
  const out = closed.map((row) => row.split(''))
  const slot = head.part.slots.mark
  art.marks[face.mark].forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '.') continue
      const x = head.at.x + slot.x + c
      const y = head.at.y + slot.y + r
      if (y < 0 || y >= out.length || x < 0 || x >= out[y].length) throw new Error(`mark ${face.mark} lands outside the frame at ${x},${y}`)
      if (out[y][x] !== '.') throw new Error(`mark ${face.mark} lands on a painted cell at ${x},${y}`)
      out[y][x] = row[c]
    }
  })
  return out.map((row) => row.join(''))
}

/**
 * What is wrong with a part, [] when nothing: every row one width, every key in `pal`, and each anchor in `need`
 * present, inside the map and on a painted cell (so two parts always meet on pixels).
 */
export function partRules(part: Part, need: readonly AnchorName[], pal: Record<string, string> = PAL): string[] {
  const out: string[] = []
  const w = part.map[0]?.length ?? 0
  part.map.forEach((row, r) => {
    if (row.length !== w) out.push(`row ${r} is ${row.length} wide, not ${w}`)
    for (const ch of row) if (ch !== '.' && !(ch in pal)) out.push(`row ${r} has key ${ch}`)
  })
  for (const name of need) {
    const a = part.anchors[name]
    if (!a) out.push(`no ${name} anchor`)
    else if (a.y < 0 || a.y >= part.map.length || a.x < 0 || a.x >= w) out.push(`${name} at ${a.x},${a.y} is outside the part`)
    else if ((part.map[a.y][a.x] ?? '.') === '.') out.push(`${name} at ${a.x},${a.y} is on a clear cell`)
  }
  return out
}

/**
 * What stops a part pose, [] when nothing: each face tried, every refusal of the assembler said once, and the frame
 * rules at the pose's size for each face with no mark (a mark is a sticker beside the hair, outside the outline rule,
 * as the 0.10 MARKS were).
 */
export function poseRules(
  pose: PartPose, lib: PartLib, art: FaceArt, faces: readonly Face[], pal: Record<string, string> = PAL,
): string[] {
  const out = new Set<string>()
  for (const face of faces) {
    try {
      const map = assemblePose(pose, lib, art, face)
      if (face.mark === 'none') for (const r of frameRules(map, pose.w, pose.h, pal)) out.add(r)
    } catch (e) {
      out.add((e as Error).message)
    }
  }
  return [...out]
}

/**
 * What is wrong with the head and its face drawings, [] when nothing: the eye and mouth slots hold only face keys and
 * already hold the open eyes and the closed mouth (the bare head is neutral); the mark slot is clear; every eyes and
 * mouth drawing fills its slot (its size, face keys only, no '.'); every mark is the mark slot's size in mark keys.
 */
export function headRules(head: HeadPart, art: FaceArt): string[] {
  const out: string[] = []
  const window = (s: Slot) => head.map.slice(s.y, s.y + s.h).map((row) => row.slice(s.x, s.x + s.w))
  const { eyes, mouth, mark } = head.slots
  for (const [name, s] of [['eye', eyes], ['mouth', mouth]] as const) {
    window(s).forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (!FACE_KEYS.includes(row[c])) out.push(`${name} slot row ${s.y + r} col ${s.x + c} is ${row[c]}, not a face key`)
    })
  }
  window(mark).forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] !== '.') out.push(`mark slot row ${mark.y + r} col ${mark.x + c} is ${row[c]}, not clear`)
  })
  if (window(eyes).join('/') !== art.eyes.open.join('/')) out.push('the eye slot does not hold the open eyes')
  if (window(mouth).join('/') !== art.mouths.closed.join('/')) out.push('the mouth slot does not hold the closed mouth')
  const sized = (what: string, map: SpriteMap, s: Slot, keys: string) => {
    const w = map[0]?.length ?? 0
    if (map.length !== s.h || map.some((row) => row.length !== s.w)) out.push(`${what} is ${w}x${map.length}, not ${s.w}x${s.h}`)
    for (const ch of new Set(map.join(''))) if (!keys.includes(ch)) out.push(`${what} has key ${ch}`)
  }
  for (const [id, map] of Object.entries(art.eyes)) sized(`eyes ${id}`, map, eyes, FACE_KEYS)
  for (const [id, map] of Object.entries(art.mouths)) sized(`mouth ${id}`, map, mouth, FACE_KEYS)
  for (const [id, map] of Object.entries(art.marks)) sized(`mark ${id}`, map, mark, `.${MARK_KEYS}`)
  return out
}
