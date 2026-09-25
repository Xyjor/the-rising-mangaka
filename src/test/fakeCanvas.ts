/**
 * Studio scene test helpers. `fakeContext` is a recording 2D context: it draws nothing, and every
 * `fillRect(x, y, w, h)` is logged with the `fillStyle` set at that moment, so a test reads back what the scene painted,
 * where and in what order. Only `fillStyle`, `fillRect` and `imageSmoothingEnabled` exist, so a render that reaches for
 * anything else throws. `sceneSnapshot` is the scene's reference state (see its doc); pass `over` to change any field.
 */
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
 * The reference scene: drawing phase, the mangaka working with the clock running at speed 1, half the pages done,
 * stamina 80, one assistant (look 0, stamina 80), in spring, in the bare apartment (nothing owned, no volumes, no
 * anime poster, no trophies). The call-count baseline is measured on this snapshot.
 */
export function sceneSnapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    phase: 'drawing',
    activity: 'work',
    progress: 0.5,
    stamina: 80,
    running: true,
    speed: 1,
    away: false,
    assistants: [{ look: 0, stamina: 80 }],
    season: 'spring',
    tier: 'apartment',
    owned: { coffee: false, lamp: false, shelf: false, chair: false, 'drafting-table': false, tablet: false },
    volumes: 0,
    animePoster: false,
    trophies: 0,
    ...over,
  }
}
