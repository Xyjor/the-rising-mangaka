import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { PixelArt } from './PixelArt'
import type { ArtRef } from './registry'

/**
 * A framed art tile for a `Partial` art record: the generated art when there is one, else `fallback` as an icon in
 * a box of the same size, so a card without art keeps the same image row as its siblings.
 */
export function ArtTile({ art, fallback, scale = 1, size = 32, className }: {
  art: ArtRef | undefined
  fallback: IconName
  scale?: number
  /** the native size the missing art would have had */
  size?: number
  className?: string
}) {
  const cls = className ? `art-frame ${className}` : 'art-frame'
  if (art) return <span className={cls}><PixelArt art={art} scale={scale} /></span>
  const px = size * scale
  return (
    <span className={`${cls} art-fallback`} data-testid="art-fallback" style={{ width: px + 4, height: px + 4 }}>
      <Icon name={fallback} size={Math.round(px / 2)} aria-hidden="true" />
    </span>
  )
}
