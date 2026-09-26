import {
  HIRE_RUNWAY_WEEKS, LOW_STAMINA_THRESHOLD, STUDIO_TIERS, TRAITS, WEEKLY_LIVING_COST, assistantPagesPerDay, studioSlots,
  studioTier, weeklyCosts,
} from '../../sim'
import type { Assistant } from '../../sim'
import { useStore } from '../../state/store'
import { ConfirmRow } from '../ConfirmRow'
import { Icon } from '../Icon'
import { Metric, Modal } from '../components'
import { money, plural } from '../format'

import { LOOK_HAIRS, LOOK_SHIRTS } from '../looks'

function Avatar({ a }: { a: Assistant }) {
  // A tiny pixel portrait: hair, face, shirt.
  return (
    <svg className="avatar" viewBox="0 0 8 8" width={48} height={48} aria-hidden shapeRendering="crispEdges">
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
      <Metric label="Art" bar={a.art} tone="blue" />
      <Metric label="Story" bar={a.story} tone="purple" />
      {hired && (
        <Metric
          label="Stamina"
          value={`${Math.round(a.stamina)}/${a.maxStamina}`}
          bar={a.stamina}
          max={a.maxStamina}
          tone={a.stamina < LOW_STAMINA_THRESHOLD ? 'accent' : 'green'}
        />
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
  const openModal = useStore((s) => s.openModal)
  const desks = studioSlots(game)
  const full = game.assistants.length >= desks
  // Every desk taken: a bigger studio has more, until the biggest.
  const canMove = game.studio.tier !== STUDIO_TIERS[STUDIO_TIERS.length - 1].id
  const refreshIn = Math.max(0, game.candidatesRefreshDay - game.day)
  const costs = weeklyCosts(game)
  const rent = studioTier(game).rent
  const runway = Math.max(0, Math.floor(game.player.money / costs))

  return (
    <Modal title="Staff" sub="Assistants draw pages alongside you and add their own skill to every page." onClose={closeModal}>
      <div className="col" style={{ gap: 20 }}>
        <section className="col staff-section" style={{ gap: 10 }}>
          <div className="row between wrap">
            <div className="panel-title">Your studio <span className="small muted" style={{ fontFamily: 'var(--font-ui)', letterSpacing: 0 }}>({game.assistants.length} of {plural(desks, 'desk')})</span></div>
            <span className="small muted">
              Weekly costs {money(costs)}: living {money(WEEKLY_LIVING_COST)}, {rent ? `rent ${money(rent)}, ` : ''}salaries {money(costs - WEEKLY_LIVING_COST - rent)}.{' '}
              <span className={runway <= 1 ? 'warn-text' : undefined}>Runway: {plural(runway, 'week')}</span>
            </span>
          </div>
          {game.assistants.length === 0
            ? <p className="muted small">Nobody yet. Hiring costs nothing up front, only a weekly salary. You need {HIRE_RUNWAY_WEEKS} weeks of that salary in the bank to hire.</p>
            : (
              <div className="people-grid">
                {game.assistants.map((a) => (
                  <Person key={a.id} a={a} hired actionLabel="Let go" confirm={{ confirmLabel: `Yes, let ${a.name} go`, cancelLabel: 'Keep' }} action={() => fire(a.id)} />
                ))}
              </div>
            )}
        </section>

        <section className="col staff-section" style={{ gap: 10 }}>
          <div className="row between wrap">
            <div className="panel-title">Looking for work</div>
            <span className="small muted row"><Icon name="info" size={14} /> New candidates in {plural(refreshIn, 'day')}</span>
          </div>
          {game.candidates.length === 0
            ? <p className="muted small">Nobody is looking right now. Check back later.</p>
            : (
              <div className="people-grid">
                {game.candidates.map((a) => {
                  const short = game.player.money < a.salary * HIRE_RUNWAY_WEEKS
                  // Every desk taken below the loft: the button takes the player to the Studio panel instead.
                  if (full && canMove) {
                    return (
                      <Person key={a.id} a={a} actionLabel="Move to a bigger studio for another desk" action={() => openModal('studio')} />
                    )
                  }
                  return (
                    <Person
                      key={a.id}
                      a={a}
                      actionLabel={full ? 'Full, let someone go first' : short ? `Need ${money(a.salary * HIRE_RUNWAY_WEEKS)} in the bank` : 'Hire'}
                      disabled={full || short}
                      action={() => hire(a.id)}
                    />
                  )
                })}
              </div>
            )}
        </section>
      </div>
    </Modal>
  )
}
