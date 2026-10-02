// @vitest-environment happy-dom
//
// happy-dom does no layout (no box model, no viewport media queries), so the phone stacking rule from
// stage.css/hud.css cannot be asserted here by measuring positions or applied styles. Instead this file
// asserts DOM order, which is what the CSS `order`-free phone layout actually depends on (the phone
// rules only reflow flex direction; the flow order below is what a screen reader and a no-CSS render see).
// The visual result — scene band, then the Activity control visible without scrolling at 375x667, then
// the tray, then a horizontally scrolling rail — is confirmed by the manual check recorded in the PR body.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, startProject } from '../../sim'
import { useStore } from '../../state/store'
import { DRAFT } from '../../test/fixtures'
import { App } from '../App'

function setup() {
  const game = startProject(createGame('Rin', 1), DRAFT)
  useStore.setState({
    game, speed: 0, modal: 'none', toasts: [], tutorialStep: -1, readOnly: false,
  })
}

describe('Shell DOM order (phone stacking depends on this)', () => {
  it('orders scene, then the Activity region, then the desk tray, then the rail', () => {
    setup()
    render(<App />)

    const scene = screen.getByRole('group', { name: 'Studio' })
    const region = screen.getByRole('region', { name: 'Current project' })
    const today = within(region).getByRole('group', { name: 'Activity' })
    const tray = screen.getByRole('complementary', { name: 'Desk' })
    const rail = screen.getByRole('navigation', { name: 'Studio menus' })

    expect(scene.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(today.compareDocumentPosition(tray) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tray.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
