/**
 * Shared assistant look palette: the studio canvas and the Staff modal's avatars index these by
 * `Assistant.look` (the engine draws 0..5), so the same person wears the same shirt everywhere.
 * Raw hex is deliberate here: these are sprite colours, not UI tokens, and must match the canvas.
 */
export const LOOK_SHIRTS = ['#3b6fd6', '#c94b4b', '#3fa66c', '#7c4dff', '#e07b39', '#2b8a9e'] as const
export const LOOK_HAIRS = ['#2b2140', '#5a3a1e', '#1b1b1b', '#7a2e2e', '#3b3b45', '#8c6a3f'] as const

if (import.meta.env.DEV && LOOK_SHIRTS.length !== LOOK_HAIRS.length) {
  console.warn('looks.ts: shirt and hair palettes differ in length')
}
