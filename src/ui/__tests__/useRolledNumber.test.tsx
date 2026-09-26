// @vitest-environment happy-dom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { rollClock, useRolledNumber } from '../hooks/useRolledNumber'

const realClock = { ...rollClock }
let now = 0
let frame: FrameRequestCallback | null = null
let restore: () => void = () => {}

beforeEach(() => {
  now = 0
  frame = null
  rollClock.now = () => now
  rollClock.raf = (cb) => { frame = cb; return 1 }
  rollClock.caf = () => { frame = null }
  restore = stubReducedMotion(false)
})

afterEach(() => {
  Object.assign(rollClock, realClock)
  restore()
})

function Shown({ value }: { value: number }) {
  return <span data-testid="n">{useRolledNumber(value)}</span>
}

function fire(at: number) {
  now = at
  const cb = frame
  frame = null
  act(() => cb?.(at))
}

describe('useRolledNumber', () => {
  it('shows the first value at once, then eases to a new one', () => {
    const { rerender } = render(<Shown value={100} />)
    expect(screen.getByTestId('n').textContent).toBe('100')
    rerender(<Shown value={200} />)
    expect(screen.getByTestId('n').textContent).toBe('100')
    expect(frame).not.toBeNull()
    fire(250)
    expect(screen.getByTestId('n').textContent).toBe('188')
    fire(500)
    expect(screen.getByTestId('n').textContent).toBe('200')
    expect(frame).toBeNull()
  })

  it('jumps straight to the new value under reduced motion', () => {
    restore()
    restore = stubReducedMotion(true)
    const { rerender } = render(<Shown value={100} />)
    rerender(<Shown value={200} />)
    expect(screen.getByTestId('n').textContent).toBe('200')
  })
})
