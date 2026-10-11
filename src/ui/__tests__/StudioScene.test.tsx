// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { fakeContext, fakeSurface } from '../../test/fakeCanvas'
import type { FakeContext } from '../../test/fakeCanvas'
import { installSound, nullEngine } from '../../audio/instance'
import { acceptOffer, chapterDeadline, createGame } from '../../sim'
import { createFakeSound } from '../../test/fakeSound'
import type { FakeSound } from '../../test/fakeSound'
import { withPendingResult } from '../../test/fixtures'
import type { GameState } from '../../sim'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { StudioScene } from '../scene/StudioScene'
import { animLength } from '../scene/animation'
import { VERDICT_HOLD_SLACK_MS } from '../scene/castPlay'
import { ANIMS } from '../scene/rig/anims'
import { createSpriteCache, installCastCache } from '../scene/spriteCache'

const PETAL = '#f7b6c8'
const SNOW = '#f4f8ff'
/** One fill from each piece of studio art (studioArt.ts): the noren, the coffee machine, a trophy, the arm lamp. */
const NOREN = { style: '#2e3a78', x: 260, y: 58, w: 13, h: 13 }
const COFFEE = { style: '#3b3b45', x: 183, y: 73, w: 7, h: 7 }
const TROPHY = { style: '#f5b700', x: 194, y: 74, w: 3, h: 3 }
const LAMP_SHADE = { style: '#e8e4d8', x: 157, y: 80, w: 6, h: 2 }

let fake: FakeContext
let restoreMotion: () => void
let game: GameState

beforeEach(() => {
  // Under reduced motion the component repaints at once on a state change, so a test reads the paint synchronously.
  restoreMotion = stubReducedMotion(true)
  fake = fakeContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake.ctx as never)
  // a cache whose surfaces are recording images: happy-dom paints no canvas, and `fake.images` names each cast frame drawn
  installCastCache(createSpriteCache(fakeSurface))
  game = createGame('Rin', 1)
  useStore.setState({ game, speed: 0, modal: 'none', toasts: [], tutorialStep: -1, readOnly: false })
  useClock.setState({ t: 0.3 })
})

afterEach(() => {
  vi.restoreAllMocks()
  restoreMotion()
  installCastCache(null)
})

