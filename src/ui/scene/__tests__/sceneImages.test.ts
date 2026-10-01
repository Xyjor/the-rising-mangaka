// @vitest-environment happy-dom
// sceneImages.ts builds one <img> per scene-art registry ref, once, and tells its listeners when any of them loads so
// the scene repaints. The registry is mocked with a room and a prop, since the real records start empty.
import '../../../test/dom'
import { describe, expect, it, vi } from 'vitest'
import { NO_ART } from '../sceneArt'

vi.mock('../../art/registry', () => ({
  ROOM_ART: { flat: { id: 'room/flat', src: '/assets/art/room/flat.png', w: 320, h: 180 } },
  SCENE_PROP_ART: {
    bed: { id: 'prop/bed', src: '/assets/art/prop/bed.png', w: 58, h: 26 },
    window: { id: 'prop/window', src: '/assets/art/prop/window.png', w: 48, h: 36 },
  },
}))

const { onSceneImageLoad, sceneImages } = await import('../sceneImages')

describe('sceneImages', () => {
  it('builds one image per registry ref, and none for a piece without one', () => {
    const art = sceneImages()
    expect(art.room.flat).toBeInstanceOf(HTMLImageElement)
    expect((art.room.flat as HTMLImageElement).src).toContain('/assets/art/room/flat.png')
    expect(art.room.apartment).toBeNull()
    expect(art.room.loft).toBeNull()
    expect(art.prop.bed).toBeInstanceOf(HTMLImageElement)
    expect((art.prop.bed as HTMLImageElement).src).toContain('/assets/art/prop/bed.png')
    expect(art.prop.window).toBeInstanceOf(HTMLImageElement)
    expect(art.prop.door ?? null).toBeNull()
    const images = [...Object.values(art.room), ...Object.values(art.prop)].filter((v) => v !== null)
    expect(images).toHaveLength(3)
    expect(new Set(images).size).toBe(3)
    // every tier and prop the scene knows is present
    expect(Object.keys(art.room).sort()).toEqual(Object.keys(NO_ART.room).sort())
    expect(Object.keys(art.prop).sort()).toEqual(Object.keys(NO_ART.prop).sort())
  })

  it('memoises: the same art and the same images on every call', () => {
    const a = sceneImages()
    const b = sceneImages()
    expect(b).toBe(a)
    expect(b.room.flat).toBe(a.room.flat)
    expect(b.prop.bed).toBe(a.prop.bed)
  })

  it('calls the repaint hook when any image loads, until it unsubscribes', () => {
    const art = sceneImages()
    const repaint = vi.fn()
    const off = onSceneImageLoad(repaint)
    ;(art.room.flat as HTMLImageElement).dispatchEvent(new Event('load'))
    expect(repaint).toHaveBeenCalledTimes(1)
    ;(art.prop.bed as HTMLImageElement).dispatchEvent(new Event('load'))
    expect(repaint).toHaveBeenCalledTimes(2)
    off()
    ;(art.prop.window as HTMLImageElement).dispatchEvent(new Event('load'))
    expect(repaint).toHaveBeenCalledTimes(2)
  })
})
