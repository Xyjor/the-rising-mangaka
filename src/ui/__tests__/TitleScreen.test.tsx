// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { importSave } from '../../platform/saveTransfer'
import { createGame } from '../../sim'
import { serializeSave } from '../../state/saveFile'
import { useStore } from '../../state/store'
import { TitleScreen } from '../TitleScreen'

// The file dialog is replaced: each test says what the player picks.
vi.mock('../../platform/saveTransfer', () => ({ exportSave: vi.fn(), importSave: vi.fn() }))

const g = globalThis as { isTauri?: unknown }
const st = () => useStore.getState()

beforeEach(() => {
  useStore.setState({ game: null, readOnly: false, speed: 0, modal: 'none', toasts: [], tutorialStep: 0 })
})
afterEach(() => {
  delete g.isTauri
  vi.clearAllMocks()
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

describe('TitleScreen: Load a save file', () => {
  async function load() {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load a save file' }))
    })
  }

  it('loads the picked save straight away, with no game to replace', async () => {
    const saved = { ...createGame('Aoi', 7), day: 60 }
    vi.mocked(importSave).mockResolvedValue(serializeSave({ game: saved, tutorialStep: -1, resumeSpeed: 3 }))
    render(<TitleScreen />)
    await load()
    expect(st().game?.player.name).toBe('Aoi')
    expect(st().game?.day).toBe(60)
    expect(st().tutorialStep).toBe(-1)
    expect(st().resumeSpeed).toBe(3)
    expect(st().toasts.map((t) => t.text)).toEqual(['Save loaded'])
  })

  it('explains a file that is not a save, and stays on the title screen', async () => {
    vi.mocked(importSave).mockResolvedValue('{"name":"notes"}')
    render(<TitleScreen />)
    await load()
    expect(screen.getByRole('alert').textContent).toBe(
      'That file is not a Rising Mangaka save. Pick a .json file made with Export save file.',
    )
    expect(st().game).toBeNull()
  })

  it('is off in a read-only tab, which says how to load one', () => {
    useStore.setState({ readOnly: true })
    render(<TitleScreen />)
    expect((screen.getByRole('button', { name: 'Load a save file' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Take over this tab to load a save.')).toBeTruthy()
  })
})
