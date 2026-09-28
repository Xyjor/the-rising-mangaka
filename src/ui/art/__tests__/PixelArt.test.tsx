// @vitest-environment happy-dom
import '../../../test/dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PixelArt } from '../PixelArt'
import type { ArtRef } from '../registry'

const ref: ArtRef = { id: 'title/hero', src: '/assets/title-hero.png', w: 320, h: 180 }

describe('PixelArt', () => {
  it('renders an img at the scaled size with the pixel-art class and given alt', () => {
    render(<PixelArt art={ref} scale={2} alt="Title art" />)
    const img = screen.getByAltText('Title art') as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.src).toContain(ref.src)
    expect(img.width).toBe(640)
    expect(img.height).toBe(360)
    expect(img.className).toContain('pixel-art')
    expect(img.loading).toBe('lazy')
    expect(img.getAttribute('draggable')).toBe('false')
  })

  it('defaults to scale 1 and empty alt, and appends an extra className', () => {
    render(<PixelArt art={ref} className="extra" />)
    const img = document.querySelector('img') as HTMLImageElement
    expect(img.width).toBe(320)
    expect(img.height).toBe(180)
    expect(img.alt).toBe('')
    expect(img.className).toBe('pixel-art extra')
  })
})
