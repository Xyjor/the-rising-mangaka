import { useEffect, useState } from 'react'
import {
  RATING_LABEL, SCORE_WEIGHTS, audienceById, genreById, magazineById, themeById,
} from '../../sim'
import type { ScoreBreakdown } from '../../sim'
import { useStore } from '../../state/store'
import { Bar, Modal, Pips, compact, money } from '../components'

const ITEMS: { key: keyof ScoreBreakdown; label: string; tone: string }[] = [
  { key: 'art', label: 'Art', tone: 'blue' },
  { key: 'story', label: 'Story', tone: 'purple' },
  { key: 'pacing', label: 'Pacing', tone: 'gold' },
  { key: 'audienceFit', label: 'Audience fit', tone: 'green' },
  { key: 'freshness', label: 'Freshness', tone: 'accent' },
]

export function ResultsModal() {
  const r = useStore((s) => s.game!.pendingResult!)
  const dismiss = useStore((s) => s.dismissResult)
  const finishTutorial = useStore((s) => s.finishTutorial)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 150)
    return () => window.clearTimeout(t)
  }, [])

  const mag = magazineById(r.magazineId)
  const tier = r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : undefined
  const headline =
    r.rank === 1 ? 'Number one!' : r.rank <= 3 ? 'On the podium!' : r.rank <= Math.ceil(r.entrants / 2) ? 'Mid-table.' : 'Back of the pack.'

  const close = () => { finishTutorial(); dismiss() }

  return (
    <Modal
      title="Reader poll results"
      sub={`${r.title}, in ${mag.name}`}
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
        <div className="result-hero">
          <div className="rank-badge" data-tier={tier} aria-label={`Rank ${r.rank} of ${r.entrants}`}>
            <span><small>#</small>{r.rank}</span>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <div className="display" style={{ fontSize: 30 }}>{headline}</div>
            <div className="muted">Ranked <b>#{r.rank}</b> of {r.entrants} works, with an overall score of <b className="num">{r.score}</b> out of 100.</div>
            <div className="tag-row" style={{ marginTop: 4 }}>
              <span className="chip">{genreById(r.genre).name}</span>
              <span className="chip">{themeById(r.theme).name}</span>
              <span className="chip">{audienceById(r.audience).name}</span>
            </div>
          </div>
        </div>

        <div className="speech">{r.editorComment}</div>

        <section aria-label="Score breakdown" className="breakdown">
          <div className="lbl">Why this score</div>
          {ITEMS.map((it) => (
            <div className="item" key={it.key}>
              <span className="l">{it.label}<small>weight {Math.round(SCORE_WEIGHTS[it.key] * 100)}%</small></span>
              <Bar value={revealed ? r.breakdown[it.key] : 0} tone={it.tone} thick label={it.label} />
              <span className="v num">{r.breakdown[it.key]}</span>
            </div>
          ))}
          {(r.penalties.magazineMismatch > 0 || r.penalties.staleness > 0) && (
            <div className="tiny" style={{ color: 'var(--accent)', fontWeight: 800 }}>
              Penalties applied:
              {r.penalties.magazineMismatch > 0 && ` magazine audience mismatch −${r.penalties.magazineMismatch} fit.`}
              {r.penalties.staleness > 0 && ` repeated pairing −${r.penalties.staleness} freshness.`}
            </div>
          )}
          <div className="row wrap small muted" style={{ gap: 16 }}>
            <span className="row">Freshness pairing <Pips rating={r.genreThemeRating} /> {RATING_LABEL[r.genreThemeRating]}</span>
            <span className="row">Audience pairing <Pips rating={r.themeAudienceRating} /> {RATING_LABEL[r.themeAudienceRating]}</span>
          </div>
        </section>

        <section className="rewards" aria-label="Rewards">
          <div className="reward"><div className="n">+{money(r.rewards.money)}</div><div className="l">Payment</div></div>
          <div className="reward"><div className="n">+{compact(r.rewards.fans)}</div><div className="l">Fans</div></div>
          <div className="reward"><div className="n">+{r.rewards.xp}</div><div className="l">XP</div></div>
        </section>
      </div>
    </Modal>
  )
}
