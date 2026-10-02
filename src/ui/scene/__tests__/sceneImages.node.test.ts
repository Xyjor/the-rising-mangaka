// sceneImages.ts outside a DOM (the default node environment, no `Image`): every piece stays null, code-drawn, even
// with registry refs, instead of throwing.
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../art/registry', () => ({
  ROOM_ART: { flat: { id: 'room/flat', src: '/assets/art/room/flat.png', w: 320, h: 114 } },
  SCENE_PROP_ART: { bed: { id: 'prop/bed', src: '/assets/art/prop/bed.png', w: 58, h: 26 } },
}))

const { sceneImages } = await import('../sceneImages')

describe('sceneImages without a DOM', () => {
  it('builds no images and leaves every piece code-drawn', () => {
    expect(typeof Image).toBe('undefined')
    const art = sceneImages()
    expect(art.room.flat).toBeNull()
    expect(art.prop.bed).toBeNull()
  })
})
