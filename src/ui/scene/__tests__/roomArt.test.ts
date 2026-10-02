// The room around the studio (roomArt.ts): each tier's walls and floor, the front row of props, the story props and the
// light, asserted through what they paint into the recording context. Pure drawing: the default node environment.
import { describe, expect, it } from 'vitest'
import type { StudioTierId } from '../../../sim'
import { covers, coversAny, fakeContext, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import { shadow } from '../paint'
import { render } from '../render'
import type { Snapshot } from '../render'
import {
  TIER_FLOOR, TIER_FRONT, TIER_ROOM, TIER_WALL, drawAmbient, drawBin, drawCalendar, drawCorkboard, drawCups, drawFanLetters, drawSeriesPoster,
} from '../roomArt'
import { NO_ART } from '../sceneArt'

type Box = readonly [x0: number, x1: number, y0: number, y1: number]
const inBox = (c: FillCall, [x0, x1, y0, y1]: Box) => c.x >= x0 && c.x + c.w <= x1 + 1 && c.y >= y0 && c.y + c.h <= y1 + 1
const overlaps = (c: FillCall, [x0, x1, y0, y1]: Box) => c.x <= x1 && c.x + c.w > x0 && c.y <= y1 && c.y + c.h > y0

function alone(draw: (ctx: CanvasRenderingContext2D) => void): FillCall[] {
  const { ctx, log } = fakeContext()
  draw(ctx)
  return log
}
function paint(over: Partial<Snapshot> = {}, t = 0.3, frame = 100): FillCall[] {
  const { ctx, log } = fakeContext()
  render(ctx, sceneSnapshot(over), t, frame)
  return log
}
const key = (log: FillCall[]) => JSON.stringify(log)

const TIERS: StudioTierId[] = ['apartment', 'flat', 'loft']
/** Each tier's floor, the pixel (160, 170) by day: tatami straw, honey planks, pale concrete. */
const FLOOR: Record<StudioTierId, string> = { apartment: '#cdbd7c', flat: '#c8894e', loft: '#bdb8ae' }
const HERI = '#3d4a3a'
const PAPER = '#fdfcf7'
const RED = '#e5484d'
const GOLD = '#f5b700'
const CUP = '#f2efe6'
const URGENT = '#f7b8b0'
const SHADOW = 'rgba(40, 24, 16, 0.28)'
const DAYLIGHT = ['rgba(255, 244, 214, 0.14)', 'rgba(255, 244, 214, 0.12)', 'rgba(255, 244, 214, 0.1)', 'rgba(255, 244, 214, 0.08)']
const VIGNETTE = 'rgba(24, 16, 40, 0.12)'
const LAMP_POOL = 'rgba(255, 236, 170, 0.14)'
const OVERLAY = 'rgba(20, 24, 60, 0.28)'

const CORK: Box = [140, 154, 46, 63]
const CALENDAR: Box = [164, 177, 50, 63]
const CUPS: Box = [134, 152, 118, 125]
const LETTERS: Box = [259, 273, 108, 113]
const BIN: Box = [232, 244, 150, 168]
const POSTER: Box = [116, 138, 50, 78]
const FRONT: Box = [60, 260, 140, 179]
const SEATED: Box = [132, 155, 67, 98]
const STANDING: Box = [170, 193, 81, 112]
const EDITOR: Box = [198, 221, 85, 116]

describe('each tier\'s room', () => {
  it('covers the whole canvas, wall and floor, in at most 84 fills (the flat 83 since its wood-beam frame)', () => {
    for (const tier of TIERS) {
      for (const night of [false, true]) {
        const log = alone((ctx) => TIER_ROOM[tier](ctx, night))
        expect(log.length, tier).toBeLessThanOrEqual(84)
        for (const [x, y] of [[0, 0], [319, 0], [0, 113], [319, 113], [0, 114], [319, 179], [160, 60]]) {
          expect(coversAny(log, x, y), `${tier} ${x},${y}`).toBeGreaterThan(-1)
        }
        for (const c of log) expect(c.x >= 0 && c.y >= 0 && c.x + c.w <= 320 && c.y + c.h <= 180, JSON.stringify(c)).toBe(true)
      }
    }
  })

  it('frames the flat and the loft with a dark-wood beam and two posts, clear of the door and the story props', () => {
    for (const tier of ['flat', 'loft'] as const) {
      const log = alone((ctx) => TIER_ROOM[tier](ctx, false))
      const beam = log.find((c) => c.x === 0 && c.y === 3 && c.w === 320 && c.h === 2)
      expect(beam, tier).toBeDefined()
      const posts = log.filter((c) => c.style === beam!.style && c.w === 4 && c.h === 106)
      expect(posts.map((c) => c.x), tier).toEqual([62, 252])
      for (const c of posts) {
        expect(c.x + c.w <= 258, tier).toBe(true)
        expect(c.x + c.w <= 140 || c.x >= 178, tier).toBe(true)
      }
    }
  })

  it('lays tatami in the apartment, planks in the flat and concrete in the loft', () => {
    for (const tier of TIERS) {
      const log = alone((ctx) => TIER_ROOM[tier](ctx, false))
      const top = coversAny(log, 160, 170)
      expect(log[top].style, tier).toBe(FLOOR[tier])
    }
    // the tatami's cloth edges run across the floor
    expect(alone((ctx) => TIER_ROOM.apartment(ctx, false)).some((c) => c.style === HERI && c.y >= 114 && c.w >= 64)).toBe(true)
  })

  it('splits each room into a wall (rows 0-113) and a floor (rows 114-179), the room being the wall then the floor', () => {
    for (const tier of TIERS) {
      for (const night of [false, true]) {
        const label = `${tier} ${night ? 'night' : 'day'}`
        const wall = alone((ctx) => TIER_WALL[tier](ctx, night))
        const floor = alone((ctx) => TIER_FLOOR[tier](ctx, night))
        expect(wall.length, label).toBeGreaterThan(0)
        for (const c of wall) expect(c.y >= 0 && c.y + c.h <= 114, `${label} wall ${JSON.stringify(c)}`).toBe(true)
        for (const c of floor) expect(c.y >= 114 && c.y + c.h <= 180, `${label} floor ${JSON.stringify(c)}`).toBe(true)
        for (const [x, y] of [[0, 114], [319, 179]]) expect(coversAny(floor, x, y), `${label} floor ${x},${y}`).toBeGreaterThan(-1)
        expect(alone((ctx) => TIER_ROOM[tier](ctx, night)), label).toEqual([...wall, ...floor])
      }
    }
  })

  it("stripes the flat's teal wallpaper in mid teal, 16 stripes every 20 px", () => {
    const stripes = alone((ctx) => TIER_WALL.flat(ctx, false)).filter((c) => c.style === '#6f9a90')
    expect(stripes.map((c) => c.x)).toEqual(Array.from({ length: 16 }, (_, i) => 10 + i * 20))
    expect(stripes.every((c) => c.w === 2 && c.y === 3 && c.h === 81)).toBe(true)
  })

  it('paints each tier its own way, and night differently from day', () => {
    const day = TIERS.map((tier) => key(alone((ctx) => TIER_ROOM[tier](ctx, false))))
    expect(new Set(day).size).toBe(3)
    for (const tier of TIERS) {
      expect(key(alone((ctx) => TIER_ROOM[tier](ctx, true))), tier).not.toBe(key(alone((ctx) => TIER_ROOM[tier](ctx, false))))
    }
  })
})

describe('the front row', () => {
  it('stands on the floor inside the phone crop, off every actor\'s spot', () => {
    const logs = TIERS.map((tier) => alone((ctx) => TIER_FRONT[tier](ctx, sceneSnapshot({ tier }), 100, false, NO_ART)))
    expect(new Set(logs.map(key)).size).toBe(3)
    for (const log of logs) {
      expect(log.length).toBeGreaterThan(0)
      for (const c of log) {
        const where = JSON.stringify(c)
        expect(inBox(c, FRONT), where).toBe(true)
        for (const spot of [SEATED, STANDING, EDITOR]) expect(overlaps(c, spot), where).toBe(false)
      }
    }
  })

  it('is drawn after the actors, so the cat walks behind it', () => {
    const s = sceneSnapshot({ tier: 'flat' })
    const log = paint({ tier: 'flat' })
    const front = alone((ctx) => TIER_FRONT.flat(ctx, s, 100, false, NO_ART))
    const cat = covers(log, '#e39a4a', 197, 121)
    expect(cat).toBeGreaterThan(-1)
    const first = log.findIndex((c) => key([c]) === key([front[0]]))
    expect(first).toBeGreaterThan(cat)
  })
})

describe('the story props', () => {
  it('pins one storyboard card per sixth of the pages, in two rows of three, on the corkboard, none with nothing on the desk', () => {
    const cards = (over: Partial<Snapshot>) =>
      alone((ctx) => drawCorkboard(ctx, sceneSnapshot(over))).filter((c) => c.style === PAPER && c.w === 3 && c.h === 4)
    expect(cards({ progress: 0 })).toHaveLength(0)
    expect(cards({ progress: 0.5 })).toHaveLength(3)
    expect(cards({ progress: 0.99 })).toHaveLength(5)
    const full = cards({ progress: 1, phase: 'ready' })
    expect(full.map((c) => [c.x, c.y])).toEqual([[142, 48], [146, 48], [150, 48], [142, 53], [146, 53], [150, 53]])
    expect(cards({ progress: 0.5, phase: 'idle' })).toHaveLength(0)
    for (const c of alone((ctx) => drawCorkboard(ctx, sceneSnapshot({ progress: 1, rankTone: 'top' })))) {
      expect(inBox(c, CORK), JSON.stringify(c)).toBe(true)
    }
  })

  it('pins the last poll on the corkboard: a gold star for the top three, red for the bottom third', () => {
    const sheet = (rankTone: Snapshot['rankTone']) => alone((ctx) => drawCorkboard(ctx, sceneSnapshot({ rankTone, progress: 0 })))
    expect(sheet('none').some((c) => c.style === GOLD || c.style === RED)).toBe(false)
    expect(sheet('top').some((c) => c.style === GOLD)).toBe(true)
    expect(sheet('low').some((c) => c.style === RED)).toBe(true)
    expect(sheet('mid').some((c) => c.style === GOLD || c.style === RED)).toBe(false)
    expect(key(sheet('mid'))).not.toBe(key(sheet('none')))
  })

  it('circles the deadline on the calendar, reddens its last three days and blinks when late', () => {
    const cal = (over: Partial<Snapshot>, frame = 0) => alone((ctx) => drawCalendar(ctx, sceneSnapshot(over), frame))
    expect(cal({ daysLeft: -1 }).some((c) => c.style === RED)).toBe(false)
    expect(cal({ daysLeft: 10 }).some((c) => c.style === RED)).toBe(true)
    expect(cal({ daysLeft: 10 }).some((c) => c.style === URGENT)).toBe(false)
    expect(cal({ daysLeft: 2 }).some((c) => c.style === URGENT)).toBe(true)
    expect(key(cal({ daysLeft: 0, late: true }, 0))).not.toBe(key(cal({ daysLeft: 0, late: true }, 12)))
    expect(key(cal({ daysLeft: 2 }, 0))).toBe(key(cal({ daysLeft: 2 }, 12)))
    for (const c of cal({ daysLeft: 0, late: true })) expect(inBox(c, CALENDAR), JSON.stringify(c)).toBe(true)
  })

  it('piles up a coffee cup at 60, 40 and 20 stamina', () => {
    const cups = (stamina: number) => alone((ctx) => drawCups(ctx, sceneSnapshot({ stamina }))).filter((c) => c.style === CUP && c.w === 3)
    expect([80, 60, 59, 40, 39, 20, 19, 0].map((n) => cups(n).length)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    for (const c of alone((ctx) => drawCups(ctx, sceneSnapshot({ stamina: 0 })))) expect(inBox(c, CUPS), JSON.stringify(c)).toBe(true)
  })

  it('hangs the running serial\'s cover in the poster\'s place, tinted by its genre, the anime first', () => {
    for (let hue = 0; hue < 6; hue++) {
      for (const c of alone((ctx) => drawSeriesPoster(ctx, hue))) expect(inBox(c, POSTER), JSON.stringify(c)).toBe(true)
    }
    expect(key(alone((ctx) => drawSeriesPoster(ctx, 0)))).not.toBe(key(alone((ctx) => drawSeriesPoster(ctx, 1))))
    const stock = { style: '#e5484d', x: 118, y: 52, w: 18, h: 24 }
    expect(paint()).toContainEqual(stock)
    expect(paint({ serialOn: true, posterHue: 2 })).not.toContainEqual(stock)
    expect(key(paint({ serialOn: true, animePoster: true }))).toBe(key(paint({ animePoster: true })))
  })

  it('leaves a letter on the doormat per fan level', () => {
    const letters = (level: Snapshot['fanLevel']) => alone((ctx) => drawFanLetters(ctx, level)).filter((c) => c.style === PAPER)
    expect([0, 1, 2, 3].map((n) => letters(n as Snapshot['fanLevel']).length)).toEqual([0, 1, 2, 3])
    for (const c of alone((ctx) => drawFanLetters(ctx, 3))) expect(inBox(c, LETTERS), JSON.stringify(c)).toBe(true)
  })

  it('fills the bin with a crumpled page per quarter drawn, only while drawing', () => {
    const balls = (over: Partial<Snapshot>) => alone((ctx) => drawBin(ctx, sceneSnapshot(over))).filter((c) => c.style === PAPER)
    expect([0, 0.25, 0.5, 0.99].map((progress) => balls({ progress }).length)).toEqual([0, 1, 2, 3])
    expect(balls({ progress: 0.9, phase: 'idle' })).toHaveLength(0)
    for (const c of alone((ctx) => drawBin(ctx, sceneSnapshot({ progress: 0.9 })))) expect(inBox(c, BIN), JSON.stringify(c)).toBe(true)
  })

  it('shows up in the painted scene', () => {
    const bare = key(paint())
    for (const over of [{ daysLeft: 5 }, { rankTone: 'top' }, { fanLevel: 2 }, { stamina: 10 }] as Partial<Snapshot>[]) {
      expect(key(paint(over)), JSON.stringify(over)).not.toBe(bare)
    }
  })
})

describe('the light', () => {
  it('lays a daylight shaft on the floor by day, moving with the sun, and none at night', () => {
    const shaft = (t: number) => alone((ctx) => drawAmbient(ctx, sceneSnapshot(), t, t > 0.72 || t < 0.06, false))
      .filter((c) => DAYLIGHT.includes(c.style))
    expect(shaft(0.3).length).toBeGreaterThan(0)
    // four steps, each wider and fainter than the one above: a broad wedge
    expect(shaft(0.3).map((c) => [c.w, c.style])).toEqual(DAYLIGHT.map((d, i) => [44 + i * 8, d]))
    expect(shaft(0.9)).toEqual([])
    expect(key(shaft(0.2))).not.toBe(key(shaft(0.5)))
    for (const c of shaft(0.3)) expect(c.y, JSON.stringify(c)).toBeGreaterThanOrEqual(114)
  })

  it('pools the desk lamp\'s light at night while working, and darkens the edges always', () => {
    const lit = (night: boolean, working: boolean) => alone((ctx) => drawAmbient(ctx, sceneSnapshot(), night ? 0.9 : 0.3, night, working))
    expect(lit(true, true).some((c) => c.style === LAMP_POOL)).toBe(true)
    expect(lit(true, false).some((c) => c.style === LAMP_POOL)).toBe(false)
    expect(lit(false, true).some((c) => c.style === LAMP_POOL)).toBe(false)
    for (const night of [false, true]) expect(lit(night, false).filter((c) => c.style === VIGNETTE)).toHaveLength(4)
    for (const c of lit(true, true)) expect(c.x >= 0 && c.y >= 0 && c.x + c.w <= 320 && c.y + c.h <= 180).toBe(true)
  })

  it('is painted after the night overlay', () => {
    const log = paint({}, 0.9, 100)
    const overlay = log.findIndex((c) => c.style === OVERLAY)
    const vignette = log.findIndex((c) => c.style === VIGNETTE)
    expect(overlay).toBeGreaterThan(-1)
    expect(vignette).toBeGreaterThan(overlay)
  })
})

describe('contact shadows', () => {
  it('paints a 2 px shadow row', () => {
    expect(alone((ctx) => shadow(ctx, 10, 20, 30))).toEqual([{ style: SHADOW, x: 10, y: 20, w: 30, h: 2 }])
  })

  it('grounds the standing mangaka: a shadow under the feet, drawn before them', () => {
    const log = paint({ phase: 'ready' })
    // the standing spot's sprite is at (170, 81): its soles on row 31 (cols 6-16, x 176-186, y 112)
    const under = covers(log, SHADOW, 178, 112)
    expect(under).toBeGreaterThan(-1)
    expect(coversAny(log, 178, 112)).toBeGreaterThan(under)
  })

  it('grounds the desk, the bed and the bookshelf', () => {
    const log = paint()
    for (const [x, y] of [[140, 118], [220, 128], [90, 114]]) expect(covers(log, SHADOW, x, y), `${x},${y}`).toBeGreaterThan(-1)
  })
})
