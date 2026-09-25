// Pixel helpers shared by the scene's painters (render.ts, season.ts): a filled rect, and one clipped to the window
// pane so whatever slides past the window disappears behind its frame.

/** The window pane, inside its frame: x 118-161, y 12-43. */
export const PANE_X = 118
export const PANE_Y = 12
export const PANE_W = 44
export const PANE_H = 32
/** The window's vertical bar, x 139-140, drawn over the pane. */
export const BAR_X = 139

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** A rect clipped to the window pane's columns (x 118-161): the frame hides the rest; an empty cut draws nothing. */
export function paneRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const x0 = Math.max(x, PANE_X)
  const x1 = Math.min(x + w, PANE_X + PANE_W)
  if (x1 > x0) rect(ctx, x0, y, x1 - x0, h, color)
}
