/**
 * Studio scene test helpers. `fakeContext` is a recording 2D context: it draws nothing, and every
 * `fillRect(x, y, w, h)` is logged with the `fillStyle` set at that moment, so a test reads back what the scene painted,
 * where and in what order. Only `fillStyle`, `fillRect` and `imageSmoothingEnabled` exist, so a render that reaches for
 * anything else throws. `sceneSnapshot` is the scene's reference state (see its doc); pass `over` to change any field.
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

export interface FakeContext {
  /** Pass this to `render`. */
  ctx: CanvasRenderingContext2D
  /** Every fillRect so far, in call order. */
  log: FillCall[]
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
  const fake = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    fillRect(x: number, y: number, w: number, h: number) {
      log.push({ style: fake.fillStyle, x, y, w, h })
    },
  }
  return { ctx: fake as unknown as CanvasRenderingContext2D, log }
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
