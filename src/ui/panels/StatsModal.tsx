import { useId } from 'react'
import { EQUIPMENT, xpToNext } from '../../sim'
import type { StatId } from '../../sim'
import { useStore } from '../../state/store'
import { Bar, Metric, Modal, Reward } from '../components'
import { bestRank, compact, money, plural } from '../format'
import { weightSpan } from '../labels'

const STATS: { id: StatId; name: string; blurb: string; tone: string }[] = [
  { id: 'art', name: 'Art', blurb: `Art score in polls (${weightSpan('art')}), and pages per day`, tone: 'blue' },
  { id: 'story', name: 'Story', blurb: `Story score in polls (${weightSpan('story')}), and pages per day`, tone: 'purple' },
  { id: 'pacing', name: 'Pacing', blurb: `Pacing score in polls (${weightSpan('pacing')}). Raise it with points or the Editing Seminar`, tone: 'gold' },
]

export function StatsModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const spend = useStore((s) => s.spendSkillPoint)
  const p = game.player
  const owned = EQUIPMENT.filter((e) => game.studio.owned.includes(e.id))
  const equipmentId = useId()

  return (
    <Modal title={p.name} sub={`Level ${p.level} mangaka`} onClose={closeModal} narrow>
      <div className="col" style={{ gap: 18 }}>
        <Metric label="Experience" value={`${p.xp} / ${xpToNext(p.level)}`} bar={p.xp} max={xpToNext(p.level)} tone="purple" thick />

        <section className="col" style={{ gap: 12 }} aria-label="Skills">
          <div className="row between">
            <div className="panel-title">Skills</div>
            <span className={`chip ${p.skillPoints > 0 ? 'accent' : ''}`}>{plural(p.skillPoints, 'point')} to spend</span>
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
          <Reward value={money(p.money)} label="Money" />
          <Reward value={compact(p.fans)} label="Fans" />
          <Reward value={p.maxStamina} label="Max stamina" />
          <Reward value={game.history.length} label="Published" />
          <Reward value={bestRank(game.history)} label="Best rank" />
          <Reward value={game.history.length ? Math.round(game.history.reduce((a, r) => a + r.score, 0) / game.history.length) : '—'} label="Avg score" />
        </div>

        <section className="col" style={{ gap: 8 }}>
          <div className="panel-title" id={equipmentId}>Equipment</div>
          {owned.length
            ? (
              <ul className="effect-list" aria-labelledby={equipmentId}>
                {owned.map((e) => <li key={e.id}><b>{e.name}</b>: {e.effect}</li>)}
              </ul>
            )
            : <p className="small muted">No equipment yet. The Studio sells gear that helps you draw and rest.</p>}
        </section>
      </div>
    </Modal>
  )
}