describe('StudioScene', () => {
  it('paints the season of the game day in the window', () => {
    render(<StudioScene running={false} />)

    act(() => useStore.setState({ game: { ...game, day: 260 } }))
    expect(fake.log.some((c) => c.style === SNOW)).toBe(true)
    expect(fake.log.some((c) => c.style === PETAL)).toBe(false)

    fake.log.length = 0
    act(() => useStore.setState({ game: { ...game, day: 336 + 20 } }))
    expect(fake.log.some((c) => c.style === PETAL)).toBe(true)
    expect(fake.log.some((c) => c.style === SNOW)).toBe(false)
  })

  it('paints the studio the player has built, and repaints when it changes', () => {
    render(<StudioScene running={false} />)

    const built: GameState = { ...game, studio: { tier: 'flat', owned: ['coffee'] }, awards: [{ id: 'rookie', year: 1 }] }
    act(() => useStore.setState({ game: built }))
    expect(fake.log).toContainEqual(NOREN)
    expect(fake.log).toContainEqual(COFFEE)
    expect(fake.log).toContainEqual(TROPHY)
    expect(fake.log).not.toContainEqual(LAMP_SHADE)

    fake.log.length = 0
    act(() => useStore.setState({ game: { ...built, studio: { tier: 'flat', owned: ['coffee', 'lamp'] } } }))
    expect(fake.log).toContainEqual(LAMP_SHADE)
  })

  it('reads the studio field by field: a new game object with the same studio does not repaint', () => {
    render(<StudioScene running={false} />)
    fake.log.length = 0

    act(() => useStore.setState({ game: { ...game } }))
    expect(fake.log).toHaveLength(0)

    act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
    expect(fake.log).toContainEqual(NOREN)
  })

  it('keeps the frame loop alive while a modal covers the scene', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    useStore.setState({ modal: 'studio' })
    render(<StudioScene running={false} />)

    expect(raf).toHaveBeenCalled()

    fake.log.length = 0
    act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
    expect(fake.log).toContainEqual(NOREN)
  })

  it('panics the seated mangaka when the serial chapter is late (frame 0 under reduced motion)', () => {
    const offer = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
    const s = acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer })
    const late: GameState = { ...s, activity: 'work', serial: { ...s.serial!, nextDueDay: s.day - 1 } }
    expect(chapterDeadline(late)?.status).toBe('late')
    render(<StudioScene running />)
    fake.log.length = 0
    fake.images.length = 0
    act(() => useStore.setState({ game: late }))
    // the panic frame (the late loop's first step), drawn at the seat (124, 58)
    const panic = (i: { id: string; x: number; y: number }) => i.id === 'cast/key.panic-0/pal' && i.x === 124 && i.y === 58
    expect(fake.images.some(panic)).toBe(true)
    fake.log.length = 0
    fake.images.length = 0
    act(() => useStore.setState({ game: { ...late, serial: { ...late.serial!, nextDueDay: late.day + 60 } } }))
    expect(fake.log.length).toBeGreaterThan(0)
    expect(fake.images.some((i) => i.id === 'cast/seat.draw-a~open.closed.none/pal' && i.x === 124 && i.y === 58)).toBe(true)
    expect(fake.images.some(panic)).toBe(false)
  })

  it('drives the cast: the mangaka drawn from its base pose at the 0.11 standing spot', () => {
    render(<StudioScene running={false} />)
    act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
    expect(fake.images.some((i) => i.id === 'cast/stand.idle~open.closed.none/pal' && i.x === 170 && i.y === 81)).toBe(true)
  })

  it('cheers when a good one-shot result is dismissed', () => {
    restoreMotion()
    restoreMotion = stubReducedMotion(false)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    try {
      const pending = withPendingResult()
      const good: GameState = { ...pending, pendingResult: { ...pending.pendingResult!, rank: 1 } }
      useStore.setState({ game: good })
      render(<StudioScene running={false} />)
      vi.advanceTimersByTime(3000) // the editor walks in; everyone settles
      fake.images.length = 0
      act(() => useStore.setState({ game: { ...good, pendingResult: null } }))
      vi.advanceTimersByTime(120)
      expect(fake.images.some((i) => i.id.startsWith('cast/key.cheer-stand-'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  describe('the editor visits', () => {
    let sound: FakeSound
    const editorHere = () => fake.images.some((i) => i.id.startsWith('cast/editor.') && i.x === 205 && i.y === 90)
    beforeEach(() => { sound = createFakeSound(); installSound(sound) })
    afterEach(() => { installSound(nullEngine) })

    it('knocks once when the editor arrives with the results, and paints them at the spot', () => {
      render(<StudioScene running={false} />)
      fake.log.length = 0
      fake.images.length = 0
      const pending = withPendingResult()
      act(() => useStore.setState({ game: pending }))
      expect(sound.plays).toEqual(['knock'])
      expect(editorHere()).toBe(true)
      act(() => useStore.setState({ game: { ...pending, day: pending.day } }))
      expect(sound.plays).toEqual(['knock'])
    })

    it('draws the editor from the rig at the spot with the envelope, knocking once', () => {
      render(<StudioScene running={false} />)
      act(() => useStore.setState({ game: withPendingResult() }))
      expect(sound.plays).toEqual(['knock'])
      expect(fake.images.some((i) => i.id.startsWith('cast/editor.stand') && i.x === 205 && i.y === 90)).toBe(true)
      expect(fake.images.some((i) => i.id === 'cast/prop.envelope/editor')).toBe(true)
    })

    it('sighs at a bad result when it is dismissed, staying at the spot while it plays (the hold, decision 14)', () => {
      restoreMotion()
      restoreMotion = stubReducedMotion(false)
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      // the editor's frames are his (the cat's and the props' are not); where each was drawn
      const editorAt = () => fake.images.filter((i) => i.id.startsWith('cast/editor.')).map((i) => [i.x, i.y])
      // the editor's frame ids drawn (`cast/<frame id>/<palette>`): the pose and its face
      const drawnPoses = () => fake.images.filter((i) => i.id.startsWith('cast/editor.')).map((i) => i.id.split('/')[1])
      const sigh = animLength(ANIMS['editor-sigh'])
      try {
        const pending = withPendingResult()
        // rank 9 of 12: the bottom third (9 x 3 > 12 x 2), the corkboard's 'low'
        const bad: GameState = { ...pending, pendingResult: { ...pending.pendingResult!, rank: 9, entrants: 12 } }
        useStore.setState({ game: bad })
        render(<StudioScene running={false} />)
        vi.advanceTimersByTime(3000) // the editor walks in; everyone settles
        fake.images.length = 0
        act(() => useStore.setState({ game: { ...bad, pendingResult: null } }))
        vi.advanceTimersByTime(sigh - 100)
        // the sigh plays at the spot although the plan sent him to the door: he never stepped off it
        expect(editorAt().length).toBeGreaterThan(0)
        expect(editorAt().every(([x, y]) => x === 205 && y === 90)).toBe(true)
        // the sigh's two drawn poses (task 10): the shoulders a row down, then two, the eyes closed, the mouth down
        expect(sigh).toBe(1200)
        expect(drawnPoses()).toEqual(expect.arrayContaining(['editor.sigh-a~closed.frown.none', 'editor.sigh-b~closed.frown.none']))
        fake.images.length = 0
        vi.advanceTimersByTime(VERDICT_HOLD_SLACK_MS + 500)
        // the hold ran out: the turn toward the door, then the walk, off the spot
        expect(editorAt().some(([x]) => x > 205)).toBe(true)
        expect(drawnPoses().some((id) => id.startsWith('editor.turn-back~'))).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('never knocks in a read-only tab', () => {
      useStore.setState({ readOnly: true })
      render(<StudioScene running={false} />)
      act(() => useStore.setState({ game: withPendingResult() }))
      expect(sound.plays).toEqual([])
    })

    it('never knocks while the window is hidden', () => {
      useStore.setState({ windowHidden: true })
      render(<StudioScene running={false} />)
      act(() => useStore.setState({ game: withPendingResult() }))
      expect(sound.plays).toEqual([])
      useStore.setState({ windowHidden: false })
    })

    it('walks in with a knock when a new career opens on the first step', () => {
      useStore.setState({ tutorialStep: 0 })
      render(<StudioScene running={false} />)
      // a studio change repaints at once (reduced motion snaps the walk)
      act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
      expect(editorHere()).toBe(true)
      expect(sound.plays).toEqual(['knock'])
    })

    it('walks in with a knock when the tutorial starts in a running scene (a replay)', () => {
      render(<StudioScene running={false} />)
      fake.log.length = 0
      fake.images.length = 0
      act(() => useStore.setState({ tutorialStep: 0 }))
      expect(editorHere()).toBe(true)
      expect(sound.plays).toEqual(['knock'])
    })

    it('a reload on a later step finds the editor already standing there: no walk, no knock', () => {
      useStore.setState({ tutorialStep: 8 })
      render(<StudioScene running={false} />)
      act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
      expect(editorHere()).toBe(true)
      expect(sound.plays).toEqual([])
    })

    it('walks out when the tutorial ends', () => {
      useStore.setState({ tutorialStep: 3 })
      render(<StudioScene running={false} />)
      act(() => useStore.setState({ game: { ...game, studio: { tier: 'loft', owned: [] } } }))
      expect(editorHere()).toBe(true)
      fake.log.length = 0
      fake.images.length = 0
      act(() => useStore.setState({ tutorialStep: -1 }))
      expect(fake.log.length).toBeGreaterThan(0)
      expect(editorHere()).toBe(false)
    })

    it('a real reason still takes the visit during the tutorial', () => {
      useStore.setState({ tutorialStep: 7 })
      render(<StudioScene running={false} />)
      fake.log.length = 0
      fake.images.length = 0
      act(() => useStore.setState({ game: withPendingResult() }))
      // the envelope at the spot: the result reason, not the tutorial's empty hands
      expect(editorHere()).toBe(true)
    })

    it('the editor leaves once the result is dismissed', () => {
      render(<StudioScene running={false} />)
      const pending = withPendingResult()
      act(() => useStore.setState({ game: pending }))
      fake.log.length = 0
      fake.images.length = 0
      act(() => useStore.setState({
        game: { ...pending, pendingResult: null, pendingOffer: null, event: null, animeOffer: null, reviewUnread: null },
      }))
      expect(fake.log.length).toBeGreaterThan(0)
      expect(editorHere()).toBe(false)
    })
  })
})
