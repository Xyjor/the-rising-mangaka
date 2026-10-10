// @vitest-environment happy-dom
// The staff portrait draws the rig head (0.11.0) with its neutral face, rows 0-21 and cols 0-23, in each assistant's colours.
import '../../../test/dom'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpriteAvatar } from '../SpriteAvatar'
import { AVATAR_CROP, spriteRects } from '../spriteSvg'
import { ASSISTANT_PALS } from '../sprites'
import { NEUTRAL_FACE, headWith } from '../rig/head'

describe('SpriteAvatar', () => {
  it('renders the rig head in the look\'s colours, one rect per run plus the backdrop, over a backdrop that fills the whole 48x48 box', () => {
    for (const look of [0, 1]) {
      const { container, unmount } = render(<SpriteAvatar look={look} />)
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 -1 24 24')
      const bg = container.querySelector('rect')
      expect([bg?.getAttribute('y'), bg?.getAttribute('height'), bg?.getAttribute('width')]).toEqual(['-1', '24', '24'])
      const want = spriteRects(headWith(NEUTRAL_FACE), ASSISTANT_PALS[look], AVATAR_CROP)
      const rects = [...container.querySelectorAll('rect')].slice(1)
      expect(rects.map((r) => [r.getAttribute('x'), r.getAttribute('y'), r.getAttribute('width'), r.getAttribute('fill')]))
        .toEqual(want.map((q) => [String(q.x), String(q.y), String(q.w), q.fill]))
      unmount()
    }
  })
})
