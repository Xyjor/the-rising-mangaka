// The sprite cache paints each cast frame once per palette and facing into its own surface. Its surfaces are recorded
// here; in this node environment (no OffscreenCanvas, no document) the default surface is the stand-in that carries
// its id and size.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeContext } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import { OLD_CAST } from '../oldCast'
import { MOODS, rigFrame } from '../rig/frames'
import { POSES } from '../rig/poses'
import { VISIT_PROPS } from '../rig/props'
import type { PoseId } from '../rig/poses'
import { ASSISTANT_PALS, EDITOR_PAL, OUTFIT_PALS, PAL, drawSprite } from '../sprites'
import {
  CAST_PALETTES, castSurfaceId, createSpriteCache, defaultSurface, drawCast, drawCastTop, getCastCache, installCastCache,
  lookPalette, outfitPalette,
} from '../spriteCache'
import type { CastFrame, Surface } from '../spriteCache'

function recording() {
  const made: { id: string; w: number; h: number; log: FillCall[] }[] = []
  const make = (w: number, h: number, id: string): Surface => {
    const f = fakeContext()
    made.push({ id, w, h, log: f.log })
    return { image: { id, width: w, height: h } as unknown as CanvasImageSource, ctx: f.ctx }
  }
  return { made, cache: createSpriteCache(make) }
}

const FRAME: CastFrame = { id: 'test.frame', map: ['LJ.', '.JL'] }

describe('the look palettes', () => {
  it('has one palette id per assistant look, each wrapping as ASSISTANT_PALS does', () => {
    const looks = Object.keys(CAST_PALETTES).filter((k) => k.startsWith('look'))
    expect(looks.length).toBe(ASSISTANT_PALS.length)
    for (let i = 0; i < ASSISTANT_PALS.length * 2; i++) {
      expect(CAST_PALETTES[lookPalette(i)]).toBe(ASSISTANT_PALS[i % ASSISTANT_PALS.length])
    }
  })
})

