// Scene pixels to CSS pixels: the 320x180 canvas is cover-fit (object-fit: cover) inside the scene wrap, so DOM overlays
// such as speech bubbles are placed with the same scale and the same centred overflow.
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { H, W } from './render'

export interface CssPoint { left: number; top: number }

/** Where scene point (x, y) lands inside a wrap of this size. {0,0} before the wrap is measured. */
export function sceneToCss(wrap: { width: number; height: number }, x: number, y: number): CssPoint {
  if (wrap.width <= 0 || wrap.height <= 0) return { left: 0, top: 0 }
  const scale = Math.max(wrap.width / W, wrap.height / H)
  return {
    left: (wrap.width - W * scale) / 2 + x * scale,
    top: (wrap.height - H * scale) / 2 + y * scale,
  }
}

/** The element's size, kept current by a ResizeObserver (a one-time read where there is none). {0,0} until measured. */
export function useSceneRect(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [rect, setRect] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = (width: number, height: number) =>
      setRect((r) => (r.width === width && r.height === height ? r : { width, height }))
    const box = el.getBoundingClientRect()
    read(box.width, box.height)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const e = entries[entries.length - 1]
      if (e) read(e.contentRect.width, e.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return rect
}
