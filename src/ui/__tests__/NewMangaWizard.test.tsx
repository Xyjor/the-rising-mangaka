// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame } from '../../sim'
import { useStore } from '../../state/store'
import { NewMangaWizard } from '../panels/NewMangaWizard'
import { GENRE_ART, THEME_ART } from '../art/registry'

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), tutorialStep: -1, readOnly: false })
})

/** Genre, theme and audience picked: the wizard stands on the title step. */
function toTitleStep() {
  render(<NewMangaWizard />)
  fireEvent.click(screen.getByRole('button', { name: /Action/ }))
  fireEvent.click(screen.getByRole('button', { name: /Samurai/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Teens/ }))
}

describe('NewMangaWizard', () => {
  it('the title step shows the title field beside what you know', () => {
    toTitleStep()
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('textbox')).toBeTruthy()
    expect(dialog.getByText('What you know')).toBeTruthy()
    expect(dialog.getByText('Freshness')).toBeTruthy()
    expect(dialog.getByText('Audience fit')).toBeTruthy()
  })

  it('the step strip marks Title current and the three answered steps done', () => {
    toTitleStep()
    const nav = document.querySelector('nav[aria-label="Steps"]')!
    const buttons = within(nav as HTMLElement).getAllByRole('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[3].textContent).toBe('Title')
    expect(buttons[3].getAttribute('aria-current')).toBe('step')
    expect(buttons.slice(0, 3).map((b) => b.getAttribute('data-done'))).toEqual(['true', 'true', 'true'])
    expect(buttons.slice(0, 3).map((b) => b.getAttribute('aria-current'))).toEqual([null, null, null])
  })

  it('the title step content sits in the two-column title-step wrapper', () => {
    toTitleStep()
    const wrap = document.querySelector('.title-step')
    expect(wrap).not.toBeNull()
    expect(wrap!.querySelector('input')).not.toBeNull()
    expect(wrap!.querySelector('.know.card.flat')).not.toBeNull()
  })
})

describe('NewMangaWizard art', () => {
  it('puts each genre and theme icon on its choice card', () => {
    render(<NewMangaWizard />)
    expect(document.querySelector(`.choice img[src="${GENRE_ART.action!.src}"]`)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Action/ }))
    expect(document.querySelector(`.choice img[src="${THEME_ART.samurai.src}"]`)).not.toBeNull()
  })
  it('gives every genre card, slice of life included, its art tile', () => {
    render(<NewMangaWizard />)
    const tiles = [...document.querySelectorAll('.choice .choice-art')]
    expect(tiles).toHaveLength(10)
    expect(document.querySelector('.art-fallback')).toBeNull()
    const slice = screen.getByRole('button', { name: /Slice of Life/ })
    expect(slice.querySelector(`.choice-art img[src="${GENRE_ART.slice.src}"]`)).not.toBeNull()
  })
})
