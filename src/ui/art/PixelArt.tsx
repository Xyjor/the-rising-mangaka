import type { ArtRef } from './registry'

/** Renders a generated pixel-art asset at an integer scale, crisp (no smoothing) in every browser. */
export function PixelArt({
  art,
  scale = 1,
  alt = '',
  className,
}: {
  art: ArtRef
  scale?: number
  alt?: string
  className?: string
}) {
  return (
    <img
      src={art.src}
      width={art.w * scale}
      height={art.h * scale}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className ? `pixel-art ${className}` : 'pixel-art'}
    />
  )
}
