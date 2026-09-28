// The staff portrait: the anchor frame's head (rows 0-15, cols 2-19, 18x16) in an assistant's colours.
import { AVATAR_CROP, spriteRects } from './spriteSvg'
import { ASSISTANT_PALS, MANGAKA_IDLE } from './sprites'

const AVATAR_RECTS = ASSISTANT_PALS.map((pal) => spriteRects(MANGAKA_IDLE[0], pal, AVATAR_CROP))

export function SpriteAvatar({ look }: { look: number }) {
  const rects = AVATAR_RECTS[look % AVATAR_RECTS.length]
  return (
    <svg className="avatar" viewBox="0 0 18 16" width={48} height={48} aria-hidden shapeRendering="crispEdges">
      <rect width="18" height="16" fill="var(--paper-2)" />
      {rects.map((q, i) => <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} fill={q.fill} />)}
    </svg>
  )
}