describe('the sprite cache', () => {
  afterEach(() => installCastCache(null))

  it('builds one surface per frame id, palette and facing, and hands back the same image after', () => {
    const { made, cache } = recording()
    const a = cache.image(FRAME, 'pal', false)
    expect(cache.image(FRAME, 'pal', false)).toBe(a)
    expect(cache.size).toBe(1)
    cache.image(FRAME, 'pal', true)
    cache.image(FRAME, 'cardigan', false)
    // keyed by the frame's id: another object with the same id is the same frame
    expect(cache.image({ id: 'test.frame', map: ['L'] }, 'pal', false)).toBe(a)
    expect(cache.size).toBe(3)
    expect(made.map((m) => [m.id, m.w, m.h])).toEqual([
      ['cast/test.frame/pal', 3, 2], ['cast/test.frame/pal/r', 3, 2], ['cast/test.frame/cardigan', 3, 2],
    ])
  })

  it('paints the frame with drawSprite in its palette, mirrored for facing right', () => {
    const { made, cache } = recording()
    cache.image(FRAME, 'cardigan', true)
    const want = fakeContext()
    drawSprite(want.ctx, FRAME.map, 0, 0, 2, OUTFIT_PALS.cardigan, true)
    expect(made[0].log).toEqual(want.log)
    expect(made[0].log).toEqual([
      { style: '#1c1a26', x: 2, y: 0, w: 1, h: 1 }, { style: '#c9a24a', x: 1, y: 0, w: 1, h: 1 },
      { style: '#c9a24a', x: 1, y: 1, w: 1, h: 1 }, { style: '#1c1a26', x: 0, y: 1, w: 1, h: 1 },
    ])
  })

  it('paints each run of one key as one fill, mirrored runs too', () => {
    const { made, cache } = recording()
    // the standing rig frame's row 1, the crown's hair: one run of H, read off its map
    const stand = rigFrame('stand.idle', 'neutral', false)
    const hair = /H+/.exec(stand.map[1])!
    expect(hair[0].length).toBeGreaterThan(1)
    cache.image(stand, 'pal', false)
    expect(made[0].log).toContainEqual({ style: '#2b2140', x: hair.index, y: 1, w: hair[0].length, h: 1 })
    expect(made[0].log).not.toContainEqual({ style: '#2b2140', x: hair.index + 1, y: 1, w: 1, h: 1 })
    cache.image(OLD_CAST.editorIdle[0], 'pal', true)
    // row 24 '.......LggggggggL.LFFFfL' mirrored: FFF at cols 2-4, the hem's g at cols 8-15
    expect(made[1].log).toContainEqual({ style: '#6d4c33', x: 2, y: 24, w: 3, h: 1 })
    expect(made[1].log).toContainEqual({ style: '#2c3656', x: 8, y: 24, w: 8, h: 1 })
  })

  it('paints every cast frame (the editor and the cat, every rig pose in every mood) in all ten palettes, never magenta', () => {
    const { made, cache } = recording()
    const old = Object.values(OLD_CAST).flatMap((f) => (Array.isArray(f) ? f : [f])) as CastFrame[]
    const rig = (Object.keys(POSES) as PoseId[]).flatMap((pose) => [
      ...MOODS.map((mood) => rigFrame(pose, mood, false)), rigFrame(pose, 'neutral', true),
    ])
    const pals = Object.keys(CAST_PALETTES) as (keyof typeof CAST_PALETTES)[]
    expect(pals).toHaveLength(10)
    const props = Object.values(VISIT_PROPS).map((p) => p.frame)
    for (const f of [...old, ...rig, ...props]) for (const pal of pals) cache.image(f, pal, false)
    expect(made.length).toBeGreaterThan(9 * Object.keys(POSES).length)
    for (const m of made) expect(m.log.some((c) => c.style === '#f0f'), m.id).toBe(false)
  })

  it('names each surface cast/<frame>/<palette>, /r when mirrored, which the stand-in carries', () => {
    const img = createSpriteCache().image(FRAME, 'look2', true) as unknown as { id: string; width: number; height: number }
    expect(img).toEqual({ id: 'cast/test.frame/look2/r', width: 3, height: 2 })
    expect(castSurfaceId('a.b', 'pal', false)).toBe('cast/a.b/pal')
  })

  it('picks the mangaka\'s palette by level and an assistant\'s by look', () => {
    expect([1, 4, 5, 9, 10, 30].map(outfitPalette)).toEqual(['pal', 'pal', 'cardigan', 'cardigan', 'blazer', 'blazer'])
    expect([0, 1, 5, 6, 7].map(lookPalette)).toEqual(['look0', 'look1', 'look5', 'look0', 'look1'])
    expect(CAST_PALETTES.pal).toBe(PAL)
    expect(CAST_PALETTES.blazer).toBe(OUTFIT_PALS.blazer)
    expect(CAST_PALETTES.editor).toBe(EDITOR_PAL)
    expect(CAST_PALETTES.look3).toBe(ASSISTANT_PALS[3])
  })

  it('keeps one cache for the session until a test installs its own', () => {
    const a = getCastCache()
    expect(getCastCache()).toBe(a)
    const { cache } = recording()
    installCastCache(cache)
    expect(getCastCache()).toBe(cache)
    installCastCache(null)
    expect(getCastCache()).not.toBe(cache)
  })

  it('draws a cast frame with one drawImage at its rounded place, no fill', () => {
    const { ctx, log, images } = fakeContext()
    drawCast(ctx, createSpriteCache(), FRAME, 'pal', 10.4, 20.6, false)
    expect(log).toEqual([])
    expect(images).toEqual([{ id: 'cast/test.frame/pal', x: 10, y: 21, w: 3, h: 2, at: 0 }])
  })

  it('draws a cast frame\'s top rows alone with one drawImage of the same cached image, cropped, at its rounded place', () => {
    const { ctx, log, images } = fakeContext()
    const cache = createSpriteCache()
    drawCastTop(ctx, cache, FRAME, 'pal', 10.4, 20.6, 1)
    expect(log).toEqual([])
    expect(images).toEqual([{ id: 'cast/test.frame/pal', x: 10, y: 21, w: 3, h: 1, at: 0 }])
    expect(cache.size).toBe(1)
    drawCast(ctx, cache, FRAME, 'pal', 0, 0, false)
    expect(cache.size).toBe(1) // the whole frame and its top are one surface
  })
})

describe('defaultSurface', () => {
  afterEach(() => vi.unstubAllGlobals())
  const ctx2d = fakeContext().ctx

  it('paints into an OffscreenCanvas when it gives a 2D context', () => {
    class Offscreen { getContext() { return ctx2d } }
    vi.stubGlobal('OffscreenCanvas', Offscreen)
    const s = defaultSurface(3, 2, 'cast/x/pal')
    expect(s.image).toBeInstanceOf(Offscreen)
    expect(s.ctx).toBe(ctx2d)
  })

  it('falls back to a <canvas> when an OffscreenCanvas gives no 2D context (Safari 16.0-16.3)', () => {
    vi.stubGlobal('OffscreenCanvas', class { getContext() { return null } })
    const canvas = { width: 0, height: 0, getContext: () => ctx2d }
    vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'canvas' ? canvas : null) })
    const s = defaultSurface(3, 2, 'cast/x/pal')
    expect([s.image, s.ctx, canvas.width, canvas.height]).toEqual([canvas, ctx2d, 3, 2])
  })

  it('stands in with the id and size when there is no canvas at all (node)', () => {
    expect(defaultSurface(3, 2, 'cast/x/pal')).toEqual({ image: { id: 'cast/x/pal', width: 3, height: 2 }, ctx: null })
  })
})
