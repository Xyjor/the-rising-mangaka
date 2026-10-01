// @vitest-environment happy-dom
// The staff portrait draws the hand-drawn anchor head (rows 0-15, cols 2-19) in each assistant's colours.
import '../../../test/dom'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpriteAvatar } from '../SpriteAvatar'
import { AVATAR_CROP, spriteRects } from '../spriteSvg'
import { ANCHOR_HEAD, ASSISTANT_PALS } from '../sprites'

describe('SpriteAvatar', () => {
  it('renders the anchor head in the look\'s colours, one rect per run plus the backdrop', () => {
    for (const look of [0, 1]) {
      const { container, unmount } = render(<SpriteAvatar look={look} />)
      const want = spriteRects(ANCHOR_HEAD, ASSISTANT_PALS[look], AVATAR_CROP)
      const rects = [...container.querySelectorAll('rect')].slice(1)
      expect(rects.map((r) => [r.getAttribute('x'), r.getAttribute('y'), r.getAttribute('width'), r.getAttribute('fill')]))
        .toEqual(want.map((q) => [String(q.x), String(q.y), String(q.w), q.fill]))
      unmount()
    }
  })
})
