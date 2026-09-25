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
