// Reduced-motion detection, shared by anything that animates (currently the studio scene canvas).

/** True when the platform asks for reduced motion. Safe to call with no `window` (SSR/node) or no `matchMedia`. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
