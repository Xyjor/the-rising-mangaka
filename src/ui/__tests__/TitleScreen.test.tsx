// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { TitleScreen } from '../TitleScreen'

const g = globalThis as { isTauri?: unknown }

afterEach(() => {
  delete g.isTauri
})

describe('TitleScreen save note', () => {
  it('says the browser keeps the save, one tab at a time', () => {
    render(<TitleScreen />)
    expect(screen.getByText('Saves automatically in this browser (one tab at a time).')).toBeTruthy()
    expect(screen.queryByText('Saves automatically on this computer.')).toBeNull()
  })

  it('says the computer keeps the save in the desktop app', () => {
    g.isTauri = true
    render(<TitleScreen />)
    expect(screen.getByText('Saves automatically on this computer.')).toBeTruthy()
    expect(screen.queryByText('Saves automatically in this browser (one tab at a time).')).toBeNull()
  })
})
