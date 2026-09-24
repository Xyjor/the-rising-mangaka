import { LOW_STAMINA_THRESHOLD, MAX_ASSISTANTS, TRAITS, WEEKLY_LIVING_COST, assistantPagesPerDay, weeklyCosts } from '../../sim'
import type { Assistant } from '../../sim'
import { useStore } from '../../state/store'
import { ConfirmRow } from '../ConfirmRow'
import { Icon } from '../Icon'
import { Bar, Modal, money } from '../components'

import { LOOK_HAIRS, LOOK_SHIRTS } from '../looks'

function Avatar({ a }: { a: Assistant }) {
  // A tiny pixel portrait: hair, face, shirt.
  return (
    <svg className="avatar" viewBox="0 0 8 8" width={40} height={40} aria-hidden shapeRendering="crispEdges">
      <rect width="8" height="8" fill="var(--paper-2)" />
      <rect x="2" y="1" width="4" height="2" fill={LOOK_HAIRS[a.look % LOOK_HAIRS.length]} />
      <rect x="2" y="3" width="4" height="2" fill="#f4cfa5" />
      <rect x="3" y="3" width="1" height="1" fill="#1b1b1b" /><rect x="5" y="3" width="1" height="1" fill="#1b1b1b" />
      <rect x="1" y="5" width="6" height="3" fill={LOOK_SHIRTS[a.look % LOOK_SHIRTS.length]} />
    </svg>
  )
}

function Person({ a, action, actionLabel, disabled, hired, confirm }: {
  a: Assistant; action: () => void; actionLabel: string; disabled?: boolean; hired?: boolean
  confirm?: { confirmLabel: string; cancelLabel: string }
}) {
  return (
    <div className="person">
      <div className="head">
        <Avatar a={a} />
        <div className="grow">
          <div className="name">{a.name}</div>
          <div className="salary">{money(a.salary)} a week, about {assistantPagesPerDay(a).toFixed(1)} pages a day</div>
        </div>
      </div>
      <div className="metric">
        <div className="head"><span>Art</span><b className="num">{a.art}</b></div>
        <Bar value={a.art} tone="blue" label="Art" />
      </div>
      <div className="metric">
        <div className="head"><span>Story</span><b className="num">{a.story}</b></div>
        <Bar value={a.story} tone="purple" label="Story" />
      </div>
      {hired && (
        <div className="metric">
          <div className="head"><span>Stamina</span><b className="num">{Math.round(a.stamina)}/{a.maxStamina}</b></div>
          <Bar value={a.stamina} max={a.maxStamina} tone={a.stamina < LOW_STAMINA_THRESHOLD ? 'accent' : 'green'} label="Stamina" />
        </div>
      )}
      <div className="row between wrap">
        <span className="chip purple" title={TRAITS[a.trait].blurb}>{TRAITS[a.trait].name}</span>
        <span className="tiny muted">{TRAITS[a.trait].blurb}</span>
      </div>
      {confirm
        ? <ConfirmRow className={`btn sm ${hired ? 'ghost' : 'primary'}`} label={actionLabel} confirmLabel={confirm.confirmLabel} cancelLabel={confirm.cancelLabel} onConfirm={action} />
        : <button className={`btn sm ${hired ? 'ghost' : 'primary'}`} onClick={action} disabled={disabled}>{actionLabel}</button>}
    </div>
  )
}

export function StaffModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const hire = useStore((s) => s.hireAssistant)
  const fire = useStore((s) => s.fireAssistant)
  const full = game.assistants.length >= MAX_ASSISTANTS
  const refreshIn = Math.max(0, game.candidatesRefreshDay - game.day)
  const costs = weeklyCosts(game)

  return (
    <Modal title="Staff" sub="Assistants draw pages alongside you and add their own skill to every page." onClose={closeModal}>
      <div className="col" style={{ gap: 20 }}>
        <section className="col" style={{ gap: 10 }}>
          <div className="row between wrap">
            <div className="panel-title">Your studio <span className="small muted" style={{ fontFamily: 'var(--font-ui)', letterSpacing: 0 }}>({game.assistants.length} of {MAX_ASSISTANTS})</span></div>
            <span className="small muted">Weekly costs {money(costs)}: living {money(WEEKLY_LIVING_COST)}, salaries {money(costs - WEEKLY_LIVING_COST)}</span>
          </div>
          {game.assistants.length === 0
            ? <p className="muted small">Nobody yet. Hiring costs nothing up front, only a weekly salary.</p>
            : (
              <div className="people-grid">
                {game.assistants.map((a) => (
                  <Person key={a.id} a={a} hired actionLabel="Let go" confirm={{ confirmLabel: `Yes, let ${a.name} go`, cancelLabel: 'Keep' }} action={() => fire(a.id)} />
                ))}
              </div>
            )}
        </section>

        <section className="col" style={{ gap: 10 }}>
          <div className="row between wrap">
            <div className="panel-title">Looking for work</div>
            <span className="small muted row"><Icon name="info" size={14} /> New candidates in {refreshIn} day{refreshIn === 1 ? '' : 's'}</span>
          </div>
          {game.candidates.length === 0
            ? <p className="muted small">Nobody is looking right now. Check back later.</p>
            : (
              <div className="people-grid">
                {game.candidates.map((a) => (
                  <Person key={a.id} a={a} actionLabel={full ? 'Studio is full' : 'Hire'} disabled={full} action={() => hire(a.id)} />
                ))}
              </div>
            )}
        </section>
      </div>
    </Modal>
  )
}
