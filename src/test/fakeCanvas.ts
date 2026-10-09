/**
 * Studio scene test helpers. `fakeContext` is a recording 2D context: it draws nothing, and every
 * `fillRect(x, y, w, h)` is logged with the `fillStyle` set at that moment, so a test reads back what the scene painted,
 * where and in what order. `drawImage(img, x, y, w?, h?)` is recorded apart, in `images` (its `at` is the fill log's
 * length when it was called, so a test can order an image against the fills around it), and the cropped
 * `drawImage(img, sx, sy, sw, sh, x, y, w, h)` as where it lands (x, y, w, h); `log` stays fillRect-only, so
 * the fill budgets keep measuring what is still code-drawn. Only `fillStyle`, `fillRect`, `drawImage` and
 * `imageSmoothingEnabled` exist, so a render that reaches for anything else throws. `fakeImage` makes an image the
 * scene's `ready` accepts; `fakeSceneArt` is every room and prop image the game has, ready at once (no flat wall).
 * `sceneSnapshot` is the scene's reference state (see its doc); pass `over` to change any field.
 */
import { newActorTable, planActors, settleActors } from '../ui/scene/actors'
import type { Snapshot } from '../ui/scene/render'
import type { SceneArt } from '../ui/scene/sceneArt'
import type { Surface } from '../ui/scene/spriteCache'

export interface FillCall {
  style: string
  x: number
  y: number
  w: number
  h: number
}

/** One drawImage: the image's `id` (from `fakeImage`), where it landed, and `at`, the fill log's length at the call. */
export interface ImageCall {
  id: string
  x: number
  y: number
  w: number
  h: number
  at: number
}

export interface FakeContext {
  /** Pass this to `render`. */
  ctx: CanvasRenderingContext2D
  /** Every fillRect so far, in call order. */
  log: FillCall[]
  /** Every drawImage so far, in call order. */
  images: ImageCall[]
}

/** A loaded image as the scene sees one (`complete`, a natural size), tagged with `id` for `images`. */
export interface FakeImage {
  id: string
  complete: boolean
  naturalWidth: number
  naturalHeight: number
  width: number
  height: number
}

/** A loaded stand-in image, `w` x `h`, that the scene's `ready` accepts; spread it with `complete: false` for one still loading. */
export function fakeImage(id: string, w: number, h: number): CanvasImageSource & FakeImage {
  const img: FakeImage = { id, complete: true, naturalWidth: w, naturalHeight: h, width: w, height: h }
  return img as unknown as CanvasImageSource & FakeImage
}

/**
 * A surface for a test's sprite cache: a `fakeImage` named by the surface's id and a recording context, so `images`
 * names each cast frame drawn.
 */
export function fakeSurface(w: number, h: number, id: string): Surface {
  return { image: fakeImage(id, w, h), ctx: fakeContext().ctx }
}

/**
 * Every scene image the game has ready (the apartment's and the loft's walls, every prop; the flat has no wall image
 * since 0.10.1, its wall code-drawn), each tagged with its own id: the `*_ART` baselines' art.
 */
export function fakeSceneArt(): SceneArt {
  const img = (id: string) => fakeImage(id, 1, 1)
  return {
    room: { apartment: img('room/apartment'), flat: null, loft: img('room/loft') },
    prop: {
      window: img('window'), door: img('door'), doorway: img('doorway'), kitchenette: img('kitchenette'),
      bookshelf: img('bookshelf'), bed: img('bed'), poster: img('poster'),
      desk: img('desk'), 'drafting-table': img('drafting-table'), chair: img('chair'), 'tall-chair': img('tall-chair'),
      'arm-lamp': img('arm-lamp'), 'reference-shelf': img('reference-shelf'), 'coffee-machine': img('coffee-machine'),
      zabuton: img('zabuton'), boxes: img('boxes'), fern: img('fern'), books: img('books'), 'floor-lamp': img('floor-lamp'),
      sofa: img('sofa'), bin: img('bin'),
    },
  }
}

/** Index of the LAST fill of `style` covering pixel (x, y), or -1. */
export function covers(log: readonly FillCall[], style: string, x: number, y: number): number {
  for (let i = log.length - 1; i >= 0; i--) {
    const c = log[i]
    if (c.style === style && c.x <= x && x < c.x + c.w && c.y <= y && y < c.y + c.h) return i
  }
  return -1
}

/** Index of the last fill of any style covering (x, y), or -1. */
export function coversAny(log: readonly FillCall[], x: number, y: number): number {
  for (let i = log.length - 1; i >= 0; i--) {
    const c = log[i]
    if (c.x <= x && x < c.x + c.w && c.y <= y && y < c.y + c.h) return i
  }
  return -1
}

export function fakeContext(): FakeContext {
  const log: FillCall[] = []
  const images: ImageCall[] = []
  const fake = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    fillRect(x: number, y: number, w: number, h: number) {
      log.push({ style: fake.fillStyle, x, y, w, h })
    },
    drawImage(img: Partial<FakeImage>, ...args: number[]) {
      // (img, x, y), (img, x, y, w, h), or (img, sx, sy, sw, sh, x, y, w, h): a source crop, recorded where it lands
      const [x, y, w, h] = args.length === 8 ? args.slice(4) : args
      images.push({ id: img.id ?? '?', x, y, w: w ?? img.width ?? 0, h: h ?? img.height ?? 0, at: log.length })
    },
  }
  return { ctx: fake as unknown as CanvasRenderingContext2D, log, images }
}

/**
 * The reference scene: drawing phase, the mangaka working with the clock running, half the pages done,
 * stamina 80, one assistant (look 0, stamina 80), in spring, in the bare apartment (nothing owned, no volumes, no
 * anime poster, no trophies), no visitor, the chapter not late, no reaction, and no story (no deadline, serial, poll or fan letters). The call-count baseline is measured on this snapshot. Unless `over.actors`
 * is given, a fresh actor table is planned from the snapshot and settled (everyone in place, nobody walking).
 */
export function sceneSnapshot(over: Partial<Snapshot> = {}): Snapshot {
  const s: Snapshot = {
    phase: 'drawing',
    activity: 'work',
    progress: 0.5,
    stamina: 80,
    level: 1,
    running: true,
    away: false,
    assistants: [{ look: 0, stamina: 80 }],
    season: 'spring',
    tier: 'apartment',
    owned: { coffee: false, lamp: false, shelf: false, chair: false, 'drafting-table': false, tablet: false },
    volumes: 0,
    animePoster: false,
    trophies: 0,
    visitor: 'none',
    visitorProp: 'none',
    late: false,
    cheer: false,
    reaction: null,
    daysLeft: -1,
    serialOn: false,
    posterHue: 0,
    rankTone: 'none',
    fanLevel: 0,
    actors: newActorTable(),
    ...over,
  }
  if (!over.actors) {
    planActors(s.actors, s)
    settleActors(s.actors)
  }
  return s
}
