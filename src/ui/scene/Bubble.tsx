// A speech bubble over the scene: DOM text in tokens, placed imperatively by StudioScene (style.left/top).
import type { Ref } from 'react'

/** How long a mangaka line stays up. */
export const BUBBLE_MS = 4000

export function Bubble({ text, who, ref }: { text: string; who: 'mangaka' | 'editor'; ref?: Ref<HTMLDivElement> }) {
  return <div ref={ref} className="bubble pixel-bubble" data-who={who} role="status">{text}</div>
}
