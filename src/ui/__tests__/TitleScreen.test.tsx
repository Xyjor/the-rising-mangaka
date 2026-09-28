// @vitest-environment happy-dom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { exportSave, importSave } from '../../platform/saveTransfer'
import { createGame } from '../../sim'
import { serializeSave, trimLog } from '../../state/saveFile'
import { LEGACY_SAVE_KEY, slotKey } from '../../state/slots'
import { useStore } from '../../state/store'
import { OWNER_KEY, isOwner } from '../../state/tabLock'
import { withPendingResult } from '../../test/fixtures'
import { TITLE_ART } from '../art/registry'
import { TitleScreen } from '../TitleScreen'

// The file dialog is replaced: each test says what the player picks.
vi.mock('../../platform/saveTransfer', () => ({ exportSave: vi.fn(async () => 'saved'), importSave: vi.fn() }))

const g = globalThis as { isTauri?: unknown }
const st = () => useStore.getState()

/** Another tab's fresh owner stamp: this tab does not own the save. */
const stampOtherTab = () =>
  localStorage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'the-other-tab', at: Date.now() }))

/** Puts a career in slot `n`, as the store writes one. */
function fill(n: 1 | 2 | 3, name = 'Rin') {
  const game = { ...withPendingResult(), player: { ...withPendingResult().player, name, money: 12500, fans: 340 } }
  localStorage.setItem(slotKey(n), JSON.stringify({ version: 2, state: { game: trimLog(game), tutorialStep: -1, resumeSpeed: 1 } }))
}

const slot = (n: number) => screen.getByRole('listitem', { name: `Slot ${n}` })

beforeEach(() => {
  localStorage.removeItem(OWNER_KEY)
  for (const n of [1, 2, 3] as const) localStorage.removeItem(slotKey(n))
  useStore.setState({ game: null, readOnly: false, speed: 0, modal: 'none', toasts: [], tutorialStep: 0 })
  st().backToTitle()
})
afterEach(() => {
  delete g.isTauri
  localStorage.removeItem(OWNER_KEY)
  vi.clearAllMocks()
})

