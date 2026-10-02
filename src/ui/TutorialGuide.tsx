// The tutorial's guide: a spotlight on the control the current step is about, and the editor's line beside it.
// It never blocks the game: the dim lets every click through, the hotkeys and the rail keep working, and a step whose
// control is not on screen (or is behind another window) simply waits, showing nothing, until it is.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useClock } from '../state/clock'
import { useStore } from '../state/store'
import { STEPS } from '../state/tutorial'
import type { TutorialAnchor } from '../state/tutorial'
import { MARGIN, placeBubble } from './tutorialPlace'
import '../styles/tutorial.css'

/** The ring's breathing room around the control. */
const PAD = 4
/** The phone layout (stage.css): the bubble docks as a bottom sheet. */
const PHONE = '(max-width: 640px)'

const isPhone = () => typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches

/** The control on screen, and the open dialog it sits in (null over the studio). */
interface Target { anchor: HTMLElement; host: HTMLDialogElement | null }

/**
 * The anchor for a step, or null while the step must wait: not rendered, inside a hidden subtree (the tucked-away
 * desk), or on the page behind a dialog (the page is inert then, and the dim would stack on the backdrop). Any mounted
 * dialog counts, open or not yet: Modal opens it in an effect, after this runs, and windows unmount when they close.
 */
function findTarget(name: TutorialAnchor): Target | null {
  const anchor = document.querySelector<HTMLElement>(`[data-tutorial="${name}"]`)
  if (!anchor || anchor.closest('[hidden]')) return null
  const host = anchor.closest('dialog')
  if (!host && document.querySelector('dialog')) return null
  return { anchor, host }
}

export function TutorialGuide() {
  const step = useStore((s) => s.tutorialStep)
  const show = useStore((s) => s.tutorialStep >= 0 && s.tutorialStep < STEPS.length && !!s.game && !s.readOnly)
  if (!show) return null
  // one guide per step: entering a step starts over (focus, scroll into view)
  return <Guide key={step} step={step} />
}

/**
 * The step's line for screen readers: a visually hidden live region that mounts empty and receives the line one effect
 * later, since a region that mounts with its text already in it is not announced. It lives in the guide's layer, so in
 * a dialog it is portalled in too (the page behind a modal dialog is inert); a layer that remounts (the control went
 * and came back, or moved into a window) speaks again.
 */
function Announce({ text }: { text: string }) {
  const node = useRef<HTMLParagraphElement>(null)
  // React renders the node childless and never touches its text: the effect owns it
  useEffect(() => {
    if (node.current) node.current.textContent = text
  }, [text])
  return <p ref={node} className="tutorial-live sr-only" aria-live="polite" />
}

