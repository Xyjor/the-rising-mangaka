// Small deterministic PRNG helpers (mulberry32 style). State-carrying, no globals.

export function nextSeed(seed: number): number {
  return (seed + 0x6d2b79f5) | 0
}

export function seedFloat(seed: number): number {
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Draw n floats in [0,1). Returns the values and the advanced seed. */
export function draw(seed: number, n: number): { values: number[]; seed: number } {
  const values: number[] = []
  let s = seed
  for (let i = 0; i < n; i++) {
    s = nextSeed(s)
    values.push(seedFloat(s))
  }
  return { values, seed: s }
}

/** Uniform float in [min, max) from a unit float. */
export function range(u: number, min: number, max: number): number {
  return min + u * (max - min)
}

/** Approximately normal (mean 0, sd 1) from two unit floats. */
export function gaussian(u1: number, u2: number): number {
  const a = Math.max(u1, 1e-9)
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u2)
}

/** FNV-1a 32-bit string hash. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Three integers hashed to one unsigned 32-bit integer (a salted mix, then a murmur3-style finaliser). */
export function mix(a: number, b: number, c: number): number {
  let h = 0x2545f491 ^ Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae3d)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) >>> 0
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Standard normal CDF, Abramowitz and Stegun 26.2.17 (error under 7.5e-8). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}
