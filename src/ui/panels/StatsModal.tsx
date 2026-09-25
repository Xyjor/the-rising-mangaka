import { SCORE_WEIGHTS, xpToNext } from '../../sim'
import type { StatId } from '../../sim'
import { useStore } from '../../state/store'
import { Bar, Modal } from '../components'
import { compact, money } from '../format'

const STATS: { id: StatId; name: string; blurb: string; tone: string }[] = [
  { id: 'art', name: 'Art', blurb: `Art score in polls (${Math.round(SCORE_WEIGHTS.art * 100)}%), and pages per day`, tone: 'blue' },
  { id: 'story', name: 'Story', blurb: `Story score in polls (${Math.round(SCORE_WEIGHTS.story * 100)}%), and pages per day`, tone: 'purple' },
  { id: 'pacing', name: 'Pacing', blurb: `Pacing score in polls (${Math.round(SCORE_WEIGHTS.pacing * 100)}%). Raise it with points or the Editing Seminar`, tone: 'gold' },
]

export function StatsModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const spend = useStore((s) => s.spendSkillPoint)
  const p = game.player
  const best = game.history.reduce((b, r) => Math.min(b, r.rank), Infinity)

  return (
    <Modal title={p.name} sub={`Level ${p.level} mangaka`} onClose={closeModal} narrow>
      <div className="col" style={{ gap: 18 }}>
        <div className="metric">
          <div className="head"><span>Experience</span><b className="num">{p.xp} / {xpToNext(p.level)}</b></div>
          <Bar value={p.xp} max={xpToNext(p.level)} tone="purple" thick label="Experience" />
        </div>

        <section className="col" style={{ gap: 12 }} aria-label="Skills">
          <div className="row between">
            <div className="panel-title">Skills</div>
            <span className={`chip ${p.skillPoints > 0 ? 'accent' : ''}`}>{p.skillPoints} point{p.skillPoints === 1 ? '' : 's'} to spend</span>
          </div>
          {STATS.map((s) => (
            <div className="stat-row" key={s.id}>
              <span className="n">{s.name}<small>{s.blurb}</small></span>
              <Bar value={p.stats[s.id]} tone={s.tone} thick label={s.name} />
              <b className="num">{p.stats[s.id]}</b>
              <button className="btn sm" disabled={p.skillPoints <= 0 || p.stats[s.id] >= 100} onClick={() => spend(s.id)}>+2</button>
            </div>
          ))}
        </section>

        <div className="rewards">
          <div className="reward"><div className="n">{money(p.money)}</div><div className="l">Money</div></div>
          <div className="reward"><div className="n">{compact(p.fans)}</div><div className="l">Fans</div></div>
          <div className="reward"><div className="n">{p.maxStamina}</div><div className="l">Max stamina</div></div>
          <div className="reward"><div className="n">{game.history.length}</div><div className="l">Published</div></div>
          <div className="reward"><div className="n">{best === Infinity ? '—' : `#${best}`}</div><div className="l">Best rank</div></div>
          <div className="reward"><div className="n">{game.history.length ? Math.round(game.history.reduce((a, r) => a + r.score, 0) / game.history.length) : '—'}</div><div className="l">Avg score</div></div>
        </div>
      </div>
    </Modal>
  )
}
