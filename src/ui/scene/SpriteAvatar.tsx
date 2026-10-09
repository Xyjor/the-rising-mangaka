// The staff portrait: the rig's head (0.11.0) with its neutral face, rows 0-21 and cols 0-23, in an assistant's colours.
import { AVATAR_CROP, spriteRects } from './spriteSvg'
import { ASSISTANT_PALS } from './sprites'
import { NEUTRAL_FACE, headWith } from './rig/head'

const HEAD_MAP = headWith(NEUTRAL_FACE)
const AVATAR_RECTS = ASSISTANT_PALS.map((pal) => spriteRects(HEAD_MAP, pal, AVATAR_CROP))

export function SpriteAvatar({ look }: { look: number }) {
  const rects = AVATAR_RECTS[look % AVATAR_RECTS.length]
  return (
    <svg className="avatar" viewBox="0 0 24 22" width={48} height={48} aria-hidden shapeRendering="crispEdges">
      <rect width="24" height="22" fill="var(--paper-2)" />
      {rects.map((q, i) => <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} fill={q.fill} />)}
    </svg>
  )
}
