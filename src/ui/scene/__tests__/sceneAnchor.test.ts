import { describe, expect, it } from 'vitest'
import { sceneToCss } from '../sceneAnchor'

describe('sceneToCss', () => {
  it('scales an exact 2x wrap', () => {
    expect(sceneToCss({ width: 640, height: 360 }, 204, 102)).toEqual({ left: 408, top: 204 })
  })
  it('covers a wider wrap: scale by width, the height overflows centred', () => {
    // scale = max(375/320, 200/180) = 1.171875; drawn height 210.9375, offset -5.46875
    expect(sceneToCss({ width: 375, height: 200 }, 160, 90)).toEqual({ left: 187.5, top: 100 })
  })
  it('covers a taller wrap: scale by height, the width overflows centred', () => {
    // scale = 2; drawn width 640, offset -160
    expect(sceneToCss({ width: 320, height: 360 }, 160, 90)).toEqual({ left: 160, top: 180 })
    expect(sceneToCss({ width: 320, height: 360 }, 24, 0)).toEqual({ left: -112, top: 0 })
  })
  it('is the origin before the wrap is measured', () => {
    expect(sceneToCss({ width: 0, height: 0 }, 160, 90)).toEqual({ left: 0, top: 0 })
  })
})
