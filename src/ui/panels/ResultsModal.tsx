import { useEffect, useState } from 'react'
import {
  RATING_LABEL, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE, audienceById, genreById,
  magazineById, rankTier, themeById,
} from '../../sim'
import type { RankTier, ScoreBreakdown } from '../../sim'
import { useStore } from '../../state/store'
import { Bar, Modal, Pips, Reward } from '../components'
import { compact, money } from '../format'
import { payWhy, rivalLine } from '../labels'

const ITEMS: { key: keyof ScoreBreakdown; label: string; tone: string }[] = [
  { key: 'art', label: 'Art', tone: 'blue' },
  { key: 'story', label: 'Story', tone: 'purple' },
  { key: 'pacing', label: 'Pacing', tone: 'gold' },
  { key: 'audienceFit', label: 'Audience fit', tone: 'green' },
  { key: 'freshness', label: 'Freshness', tone: 'accent' },
]

const HEADLINE: Record<RankTier, string> = {
  first: 'Number one!', podium: 'On the podium!', mid: 'Mid-table.', weak: 'Back of the pack.',
}

export function ResultsModal() {
  const r = useStore((s) => s.game!.pendingResult!)
  const pendingOffer = useStore((s) => s.game!.pendingOffer)
  const serial = useStore((s) => s.game!.serial)
  const dismiss = useStore((s) => s.dismissResult)
  const finishTutorial = useStore((s) => s.finishTutorial)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 150)
    return () => window.clearTimeout(t)
  }, [])

  const mag = magazineById(r.magazineId)
  const tier = r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : undefined
  const headline = HEADLINE[rankTier(r.rank, r.entrants)]
  const rival = rivalLine(r)

  const close = () => { finishTutorial(); dismiss() }

  return (
    <Modal
      title="Reader poll results"
      sub={`${r.title}, in ${mag.name}`}
      describedBy="result-summary"
      footer={
        <>
          <span className="small muted">
            Recorded in your Notebook: {genreById(r.genre).name} × {themeById(r.theme).name} = {RATING_LABEL[r.genreThemeRating]},{' '}
            {themeById(r.theme).name} × {audienceById(r.audience).name} = {RATING_LABEL[r.themeAudienceRating]}
          </span>
          <button className="btn primary" onClick={close} autoFocus>Back to the studio</button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        <p id="result-summary" className="sr-only">
          {headline} {r.title} ranked number {r.rank} of {r.entrants} in {mag.name}, score {r.score} out of 100.
          {' '}Paid {money(r.rewards.money)}, {compact(r.rewards.fans)} new fans, {r.rewards.xp} XP.
        </p>
        <div className="result-hero">
          <div className="rank-badge" data-tier={tier} aria-hidden="true">
            <span><small>#</small>{r.rank}</span>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <h3 className="display" style={{ fontSize: 30 }}>{headline}</h3>
            <div className="muted">Ranked <b>#{r.rank}</b> of {r.entrants} works, with an overall score of <b className="num">{r.score}</b> out of 100.</div>
            <div className="tag-row" style={{ marginTop: 4 }}>
              <span className="chip">{genreById(r.genre).name}</span>
              <span className="chip">{themeById(r.theme).name}</span>
              <span className="chip">{audienceById(r.audience).name}</span>
            </div>
          </div>
        </div>
        {rival && <p className="small">{rival}</p>}

        <div className="speech">
          {r.editorComment}
          <div className="tiny muted" style={{ marginTop: 6 }}>{mag.editor}, editor at {mag.name}</div>
        </div>

        <section aria-label="Score breakdown" className="breakdown">
          <div className="lbl">Why this score</div>
          {ITEMS.map((it) => (
            <div className="item" key={it.key}>
              <span className="l">{it.label}<small>weight {mag.taste[it.key]}%</small></span>
              <Bar value={revealed ? r.breakdown[it.key] : 0} tone={it.tone} thick label={it.label} />
              <span className="v num">{r.breakdown[it.key]}</span>
            </div>
          ))}
          {(r.penalties.magazineMismatch > 0 || r.penalties.staleness > 0) && (
            <div className="tiny col" style={{ color: 'var(--accent)', fontWeight: 800, gap: 4 }}>
              {r.penalties.magazineMismatch > 0 && (
                <p>
                  Audience fit −{r.penalties.magazineMismatch}: {mag.name} is read by {audienceById(mag.audience).name}, this manga is for {audienceById(r.audience).name}.
                </p>
              )}
              {r.penalties.staleness > 0 && (
                <p>
                  Freshness −{r.penalties.staleness}: repeated pairing, you used {genreById(r.genre).name} and {themeById(r.theme).name} recently.
                </p>
              )}
            </div>
          )}
          <div className="row wrap small muted" style={{ gap: 16 }}>
            <span className="row">Freshness pairing <Pips rating={r.genreThemeRating} /> {RATING_LABEL[r.genreThemeRating]}</span>
            <span className="row">Audience pairing <Pips rating={r.themeAudienceRating} /> {RATING_LABEL[r.themeAudienceRating]}</span>
          </div>
        </section>

        <section className="rewards" aria-label="Rewards">
          <Reward value={`+${money(r.rewards.money)}`} label="Payment" />
          <Reward value={`+${compact(r.rewards.fans)}`} label="Fans" />
          <Reward value={`+${r.rewards.xp}`} label="XP" />
        </section>
        <p className="tiny muted">{payWhy(r)}</p>

        {pendingOffer ? (
          <p className="small ok-text">{mag.name} wants to serialise this. The offer is next.</p>
        ) : serial ? (
          <p className="tiny muted">No new offer while "{serial.title}" is running.</p>
        ) : (
          <p className="tiny muted">
            Rank {r.rank} of {r.entrants}, score {r.score}: no serial offer this time. A top-{SERIAL_OFFER_MIN_RANK} finish, or a score of {SERIAL_OFFER_MIN_SCORE} or more, earns one.
          </p>
        )}
      </div>
    </Modal>
  )
}
