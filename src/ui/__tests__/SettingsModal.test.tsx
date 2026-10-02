// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { DEFAULT_SOUND } from '../../audio/types'
import { installSound, nullEngine } from '../../audio/instance'
import { createGame } from '../../sim'
import { useStore } from '../../state/store'
import { createFakeSound } from '../../test/fakeSound'
import { SettingsModal } from '../panels/SettingsModal'

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), theme: 'auto', modal: 'settings', readOnly: false, sound: DEFAULT_SOUND })
})

afterEach(() => {
  installSound(nullEngine)
})

describe('SettingsModal', () => {
  it('switches the theme when a segment button is clicked, updating aria-pressed', () => {
    render(<SettingsModal />)
    const dark = screen.getByRole('button', { name: 'Dark' })
    const auto = screen.getByRole('button', { name: 'Auto' })

    fireEvent.click(dark)

    expect(useStore.getState().theme).toBe('dark')
    expect(dark.getAttribute('aria-pressed')).toBe('true')
    expect(auto.getAttribute('aria-pressed')).toBe('false')
  })

  it('mutes on click, setting sound.muted and aria-pressed, and unmutes on a second click', () => {
    render(<SettingsModal />)
    const mute = screen.getByRole('button', { name: 'Mute sound' })
    expect(mute.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(mute)

    expect(useStore.getState().sound.muted).toBe(true)
    expect(mute.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(mute)

    expect(useStore.getState().sound.muted).toBe(false)
    expect(mute.getAttribute('aria-pressed')).toBe('false')
  })

  it('the volume slider spans 0-100 in steps of 5', () => {
    render(<SettingsModal />)
    const slider = screen.getByRole('slider', { name: 'Volume' })

    expect(slider.getAttribute('min')).toBe('0')
    expect(slider.getAttribute('max')).toBe('100')
    expect(slider.getAttribute('step')).toBe('5')
  })

  it('moving the volume slider sets volume and previews the change with a click cue', () => {
    const fake = createFakeSound()
    installSound(fake)
    render(<SettingsModal />)
    const slider = screen.getByRole('slider', { name: 'Volume' })

    fireEvent.change(slider, { target: { value: '80' } })

    expect(useStore.getState().sound.volume).toBe(0.8)
    expect(fake.plays).toContain('click')
  })

  it('moving the slider while muted unmutes', () => {
    useStore.setState({ sound: { ...DEFAULT_SOUND, muted: true } })
    render(<SettingsModal />)
    const slider = screen.getByRole('slider', { name: 'Volume' })

    fireEvent.change(slider, { target: { value: '60' } })

    expect(useStore.getState().sound.muted).toBe(false)
  })

  it('shows "Off" in the volume readout while muted, and the percentage otherwise', () => {
    render(<SettingsModal />)
    const slider = screen.getByRole('slider', { name: 'Volume' })
    expect(screen.getByText('50%', { selector: 'span' })).toBeTruthy()
    expect(slider.getAttribute('aria-valuetext')).toBe('50%')

    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }))

    expect(screen.getByText('Off', { selector: 'span' })).toBeTruthy()
    expect(slider.getAttribute('aria-valuetext')).toBe('Off')
  })

  it('sets music off via the Music segment', () => {
    render(<SettingsModal />)
    const off = screen.getByRole('group', { name: 'Music' }).querySelector('button:last-child') as HTMLButtonElement
    expect(off.textContent).toBe('Off')

    fireEvent.click(off)

    expect(useStore.getState().sound.music).toBe(false)
    expect(off.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('SettingsModal keyboard list', () => {
  const g = globalThis as { isTauri?: unknown }
  afterEach(() => {
    delete g.isTauri
  })

  /** The key hints in the keyboard list, each with its description. */
  const keyRows = () =>
    [...document.querySelectorAll('.kbd')].map((k) => [k.textContent, k.nextElementSibling?.textContent])

  it('lists F11 for full screen in the desktop app', () => {
    g.isTauri = true
    render(<SettingsModal />)
    expect(keyRows()).toContainEqual(['F11', 'Full screen'])
  })

  it('has no full-screen row in a browser, which has its own F11', () => {
    render(<SettingsModal />)
    expect(keyRows().map(([k]) => k)).not.toContain('F11')
    expect(screen.queryByText('Full screen')).toBeNull()
  })
})

describe('SettingsModal save file', () => {
  it('has the Save file section with export and load', () => {
    render(<SettingsModal />)
    expect(screen.getByText('Save file')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export save file' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load save file…' })).toBeTruthy()
  })
  it('goes back to the title screen after a confirmation, keeping the career in its slot', () => {
    render(<SettingsModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to the title screen' }))
    expect(useStore.getState().game).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, go to the title screen' }))
    expect(useStore.getState().game).toBeNull()
    expect(useStore.getState().activeSlot).toBeNull()
    expect(localStorage.getItem('rising-mangaka-save-1')).toContain('"Rin"')
  })
})

describe('SettingsModal help', () => {
  it('replays the tutorial from the phase’s first step, closing the window', () => {
    useStore.setState({ tutorialStep: -1, speed: 0 })
    render(<SettingsModal />)
    expect(screen.getByText('The editor walks you through a one-shot again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Replay the tutorial' }))
    expect(useStore.getState().tutorialStep).toBe(0)
    expect(useStore.getState().modal).toBe('none')
  })

  it('has no replay button in a read-only tab', () => {
    useStore.setState({ readOnly: true })
    render(<SettingsModal />)
    expect(screen.queryByRole('button', { name: 'Replay the tutorial' })).toBeNull()
  })

  it('offers to skip the tutorial next to Replay while a step is open', () => {
    useStore.setState({ tutorialStep: 3 })
    render(<SettingsModal />)
    expect(screen.getByRole('button', { name: 'Replay the tutorial' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip the tutorial' }))
    expect(useStore.getState().tutorialStep).toBe(-1)
    expect(screen.queryByRole('button', { name: 'Skip the tutorial' })).toBeNull()
  })

  it('has no skip button once the tutorial is done, or in a read-only tab', () => {
    useStore.setState({ tutorialStep: -1 })
    const { unmount } = render(<SettingsModal />)
    expect(screen.queryByRole('button', { name: 'Skip the tutorial' })).toBeNull()
    unmount()
    useStore.setState({ tutorialStep: 3, readOnly: true })
    render(<SettingsModal />)
    expect(screen.queryByRole('button', { name: 'Skip the tutorial' })).toBeNull()
    expect(useStore.getState().tutorialStep).toBe(3)
  })
})
