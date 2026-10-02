// Where the tutorial guide's bubble goes beside the ring it points from. Pure: boxes in, a position out.

/** The gap between the ring and the bubble; the speech tail sits in it. */
export const GAP = 12
/** The bubble stays this far inside the viewport (or the dialog it is in). */
export const MARGIN = 12
/** The tail never comes closer than this to the bubble's corners. */
export const TAIL_INSET = 16

export type BubbleSide = 'above' | 'below' | 'right' | 'left'
export interface Box { left: number; top: number; width: number; height: number }
export interface BubblePlace {
  side: BubbleSide
  x: number
  y: number
  /** The tail's offset along the bubble's edge facing the ring: from the left (above, below) or the top (right, left). */
  tail: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Above the ring, else below it, else beside it (right, then left); `besideFirst` tries the sides first (the vertical
 * rail, where above or below would cover the next buttons). With nothing that fits, the roomier of above and below.
 * Always clamped MARGIN inside the area, with the tail pointing at the ring's middle.
 */
export function placeBubble(
  ring: Box, { bw, bh }: { bw: number; bh: number }, { w, h }: { w: number; h: number }, besideFirst: boolean,
): BubblePlace {
  const cx = ring.left + ring.width / 2
  const cy = ring.top + ring.height / 2
  const at: Record<BubbleSide, { x: number; y: number; fits: boolean }> = {
    above: { x: cx - bw / 2, y: ring.top - GAP - bh, fits: ring.top - GAP - bh >= MARGIN },
    below: { x: cx - bw / 2, y: ring.top + ring.height + GAP, fits: ring.top + ring.height + GAP + bh <= h - MARGIN },
    right: { x: ring.left + ring.width + GAP, y: cy - bh / 2, fits: ring.left + ring.width + GAP + bw <= w - MARGIN },
    left: { x: ring.left - GAP - bw, y: cy - bh / 2, fits: ring.left - GAP - bw >= MARGIN },
  }
  const order: BubbleSide[] = besideFirst ? ['right', 'left', 'above', 'below'] : ['above', 'below', 'right', 'left']
  const side = order.find((s) => at[s].fits) ?? (ring.top >= h - (ring.top + ring.height) ? 'above' : 'below')
  const x = clamp(at[side].x, MARGIN, w - bw - MARGIN)
  const y = clamp(at[side].y, MARGIN, h - bh - MARGIN)
  const tail = side === 'above' || side === 'below'
    ? clamp(cx - x, TAIL_INSET, Math.max(TAIL_INSET, bw - TAIL_INSET))
    : clamp(cy - y, TAIL_INSET, Math.max(TAIL_INSET, bh - TAIL_INSET))
  return { side, x, y, tail }
}
