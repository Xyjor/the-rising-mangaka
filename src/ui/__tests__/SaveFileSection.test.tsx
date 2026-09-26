// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { exportSave, importSave } from '../../platform/saveTransfer'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { parseSave, serializeSave } from '../../state/saveFile'
import { useStore } from '../../state/store'
import { OWNER_KEY } from '../../state/tabLock'
import { SaveFileSection } from '../SaveFileSection'

// The file dialogs are replaced: each test says what the player saves or picks.
vi.mock('../../platform/saveTransfer', () => ({ exportSave: vi.fn(), importSave: vi.fn() }))

const g = globalThis as { isTauri?: unknown }
const playing = createGame('Rin', 1)
const st = () => useStore.getState()

/** The text of a save file of `game`, as Export writes it. */
const fileText = (game: GameState, version = 2) =>
  JSON.stringify({ ...JSON.parse(serializeSave({ game, tutorialStep: -1, resumeSpeed: 2 })), version })

/** Click a button and let the dialog's promise and the state updates after it settle. */
async function clickAndSettle(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

beforeEach(() => {
  useStore.setState({
    game: playing, modal: 'settings', readOnly: false, speed: 0, resumeSpeed: 3, toasts: [], tutorialStep: 0,
  })
})
afterEach(() => {
  delete g.isTauri
  localStorage.removeItem(OWNER_KEY)
  vi.clearAllMocks()
})

describe('SaveFileSection copy', () => {
  it('in a browser, says the career lives in this browser', () => {
    render(<SaveFileSection />)
    expect(screen.getByText('Save file')).toBeTruthy()
    expect(screen.getByText(
      'Your career lives in this browser. Export it to back it up or move it to the desktop app.',
    )).toBeTruthy()
    expect(screen.queryByText('Back up your career, or carry it to another computer.')).toBeNull()
  })

  it('in the desktop app, offers a backup or a move to another computer', () => {
    g.isTauri = true
    render(<SaveFileSection />)
    expect(screen.getByText('Back up your career, or carry it to another computer.')).toBeTruthy()
  })
})

describe('Export save file', () => {
  it('exports the game under its file name and says so', async () => {
    vi.mocked(exportSave).mockResolvedValue('saved')
    render(<SaveFileSection />)
    await clickAndSettle('Export save file')

    expect(exportSave).toHaveBeenCalledTimes(1)
    const [fileName, text] = vi.mocked(exportSave).mock.calls[0]
    expect(fileName).toBe('rising-mangaka-rin-month-1.json')
    expect(parseSave(text)).toEqual({ ok: true, save: { game: playing, tutorialStep: 0, resumeSpeed: 3 } })
    expect(screen.getByText('Exported rising-mangaka-rin-month-1.json.')).toBeTruthy()
  })

  it('says nothing when the player cancels the dialog', async () => {
    vi.mocked(exportSave).mockResolvedValue('cancelled')
    render(<SaveFileSection />)
    await clickAndSettle('Export save file')
    expect(screen.queryByText(/Exported/)).toBeNull()
  })

  it('says what to do when the file cannot be written', async () => {
    vi.mocked(exportSave).mockRejectedValue(new Error('access denied'))
    render(<SaveFileSection />)
    await clickAndSettle('Export save file')
    expect(screen.getByRole('alert').textContent).toBe('Could not write the file. Pick another folder and try again.')
  })
})

describe('Load save file', () => {
  const other = { ...createGame('Aoi', 7), day: 336 }

  it('asks before replacing the game being played, and loads on confirm', async () => {
    vi.mocked(importSave).mockResolvedValue(fileText(other))
    render(<SaveFileSection />)
    await clickAndSettle('Load save file…')

    expect(screen.getByText(
      "Load Aoi's save (Year 2, month 1)? It replaces the game you are playing.",
    )).toBeTruthy()
    expect(st().game).toBe(playing)

    fireEvent.click(screen.getByRole('button', { name: 'Load this save' }))
    expect(st().game?.player.name).toBe('Aoi')
    expect(st().game?.day).toBe(336)
    expect(st().modal).toBe('none')
    expect(st().toasts.map((t) => t.text)).toEqual(['Save loaded'])
  })

  it('keeps the game being played when the player says so', async () => {
    vi.mocked(importSave).mockResolvedValue(fileText(other))
    render(<SaveFileSection />)
    await clickAndSettle('Load save file…')
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }))

    expect(st().game).toBe(playing)
    expect(screen.queryByText(/It replaces the game you are playing/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Load save file…' })).toBeTruthy()
  })

  it('does nothing when the player cancels the dialog', async () => {
    vi.mocked(importSave).mockResolvedValue(null)
    render(<SaveFileSection />)
    await clickAndSettle('Load save file…')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Load this save' })).toBeNull()
  })

  const refusals: [string, string, string][] = [
    ['not JSON', 'hello', 'That file is not a Rising Mangaka save. Pick a .json file made with Export save file.'],
    ['not a save', '{"name":"notes"}', 'That file is not a Rising Mangaka save. Pick a .json file made with Export save file.'],
    ['too old', fileText(createGame('Aoi', 7), 1), 'That save comes from an older version of the game and cannot be loaded.'],
    [
      'too new', fileText(createGame('Aoi', 7), 3),
      'That save comes from a newer version of the game. Update the game, then load it again.',
    ],
    [
      'damaged', fileText({ ...createGame('Aoi', 7), log: 'lost' as never }),
      'That save file is damaged. Try another export.',
    ],
  ]
  for (const [why, text, message] of refusals) {
    it(`explains a file that is ${why}, and loads nothing`, async () => {
      vi.mocked(importSave).mockResolvedValue(text)
      render(<SaveFileSection />)
      await clickAndSettle('Load save file…')
      expect(screen.getByRole('alert').textContent).toBe(message)
      expect(st().game).toBe(playing)
    })
  }

  it('says what to do when the file cannot be read', async () => {
    vi.mocked(importSave).mockRejectedValue(new Error('NotReadableError'))
    render(<SaveFileSection />)
    await clickAndSettle('Load save file…')
    expect(screen.getByRole('alert').textContent).toBe('Could not read that file. Try again, or pick another file.')
  })

  it('is off in a read-only tab, which says how to load one; export still works', () => {
    useStore.setState({ readOnly: true })
    render(<SaveFileSection />)
    expect((screen.getByRole('button', { name: 'Load save file…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Take over this tab to load a save.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Export save file' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('turns Load this save off, and says how to load, if the tab turns read-only while it waits', async () => {
    vi.mocked(importSave).mockResolvedValue(fileText(other))
    render(<SaveFileSection />)
    await clickAndSettle('Load save file…')
    act(() => useStore.setState({ readOnly: true, speed: 0 }))

    expect((screen.getByRole('button', { name: 'Load this save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Take over this tab to load a save.')).toBeTruthy()

    // Taking over again turns it back on.
    act(() => useStore.setState({ readOnly: false }))
    expect((screen.getByRole('button', { name: 'Load this save' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('says to take over when the store refuses the load, once, even after the tab turns read-only', async () => {
    vi.mocked(importSave).mockResolvedValue(fileText(other))
    render(<SaveFileSection />)
    await clickAndSettle('Load save file…')
    // Another tab claims the save before this tab's heartbeat has noticed: the button is on, the store says no.
    localStorage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'the-other-tab', at: Date.now() }))
    fireEvent.click(screen.getByRole('button', { name: 'Load this save' }))

    expect(st().game).toBe(playing)
    expect(screen.getByRole('alert').textContent).toBe('Take over this tab to load a save.')
    expect(screen.queryByRole('button', { name: 'Load this save' })).toBeNull()

    act(() => useStore.setState({ readOnly: true, speed: 0 }))
    expect(screen.getAllByText('Take over this tab to load a save.')).toHaveLength(1)
  })

  it('a writable tab has no take-over hint', () => {
    render(<SaveFileSection />)
    expect(screen.queryByText('Take over this tab to load a save.')).toBeNull()
  })
})
