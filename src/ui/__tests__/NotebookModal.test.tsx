// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { installSound, nullEngine } from '../../audio/instance'
import { createGame } from '../../sim'
import { createFakeSound } from '../../test/fakeSound'
import { useStore } from '../../state/store'
import { NotebookModal } from '../panels/NotebookModal'

// 10 genres x 12 themes = 120 pairings; 12 themes x 4 audiences = 48 (src/sim/data.ts).
beforeEach(() => {
  useStore.setState({ game: createGame('Test', 1), readOnly: false })
})
afterEach(() => installSound(nullEngine))

describe('NotebookModal', () => {
  it('switches between the two grids through title-bar tabs', () => {
    const sound = createFakeSound()
    installSound(sound)
    const { container } = render(<NotebookModal />)
    const list = screen.getByRole('tablist', { name: 'Notebook sections' })
    const gt = within(list).getByRole('tab', { name: 'Genre × Theme (0/120)' })
    const ta = within(list).getByRole('tab', { name: 'Theme × Audience (0/48)' })
    expect(gt.getAttribute('aria-selected')).toBe('true')
    expect(container.ownerDocument.querySelectorAll('.nb-cell')).toHaveLength(120)
    fireEvent.click(ta)
    expect(container.ownerDocument.querySelectorAll('.nb-cell')).toHaveLength(48)
    const hdrs = [...container.ownerDocument.querySelectorAll('.nb-grid .hdr.col')].map((e) => e.textContent)
    expect(hdrs).toEqual(['Kids', 'Teens', 'Young Adults', 'Adults'])
    expect(sound.plays).toEqual(['open', 'tab'])
  })
})
