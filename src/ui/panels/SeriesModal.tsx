import { useState } from 'react'
import {
  SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE, audienceById, describeDate, genreById, magazineById, themeById,
} from '../../sim'
import type { Serial } from '../../sim'
import { useStore } from '../../state/store'
import { Metric, Modal, RankChart, Reward } from '../components'
import { compact, money } from '../format'

export function SeriesModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const all: Serial[] = [...(game.serial ? [game.serial] : []), ...[...game.serials].reverse()]
  const [pick, setPick] = useState(0)
  const ser = all[pick]

  return (
    <Modal title="Series" sub="Weekly chapter polls, popularity, and volume sales." onClose={closeModal}>
      {!ser ? (
        <p className="muted">
          No serialised work yet. Finish top {SERIAL_OFFER_MIN_RANK} in a magazine poll, or score {SERIAL_OFFER_MIN_SCORE}+, and that magazine will offer you a serial. Kids Comic Go! is the easiest place to start.
        </p>
      ) : (
        <div className="col" style={{ gap: 16 }}>
          {all.length > 1 && (
            <div className="seg sm" role="group" aria-label="Series" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
              {all.map((s, i) => <button key={s.id} aria-pressed={i === pick} onClick={() => setPick(i)}>{s.title}</button>)}
            </div>
          )}
          <SeriesDetail ser={ser} />
        </div>
      )}
    </Modal>
  )
}

// Kept beside SeriesDetail so the header import stays untouched; ESM hoists it like any other import.
import { SERIAL_WARNINGS_TO_CANCEL, VOLUME_EVERY_CHAPTERS } from '../../sim'

function SeriesDetail({ ser }: { ser: Serial }) {
  const mag = magazineById(ser.magazineId)
  const started = describeDate(ser.startedDay)
  const best = ser.results.reduce((b, r) => Math.min(b, r.rank), Infinity)
  const untilVolume = VOLUME_EVERY_CHAPTERS - (ser.results.length % VOLUME_EVERY_CHAPTERS)
  const warningsLeft = SERIAL_WARNINGS_TO_CANCEL - ser.warnings
  const statusChip = ser.status === 'running' ? <span className="chip green">Running</span>
    : ser.status === 'ended' ? <span className="chip blue">Completed</span> : <span className="chip accent">Cancelled</span>
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div>
          <div className="display" style={{ fontSize: 28, lineHeight: 1 }}>{ser.title}</div>
          <div className="small muted">
            {genreById(ser.genre).name}, {themeById(ser.theme).name}, for {audienceById(ser.audience).name}. In {mag.name} since year {started.year}, month {started.month}.
          </div>
        </div>
        {statusChip}
      </div>

      <Metric label="Popularity" bar={ser.popularity} tone={ser.popularity >= 60 ? 'green' : ser.popularity >= 40 ? 'gold' : 'accent'} thick>
        <p className="tiny muted">A moving average of recent poll placements. Three weak chapters in a row and the magazine pulls the plug.</p>
      </Metric>

      <div className="row wrap small muted">
        <span className="warnings" role="img" aria-label={`${ser.warnings} of ${SERIAL_WARNINGS_TO_CANCEL} warnings`}>
          {Array.from({ length: SERIAL_WARNINGS_TO_CANCEL }, (_, i) => <i key={i} className={i < ser.warnings ? 'on' : ''} />)}
        </span>
        <span>
          {ser.warnings === 0
            ? 'Safe'
            : ser.warnings === SERIAL_WARNINGS_TO_CANCEL - 1
              ? 'One more weak chapter cancels it'
              : `${ser.warnings} warning${ser.warnings === 1 ? '' : 's'}. ${warningsLeft} more weak chapters in a row cancel it`}
        </span>
        <span>Next volume in {untilVolume} chapter{untilVolume === 1 ? '' : 's'}</span>
      </div>

      <div className="rewards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
        <Reward value={ser.chaptersSent} label="Chapters" />
        <Reward value={best === Infinity ? '—' : `#${best}`} label="Best rank" />
        <Reward value={ser.volumes} label="Volumes" />
        <Reward value={compact(ser.totalCopies)} label="Copies sold" />
        <Reward value={money(ser.totalMoney)} label="Earned" />
      </div>

      {ser.results.length > 0 && (
        <section>
          <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>Poll rank by chapter</div>
          <RankChart results={ser.results} entrants={mag.entrants + 1} height={150} />
          <div className="legend" style={{ marginTop: 6 }}>
            <span><i style={{ background: 'var(--gold)' }} />Top 3</span>
            <span><i style={{ background: 'var(--blue)' }} />Mid-table</span>
            <span><i style={{ background: 'var(--accent)' }} />Weak (counts toward cancellation)</span>
          </div>
        </section>
      )}

      {ser.results.length > 0 && (
        <table className="table">
          <thead><tr><th>Chapter</th><th className="num">Rank</th><th className="num">Score</th><th className="num">Art</th><th className="num">Story</th><th className="num">Freshness</th><th className="num">Paid</th></tr></thead>
          <tbody>
            {[...ser.results].reverse().map((r) => (
              <tr key={r.chapter}>
                <td><b>Ch.{r.chapter}</b></td>
                <td className="num">#{r.rank}<span className="faint">/{r.entrants}</span></td>
                <td className="num">{r.score}</td>
                <td className="num">{r.breakdown.art}</td>
                <td className="num">{r.breakdown.story}</td>
                <td className="num">{r.breakdown.freshness}</td>
                <td className="num">{money(r.rewards.money)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
