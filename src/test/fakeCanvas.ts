/**
 * Studio scene test helpers. `fakeContext` is a recording 2D context: it draws nothing, and every
 * `fillRect(x, y, w, h)` is logged with the `fillStyle` set at that moment, so a test reads back what the scene painted,
 * where and in what order. `drawImage(img, x, y, w?, h?)` is recorded apart, in `images` (its `at` is the fill log's
 * length when it was called, so a test can order an image against the fills around it); `log` stays fillRect-only, so
 * the fill budgets keep measuring what is still code-drawn. Only `fillStyle`, `fillRect`, `drawImage` and
 * `imageSmoothingEnabled` exist, so a render that reaches for anything else throws. `fakeImage` makes an image the
 * scene's `ready` accepts. `sceneSnapshot` is the scene's reference state (see its doc); pass `over` to change any field.
 */
import { newActorTable, planActors, settleActors } from '../ui/scene/actors'
import type { Snapshot } from '../ui/scene/render'

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
    drawImage(img: Partial<FakeImage>, x: number, y: number, w?: number, h?: number) {
      images.push({ id: img.id ?? '?', x, y, w: w ?? img.width ?? 0, h: h ?? img.height ?? 0, at: log.length })
    },
  }
  return { ctx: fake as unknown as CanvasRenderingContext2D, log, images }
}

/**
 * The reference scene: drawing phase, the mangaka working with the clock running, half the pages done,
 * stamina 80, one assistant (look 0, stamina 80), in spring, in the bare apartment (nothing owned, no volumes, no
 * anime poster, no trophies), no visitor, the chapter not late, and no story (no deadline, serial, poll or fan letters). The call-count baseline is measured on this snapshot. Unless `over.actors`
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