describe('TitleScreen hero art', () => {
  it('renders the hero image and still starts a game', () => {
    render(<TitleScreen />)
    const hero = screen.getByAltText("A mangaka's rooftop at golden hour") as HTMLImageElement
    expect(hero.src).toContain(TITLE_ART.src)
    expect(hero.width).toBe(TITLE_ART.w)
    expect(hero.height).toBe(TITLE_ART.h)
    // The hero-only scrim/layout styling is scoped to .has-hero, which only this screen sets (the crash
    // recovery screen reuses .title-screen with no hero and must not get it).
    expect(document.querySelector('.title-screen')?.classList.contains('has-hero')).toBe(true)

    fireEvent.change(within(slot(1)).getByPlaceholderText('e.g. Rin Hoshino'), { target: { value: 'Aoi' } })
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Start a new career here' }))
    expect(st().game?.player.name).toBe('Aoi')
    expect(st().activeSlot).toBe(1)
  })
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

describe('TitleScreen slots', () => {
  it('shows three slots: an empty one offers a pen name and a new career', () => {
    render(<TitleScreen />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const empty = within(slot(2))
    expect(empty.getByPlaceholderText('e.g. Rin Hoshino')).toBeTruthy()
    expect(empty.getByRole('button', { name: 'Start a new career here' })).toBeTruthy()
    expect(empty.queryByRole('button', { name: 'Continue' })).toBeNull()
  })

  it('a filled slot shows its summary and continues the career there', () => {
    fill(2, 'Mika')
    render(<TitleScreen />)
    const card = within(slot(2))
    expect(card.getByText('Mika')).toBeTruthy()
    expect(card.getByText('Month 1, ¥12,500, 340 fans')).toBeTruthy()
    expect(card.getByText('No serial running')).toBeTruthy()
    expect(card.getByRole('button', { name: 'Export save file' })).toBeTruthy()
    fireEvent.click(card.getByRole('button', { name: 'Continue' }))
    expect(st().activeSlot).toBe(2)
    expect(st().game?.player.name).toBe('Mika')
  })

  it('exports the slot as a save file', async () => {
    fill(3, 'Mika')
    render(<TitleScreen />)
    await act(async () => { fireEvent.click(within(slot(3)).getByRole('button', { name: 'Export save file' })) })
    expect(vi.mocked(exportSave).mock.calls[0][0]).toMatch(/^rising-mangaka-mika-month-1\.json$/)
  })

  it('deletes a career only after the confirmation, and never the old save', () => {
    localStorage.setItem(LEGACY_SAVE_KEY, 'old')
    fill(1)
    render(<TitleScreen />)
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Delete this career' }))
    expect(localStorage.getItem(slotKey(1))).not.toBeNull()
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Keep it' }))
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Delete this career' }))
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Yes, delete this career' }))
    expect(localStorage.getItem(slotKey(1))).toBeNull()
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBe('old')
    expect(within(slot(1)).getByRole('button', { name: 'Start a new career here' })).toBeTruthy()
    localStorage.removeItem(LEGACY_SAVE_KEY)
  })

  it('loading a file into a filled slot asks first, and can be kept', async () => {
    fill(1, 'Mika')
    vi.mocked(importSave).mockResolvedValue(serializeSave({ game: createGame('Aoi', 7), tutorialStep: -1, resumeSpeed: 1 }))
    render(<TitleScreen />)
    await act(async () => { fireEvent.click(within(slot(1)).getByRole('button', { name: 'Load a save file into this slot' })) })
    expect(within(slot(1)).getByText(/Load Aoi's save \(Month 1\) into this slot\? It replaces Mika's career\./)).toBeTruthy()
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Keep this career' }))
    expect(within(slot(1)).getByText('Mika')).toBeTruthy()

    await act(async () => { fireEvent.click(within(slot(1)).getByRole('button', { name: 'Load a save file into this slot' })) })
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Yes, replace it' }))
    expect(within(slot(1)).getByText('Aoi')).toBeTruthy()
    expect(st().game).toBeNull()
  })

  it('loads a file straight into an empty slot, and explains a file that is not a save', async () => {
    vi.mocked(importSave).mockResolvedValue(serializeSave({ game: createGame('Aoi', 7), tutorialStep: -1, resumeSpeed: 1 }))
    render(<TitleScreen />)
    await act(async () => { fireEvent.click(within(slot(3)).getByRole('button', { name: 'Load a save file into this slot' })) })
    expect(within(slot(3)).getByText('Aoi')).toBeTruthy()

    vi.mocked(importSave).mockResolvedValue('{"name":"notes"}')
    await act(async () => { fireEvent.click(within(slot(2)).getByRole('button', { name: 'Load a save file into this slot' })) })
    expect(within(slot(2)).getByRole('alert').textContent).toBe(
      'That file is not a Rising Mangaka save. Pick a .json file made with Export save file.',
    )
  })

  it('slot actions are off in a read-only tab, which says how to take over', () => {
    fill(1)
    useStore.setState({ readOnly: true })
    render(<TitleScreen />)
    expect((within(slot(1)).getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(slot(1)).queryByRole('button', { name: 'Delete this career' })).toBeNull()
    expect((within(slot(2)).getByRole('button', { name: 'Start a new career here' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Take over this tab to load a save.')).toBeTruthy()
  })

  it('a read-only tab has the take-over control, which makes it the owner and turns the slots on', () => {
    stampOtherTab()
    useStore.setState({ readOnly: true })
    render(<TitleScreen />)
    expect(isOwner()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Take over' }))
    expect(isOwner()).toBe(true)
    expect(st().readOnly).toBe(false)
    expect((within(slot(2)).getByRole('button', { name: 'Start a new career here' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a tab that does not own the save yet is told to take over', () => {
    // The heartbeat has not flagged the tab read-only yet, so the button is on, but the store refuses.
    stampOtherTab()
    render(<TitleScreen />)
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Start a new career here' }))
    expect(st().game).toBeNull()
    expect(within(slot(1)).getByRole('alert').textContent).toBe('Take over this tab to load a save.')
  })
})