function Guide({ step }: { step: number }) {
  const def = STEPS[step]
  const advance = useStore((s) => s.advanceTutorial)
  const skip = useStore((s) => s.skipTutorial)
  const [target, setTarget] = useState<Target | null>(null)
  const targetRef = useRef<Target | null>(null)
  const ring = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const entered = useRef(false)
  const lineId = useId()
  const info = def.completes === 'next'
  const last = step === STEPS.length - 1

  // Positions are written straight to the DOM (as the scene's bubbles are): measuring never re-renders.
  const place = useCallback(() => {
    const t = targetRef.current
    const r = ring.current
    const b = bubble.current
    if (!t || !r || !b) return
    // Every read first (the control, the bubble's size, the dialog, the footer), then every write: a read after a style
    // write would force a layout. The bubble's size is its last layout's (on a phone, docked since the call before).
    const a = t.anchor.getBoundingClientRect()
    const bw = b.offsetWidth
    const bh = b.offsetHeight
    // Inside a dialog the layer is the dialog's own box (an open .modal keeps a transform, so it contains even fixed
    // children): measure both and subtract. Over the studio it is the viewport.
    let ox = 0
    let oy = 0
    let w = window.innerWidth
    let h = window.innerHeight
    if (t.host) {
      const d = t.host.getBoundingClientRect()
      ox = d.left + t.host.clientLeft
      oy = d.top + t.host.clientTop
      w = t.host.clientWidth || w
      h = t.host.clientHeight || h
    }
    const phone = isPhone()
    const foot = phone ? t.host?.querySelector<HTMLElement>('.modal-foot') : null
    const footH = foot ? foot.getBoundingClientRect().height : 0
    const app = document.querySelector<HTMLElement>('.app')

    const left = a.left - ox - PAD
    const top = a.top - oy - PAD
    const width = a.width + PAD * 2
    const height = a.height + PAD * 2
    r.style.left = `${left}px`
    r.style.top = `${top}px`
    r.style.width = `${width}px`
    r.style.height = `${height}px`

    if (phone) {
      // A bottom sheet (tutorial.css); over the studio the toasts move up by its height. In a dialog it docks above the
      // window's footer, which holds the step's own action (Start drawing, Submit, Back to the studio).
      b.dataset.dock = 'sheet'
      delete b.dataset.side
      b.style.left = ''
      b.style.top = ''
      b.style.bottom = foot ? `${MARGIN + footH}px` : ''
      if (!t.host) app?.style.setProperty('--tutorial-sheet', `${bh}px`)
      return
    }
    delete b.dataset.dock
    b.style.bottom = ''
    app?.style.removeProperty('--tutorial-sheet')
    // the vertical rail: beside it, so the bubble never covers the next buttons
    const besideFirst = !!t.anchor.closest('.rail')
    const p = placeBubble({ left, top, width, height }, { bw, bh }, { w, h }, besideFirst)
    b.dataset.side = p.side
    b.style.left = `${p.x}px`
    b.style.top = `${p.y}px`
    b.style.setProperty('--tail', `${p.tail}px`)
  }, [])

  const measure = useCallback(() => {
    const t = findTarget(def.anchor)
    const prev = targetRef.current
    if (prev?.anchor === t?.anchor && prev?.host === t?.host) {
      place()
      return
    }
    targetRef.current = t
    setTarget(t)
  }, [def.anchor, place])

  // Find the anchor now, then again (once per frame at most) whenever it may have appeared, gone or moved: a store
  // update, a resize, any scroll, a node added or removed, a dialog opening, the desk hiding, an animation ending (the
  // modal unfolds into place).
  useLayoutEffect(() => {
    measure()
    let raf = 0
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; measure() })
    }
    const unsub = useStore.subscribe(soon)
    window.addEventListener('scroll', soon, true)
    window.addEventListener('resize', soon)
    document.addEventListener('animationend', soon, true)
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(soon) : null
    resize?.observe(document.body)
    const mutation = typeof MutationObserver === 'function' ? new MutationObserver(soon) : null
    mutation?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] })
    return () => {
      cancelAnimationFrame(raf)
      unsub()
      window.removeEventListener('scroll', soon, true)
      window.removeEventListener('resize', soon)
      document.removeEventListener('animationend', soon, true)
      resize?.disconnect()
      mutation?.disconnect()
    }
  }, [measure])

  // every render may change the bubble's size: place again
  useLayoutEffect(() => { place() })

  // Entering the step (the first time its anchor shows): on a phone bring the control into view; an info step hands
  // focus to Next, an action step leaves focus where the player has it. When the control shows again later (a window
  // the player opened has closed) an info step takes focus back only if it fell to the page.
  useLayoutEffect(() => {
    if (!target) return
    if (entered.current) {
      const active = document.activeElement
      if (info && (!active || active === document.body)) nextButton.current?.focus()
      return
    }
    entered.current = true
    if (isPhone() && typeof target.anchor.scrollIntoView === 'function') target.anchor.scrollIntoView({ block: 'center' })
    if (info) nextButton.current?.focus()
  }, [target, info])

  // While the guide is on screen: the app is marked `data-guide` (the phone's toasts make room for the sheet; never
  // `data-tutorial`, which the anchor lookup above reads) and the presentation clock says so (the scene's greeting
  // hides). A waiting step sets neither.
  useLayoutEffect(() => {
    if (!target) return
    const app = document.querySelector<HTMLElement>('.app')
    app?.setAttribute('data-guide', '')
    useClock.setState({ guideVisible: true })
    return () => {
      app?.removeAttribute('data-guide')
      app?.style.removeProperty('--tutorial-sheet')
      useClock.setState({ guideVisible: false })
    }
  }, [target])

  if (!target) return null

  // Enter is Next anywhere in the bubble, except on Skip, which keeps its own Enter.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || !info) return
    const el = e.target as HTMLElement
    if (el.tagName === 'BUTTON' && el !== nextButton.current) return
    e.preventDefault()
    advance('next')
  }

  const layer = (
    <div className={`tutorial-layer${target.host ? ' in-dialog' : ''}`} data-step={def.id}>
      {/* in a dialog the backdrop already dims: only the ring */}
      <div ref={ring} className={target.host ? 'tutorial-ring' : 'tutorial-hole'} aria-hidden="true" />
      <div ref={bubble} className="tutorial-bubble" role="note" onKeyDown={onKeyDown}>
        <span className="who">Editor</span>
        <p className="line" id={lineId}>{def.line}</p>
        <div className="actions">
          <button type="button" className="btn ghost sm" onClick={skip} aria-describedby={lineId}>Skip the tutorial</button>
          {info && (
            <button
              ref={nextButton}
              type="button"
              className="btn primary sm"
              onClick={() => advance('next')}
              aria-describedby={lineId}
            >
              {last ? 'Done' : 'Next'}
            </button>
          )}
        </div>
      </div>
      <Announce text={def.line} />
    </div>
  )
  // After the dialog's body (appended last), so the modal's autofocus never lands on the guide's buttons.
  return target.host ? createPortal(layer, target.host) : layer
}
