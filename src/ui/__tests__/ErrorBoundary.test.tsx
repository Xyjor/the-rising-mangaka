// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import '../../test/dom'
import { exportSave } from '../../platform/saveTransfer'
import { createGame, tickMany } from '../../sim'
import { parseSave, trimLog } from '../../state/saveFile'
import { SAVE_KEY, useStore } from '../../state/store'
import { OWNER_KEY } from '../../state/tabLock'
import { ErrorBoundary } from '../ErrorBoundary'

// The file dialog is replaced: the test reads what the recovery screen exports.
vi.mock('../../platform/saveTransfer', () => ({ exportSave: vi.fn(async () => 'saved'), importSave: vi.fn() }))

/** A component that crashes as it renders. */
function Crash(): never {
  throw new Error('the desk fell over')
}

let reload: Mock<() => void>
let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  reload = vi.fn<() => void>()
  vi.spyOn(window.location, 'reload').mockImplementation(reload)
  // React reports every error a boundary catches on the console; the test keeps the output clean.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  useStore.setState({ game: null, speed: 0, modal: 'none', readOnly: false, windowHidden: false })
  localStorage.removeItem(SAVE_KEY)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders its children while nothing crashes', () => {
    render(<ErrorBoundary><p>The studio</p></ErrorBoundary>)
    expect(screen.getByText('The studio')).toBeTruthy()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('shows the recovery screen when the game crashes, with the error and the way out', () => {
    useStore.setState({ game: createGame('Rin', 42) })
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    expect(screen.getByText('the desk fell over', { exact: false })).toBeTruthy()
    expect(screen.getByText(
      'The game stopped on an error. Your career is still saved: export it to keep a copy, then reopen the game. '
      + 'If the error comes back, start over.',
    )).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export save file' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeTruthy()
  })

  it('offers no export when there is no saved game', () => {
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    expect(screen.getByText(
      'The game stopped on an error. Reopen the game to try again. If the error comes back, start over.',
    )).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Export save file' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeTruthy()
  })

  it('exports the save kept in storage, not the game in the store, and says so', async () => {
    // The store's game is written at once (a new game); storage then holds a different career, as if the store's
    // state were what broke. The file must be storage's.
    useStore.setState({ game: createGame('Rin Hoshino', 42), tutorialStep: 0, resumeSpeed: 1 })
    const stored = trimLog(tickMany(createGame('Aoi Tanaka', 7), 60))
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 2, state: { game: stored, theme: 'auto', resumeSpeed: 2, tutorialStep: -1 },
    }))
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export save file' }))
    })
    expect(exportSave).toHaveBeenCalledTimes(1)
    const [fileName, text] = vi.mocked(exportSave).mock.calls[0]
    expect(fileName).toBe('rising-mangaka-aoi-tanaka-month-3.json')
    expect(parseSave(text)).toEqual({ ok: true, save: { game: stored, tutorialStep: -1, resumeSpeed: 2 } })
    expect(screen.getByText('Exported rising-mangaka-aoi-tanaka-month-3.json.')).toBeTruthy()
  })

  it('says what to do when the export cannot be written', async () => {
    vi.mocked(exportSave).mockRejectedValueOnce(new Error('access denied'))
    useStore.setState({ game: createGame('Rin', 42) })
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export save file' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('Could not write the file. Pick another folder and try again.')
  })

  it('gives the owner a reload too, which keeps the save', () => {
    // In the desktop release build F5 and Ctrl+R are cancelled, so the button is the only way to reload in place.
    useStore.setState({ game: createGame('Rin', 42) })
    const saved = localStorage.getItem(SAVE_KEY)
    expect(saved).not.toBeNull()
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    expect(screen.getByRole('button', { name: 'Start over' })).toBeTruthy()
    // The note about another tab is for a tab that does not own the save.
    expect(screen.queryByText('Another tab holds this save, so reloading here leaves it as it is.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reload the game' }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(SAVE_KEY)).toBe(saved)
    expect(useStore.getState().game?.player.name).toBe('Rin')
  })

  it('Start over, once confirmed, deletes the save and reloads, and nothing writes it back', () => {
    useStore.setState({ game: createGame('Rin', 42) })
    // A tick in the last moment before the crash leaves a write waiting on the debounce.
    useStore.getState().tick()
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
    render(<ErrorBoundary><Crash /></ErrorBoundary>)

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
    expect(reload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete save' }))

    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
    // The page going away flushes any waiting write, and a hidden page updates the store: neither brings it back.
    window.dispatchEvent(new Event('pagehide'))
    document.dispatchEvent(new Event('visibilitychange'))
    useStore.getState().setWindowHidden(true)
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('in a tab that does not own the save, offers a reload in place of Start over, and keeps the save', () => {
    useStore.setState({ game: createGame('Rin', 42) })
    const saved = localStorage.getItem(SAVE_KEY)
    expect(saved).not.toBeNull()
    const ours = localStorage.getItem(OWNER_KEY)
    localStorage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'the-other-tab', at: Date.now() }))
    try {
      render(<ErrorBoundary><Crash /></ErrorBoundary>)
      expect(screen.getByText('The game stopped on an error in this tab. Reload it to try again.')).toBeTruthy()
      expect(screen.getByText('Another tab holds this save, so reloading here leaves it as it is.')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull()
      expect(screen.queryByText(/Deletes this save/)).toBeNull()
      // The stored save can still be exported from here.
      expect(screen.getByRole('button', { name: 'Export save file' })).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Reload the game' }))
      expect(reload).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem(SAVE_KEY)).toBe(saved)
      expect(useStore.getState().game?.player.name).toBe('Rin')
    } finally {
      if (ours) localStorage.setItem(OWNER_KEY, ours)
      else localStorage.removeItem(OWNER_KEY)
    }
  })
})
