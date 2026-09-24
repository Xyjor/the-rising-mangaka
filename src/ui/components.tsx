import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { PODIUM_RANK, RATING_LABEL, weakRankLine } from '../sim'
import { memo } from 'react'
import type { ChapterResult, Rating } from '../sim'
import { Icon } from './Icon'

export function Bar({
  value, max = 100, tone = '', thick = false, striped = false, label,
}: {
  value: number; max?: number; tone?: string; thick?: boolean; striped?: boolean; label?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={`bar ${tone} ${thick ? 'thick' : ''} ${striped ? 'striped' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Pips({ rating, title }: { rating: Rating | null; title?: string }) {
  const unknown = rating === null
  return (
    <span
      className={`pips ${unknown ? 'unknown' : ''}`}
      data-r={unknown ? undefined : rating}
      title={title ?? (unknown ? 'Unknown' : RATING_LABEL[rating])}
      aria-label={unknown ? 'Unknown rating' : `${RATING_LABEL[rating]} rating`}
    >
      <i /><i /><i /><i /><i />
    </span>
  )
}

export function RatingText({ rating }: { rating: Rating | null }) {
  if (rating === null) return <span className="faint">Unknown</span>
  return (
    <span style={{ color: `var(--rating-${rating})`, fontWeight: 800 }}>{RATING_LABEL[rating]}</span>
  )
}

export function Modal({
  title, sub, children, footer, onClose, narrow = false, closeLabel = 'Close', describedBy,
}: {
  title: string; sub?: string; children: ReactNode; footer?: ReactNode
  onClose?: () => void; narrow?: boolean; closeLabel?: string; describedBy?: string
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}>
      <div className={`modal ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title} aria-describedby={describedBy}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <div className="small muted">{sub}</div>}
          </div>
          {onClose && (
            <button className="btn ghost icon" onClick={onClose} aria-label={closeLabel} title={`${closeLabel} (Esc)`}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function money(n: number): string {
  const v = Math.round(n)
  return v < 0 ? `-¥${Math.abs(v).toLocaleString()}` : `¥${v.toLocaleString()}`
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return Math.round(n).toLocaleString()
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
