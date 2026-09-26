import type { KeyboardEvent, ReactNode } from 'react'
import { memo, useEffect, useId, useRef, useState } from 'react'
import { PODIUM_RANK, RATING_LABEL, SERIAL_WARNINGS_TO_CANCEL, weakRankLine } from '../sim'
import type { ChapterResult, Rating } from '../sim'
import { getSound, holdDuck } from '../audio/instance'
import { useStore } from '../state/store'
import { Icon } from './Icon'

/**
 * A progress bar. `ariaValue` is what screen readers get as the value when it differs from the drawn width (the results
 * reveal counts the width up but announces the final value); it defaults to `value`.
 */
export function Bar({
  value, max = 100, tone = '', thick = false, striped = false, label, ariaValue,
}: {
  value: number; max?: number; tone?: string; thick?: boolean; striped?: boolean; label?: string; ariaValue?: number
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={`bar ${tone} ${thick ? 'thick' : ''} ${striped ? 'striped' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(ariaValue ?? value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * A labelled stat: a head with the label and a number, a `Bar` underneath, and optional
 * explanatory children rendered after the bar. `value` defaults to the rounded `bar` value
 * (the common case, where the head number and the bar track the same quantity); pass an
 * explicit `value` when the head shows something else (a countdown, a fraction, "3/5 days").
 * `barLabel` defaults to `label` (the bar's accessible name); pass one when the bar means
 * something more specific than the metric's own label ("Waiting for results", "Trip progress").
 */
export function Metric({
  label, bar, value, max = 100, tone = '', thick = false, striped = false, barLabel, children,
}: {
  label: string; bar: number; value?: ReactNode; max?: number; tone?: string
  thick?: boolean; striped?: boolean; barLabel?: string; children?: ReactNode
}) {
  return (
    <div className="metric">
      <div className="head"><span>{label}</span><b className="num">{value ?? Math.round(bar)}</b></div>
      <Bar value={bar} max={max} tone={tone} thick={thick} striped={striped} label={barLabel ?? label} />
      {children}
    </div>
  )
}

/**
 * A single value/label tile, used inside a `.rewards` or `.terms` grid. `landed` is for the results reveal: false
 * keeps the tile hidden, true slides it in (app.css); leave it out for a static tile.
 */
export function Reward({ value, label, className, landed }: {
  value: ReactNode; label: ReactNode; className?: string; landed?: boolean
}) {
  return (
    <div className={`reward ${className ?? ''}`.trim()} data-landed={landed === undefined ? undefined : String(landed)}>
      <div className="n">{value}</div>
      <div className="l">{label}</div>
    </div>
  )
}

/** The serial-status "n of 3 warnings" pip row, shared by the desk panel and the series modal. */
export function WarningPips({ warnings }: { warnings: number }) {
  return (
    <span className="warnings" role="img" aria-label={`${warnings} of ${SERIAL_WARNINGS_TO_CANCEL} warnings`}>
      {Array.from({ length: SERIAL_WARNINGS_TO_CANCEL }, (_, i) => <i key={i} className={i < warnings ? 'on' : ''} />)}
    </span>
  )
}

export function Pips({ rating, title }: { rating: Rating | null; title?: string }) {
  const unknown = rating === null
  return (
    <span
      className={`pips ${unknown ? 'unknown' : ''}`}
      data-r={unknown ? undefined : rating}
      title={title ?? (unknown ? 'Untested' : RATING_LABEL[rating])}
      aria-label={unknown ? 'Untested pairing' : `${RATING_LABEL[rating]} rating`}
    >
      <i /><i /><i /><i /><i />
    </span>
  )
}

export function RatingText({ rating }: { rating: Rating | null }) {
  if (rating === null) return <span className="faint">Untested</span>
  return (
    <span style={{ color: `var(--rating-${rating}-text)`, fontWeight: 800 }}>{RATING_LABEL[rating]}</span>
  )
}

/**
 * A native <dialog> opened with showModal(): the browser keeps focus inside, makes the rest of
 * the page inert and routes Escape through onCancel. Without `onClose` the dialog is a decision
 * the player must make (poll result, offer), so Escape and backdrop clicks do nothing and a
 * forced close (Chromium's close watcher on a second Escape) re-opens it.
 */
export interface ModalTab { id: string; label: string; badge?: number }

/** How far the music ducks under an open modal. */
export const MODAL_DUCK = 0.6

export function Modal({
  title, sub, children, footer, onClose, narrow = false, wide = false, closeLabel = 'Close', describedBy,
  tabs, tab, onTab, quiet = false,
}: {
  title: string; sub?: string; children: ReactNode; footer?: ReactNode
  onClose?: () => void; narrow?: boolean; wide?: boolean; closeLabel?: string; describedBy?: string
  tabs?: ModalTab[]; tab?: string; onTab?: (id: string) => void
  /** No open/close cue and no duck: for content that owns the moment (the results reveal). */
  quiet?: boolean
}) {
  const readOnly = useStore((s) => s.readOnly)
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current!
    const opener = document.activeElement as HTMLElement | null
    if (!d.open) d.showModal()
    // React does not emit the autofocus attribute and its own autoFocus call runs before
    // showModal (while the dialog is display:none), so focus the first useful control here.
    const first = d.querySelector<HTMLElement>('[data-autofocus]')
      ?? d.querySelector<HTMLElement>('.modal-body .choice')
      ?? d.querySelector<HTMLElement>('.modal-body button:not(:disabled), .modal-body input, .modal-body select')
      ?? d.querySelector<HTMLElement>('.modal-foot .btn.primary:not(:disabled)')
      ?? d
    first.focus()
    return () => {
      if (d.open) d.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  // The music ducks while the modal is open, with a paper blip on the way in and out. A read-only tab still ducks
  // (the music is already silent there) but plays no cue, as the sound bridge does. Mount-only: `quiet` and
  // `readOnly` are read once.
  const quietAtMount = useRef(quiet)
  useEffect(() => {
    if (quietAtMount.current) return
    const release = holdDuck(MODAL_DUCK)
    const silent = useStore.getState().readOnly
    if (!silent) getSound().play('open')
    return () => {
      release()
      if (!silent) getSound().play('close')
    }
  }, [])

  const tabId = (t: string) => `${id}-tab-${t}`
  const pick = (next: string) => {
    if (next === tab) return
    onTab?.(next)
    if (!readOnly) getSound().play('tab')
  }
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!tabs?.length) return
    const i = Math.max(0, tabs.findIndex((t) => t.id === tab))
    const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length
      : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : -1
    if (to < 0) return
    e.preventDefault()
    pick(tabs[to].id)
    ref.current?.querySelector<HTMLElement>(`[id="${tabId(tabs[to].id)}"]`)?.focus()
  }

  return (
    <dialog
      ref={ref}
      className={`modal${narrow ? ' narrow' : ''}${wide ? ' wide' : ''}`}
      aria-labelledby={id}
      aria-describedby={describedBy}
      tabIndex={-1}
      onCancel={(e) => { e.preventDefault(); onClose?.() }}
      // `close` is dispatched asynchronously; a stale one (StrictMode's effect cleanup + re-run
      // closes and re-opens before it fires) arrives while the dialog is open again. Ignore it.
      onClose={() => {
        const d = ref.current
        if (!d || d.open) return
        if (onClose) onClose(); else d.showModal()
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}
    >
      <div className="modal-head">
        <div>
          <h2 id={id}>{title}</h2>
          {sub && <div className="small muted">{sub}</div>}
        </div>
        {tabs && (
          <div className="modal-tabs" role="tablist" aria-label={`${title} sections`} onKeyDown={onTabKey}>
            {tabs.map((t) => {
              const active = t.id === tab
              return (
                <button key={t.id} type="button" role="tab" id={tabId(t.id)} aria-selected={active}
                  tabIndex={active ? 0 : -1} onClick={() => pick(t.id)}>
                  {t.label}{t.badge ? <span className="tab-badge">{t.badge}</span> : null}
                </button>
              )
            })}
          </div>
        )}
        {onClose && (
          <button className="btn ghost icon" onClick={onClose} aria-label={closeLabel} title={`${closeLabel} (Esc)`}>
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="modal-body" role={tabs ? 'tabpanel' : undefined}
        aria-labelledby={tabs && tab ? tabId(tab) : undefined}>{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </dialog>
  )
}

/**
 * Chapter ranks over time. One axis (rank, 1 at the top), thin line, round markers,
 * a direct label on the last point, and a hover tooltip per point.
 */
export const RankChart = memo(function RankChart({
  results, entrants, height = 120, mini = false,
}: { results: ChapterResult[]; entrants: number; height?: number; mini?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const padL = mini ? 6 : 28
  const padR = mini ? 24 : 30
  const padT = 10
  const padB = mini ? 6 : 18
  const n = Math.max(results.length, 2)
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (rank: number) => padT + ((rank - 1) / Math.max(entrants - 1, 1)) * (height - padT - padB)
  const weakLine = weakRankLine(entrants)
  const path = results.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r.rank).toFixed(1)}`).join(' ')
  const last = results[results.length - 1]
  // Label every k-th chapter plus the last; drop the "Ch." prefix once the axis gets crowded.
  const labelStep = Math.ceil(results.length / 8)
  const labelled = results.map((_, i) => i % labelStep === 0 || i === results.length - 1)
  const crowded = labelled.filter(Boolean).length > 8
  const chapterLabel = (c: number) => (crowded ? `${c}` : `Ch. ${c}`)

  return (
    <div className="chart-wrap">
      <svg className="rank-chart" viewBox={`0 0 ${W} ${height}`} role="img"
        aria-label={`Chapter ranks. Latest chapter ranked ${last ? last.rank : 'none'} of ${entrants}.`}>
        <line className="grid" x1={padL} x2={W - padR} y1={y(1)} y2={y(1)} />
        <line className="grid" x1={padL} x2={W - padR} y1={y(weakLine)} y2={y(weakLine)} strokeDasharray="3 3" />
        <line className="grid" x1={padL} x2={W - padR} y1={y(entrants)} y2={y(entrants)} />
        {!mini && (
          <>
            <text className="axis-label" x={padL - 6} y={y(1) + 3} textAnchor="end">#1</text>
            <text className="axis-label" x={padL - 6} y={y(weakLine) + 3} textAnchor="end">#{weakLine}</text>
            <text className="axis-label" x={padL - 6} y={y(entrants) + 3} textAnchor="end">#{entrants}</text>
            {results.map((r, i) => labelled[i] && (
              <text key={r.chapter} className="axis-label" x={x(i)} y={height - 4} textAnchor="middle">{chapterLabel(r.chapter)}</text>
            ))}
          </>
        )}
        {results.length > 1 && <path className="line" d={path} />}
        {results.map((r, i) => (
          <g key={r.chapter}>
            <circle
              className={`pt ${r.rank <= PODIUM_RANK ? 'top' : r.rank > weakLine ? 'weak' : ''}`}
              cx={x(i)} cy={y(r.rank)} r={hover === i ? 6 : 4}
            />
            <circle className="hit" cx={x(i)} cy={y(r.rank)} r={12}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <title>{`Ch. ${r.chapter}: rank ${r.rank} of ${r.entrants}, score ${r.score}`}</title>
            </circle>
          </g>
        ))}
        {last && (
          <text className="dl" x={x(results.length - 1) + 8} y={y(last.rank) + 4}>#{last.rank}</text>
        )}
      </svg>
      {hover !== null && results[hover] && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(results[hover].rank) / height) * 100}%` }}>
          Ch. {results[hover].chapter}: #{results[hover].rank} of {results[hover].entrants}, score {results[hover].score}
        </div>
      )}
    </div>
  )
})
