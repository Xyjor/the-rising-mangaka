import { memo } from 'react'
import {
  JOB_PAY_PER_DAY, LOW_STAMINA_THRESHOLD, RESULTS_DELAY_DAYS, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE,
  SERIAL_WARNINGS_TO_CANCEL, VOLUME_EVERY_CHAPTERS, audienceById, expectedPagesToday, genreById, getPhase,
  magazineById, placeById, projectArtQuality, projectStoryQuality, themeById } from '../../sim'
import { useStore } from '../../state/store'
import { useShallow } from 'zustand/react/shallow'
import { Icon } from '../Icon'
import { Bar, money } from '../components'
import { ConfirmRow } from '../ConfirmRow'
const COACH: Record<string, string> = {
  idle: 'Every career starts with one page. Plan your first manga: pick a genre, a theme, and who it is for.',
  drawing: 'Time is ticking. Working drains stamina, resting refills it. Use the speed controls up top, and press Space to pause.',
  ready: `The manuscript is done. Pitch it to a magazine. Matching the magazine's readers matters, and the pitch screen shows exactly what you know. A top-${SERIAL_OFFER_MIN_RANK} finish, or a score of ${SERIAL_OFFER_MIN_SCORE} or more, brings a serialisation offer.`,
  submitted: `Readers are voting. Results land in ${RESULTS_DELAY_DAYS} days. Rest up, take a job, or look at your Notebook and Stats.`,
}

export function DeskPanel() {
  const game = useStore((s) => s.game)!
  const openModal = useStore((s) => s.openModal)
  const setActivity = useStore((s) => s.setActivity)
  const tutorialStep = useStore((s) => s.tutorialStep)
  const finishTutorial = useStore((s) => s.finishTutorial)
  const phase = getPhase(game)
  const p = game.project
  const ser = game.serial

  return (
    <aside className="desk">
      {tutorialStep !== -1 && !game.trip && (
        <div className="coach" role="note">
          <Icon name="sparkle" />
          <div className="grow">
            <div className="who">Getting started</div>
            <div>{COACH[phase]}</div>
          </div>
          <button className="btn ghost sm" onClick={finishTutorial} aria-label="Hide getting-started notes"><Icon name="close" size={14} /></button>
        </div>
      )}

      <section className="card project-card" aria-label="Current project">
        {game.trip && <TripCard />}

        {!game.trip && phase === 'idle' && !ser && (
          <div className="empty-desk">
            <div className="doodle"><Icon name="pen" size={40} /></div>
            <div className="panel-title">Your desk is clear</div>
            <p className="muted small">No manga in progress. Start one when you are ready, or pick up part-time work.</p>
            <button className="btn primary lg" onClick={() => openModal('wizard')}>
              Plan a new manga <span className="kbd">N</span>
            </button>
          </div>
        )}

        {!game.trip && phase === 'idle' && ser && (
          <div className="col" style={{ gap: 10 }}>
            <div className="row between wrap">
              <div className="title">{ser.title}</div>
              <span className="chip blue">{ser.status === 'ended' ? 'Final chapters in the poll' : 'Cancelled'}</span>
            </div>
            <p className="small muted">
              {ser.pending.length} chapter{ser.pending.length === 1 ? '' : 's'} still waiting for reader votes. You can start a new one-shot meanwhile.
            </p>
            <button className="btn primary" onClick={() => openModal('wizard')}>Plan a new manga</button>
          </div>
        )}

        {!game.trip && p && (
          <>
            <div className="row between wrap">
              <div className="title">{p.title}</div>
              {p.kind === 'serial'
                ? <span className="chip blue">Chapter {p.chapter}</span>
                : <span className={`chip ${phase === 'ready' ? 'green' : phase === 'submitted' ? 'blue' : 'accent'}`}>
                    {phase === 'drawing' ? 'Drawing' : phase === 'ready' ? 'Ready to pitch' : 'In the poll'}
                  </span>}
            </div>
            <div className="tag-row">
              <span className="chip">{genreById(p.genre).name}</span>
              <span className="chip">{themeById(p.theme).name}</span>
              <span className="chip">{audienceById(p.audience).name}</span>
              {p.kind === 'serial' && ser && <span className="chip">{magazineById(ser.magazineId).name}</span>}
            </div>

            {phase === 'drawing' && <ActivityControls />}

            <div className="row" style={{ gap: 16 }}>
              <ProgressRing done={p.pagesDone} target={p.pagesTarget} />
              <div className="col grow" style={{ gap: 10 }}>
                <div className="metric">
                  <div className="head"><span>Art quality</span><b className="num">{Math.round(projectArtQuality(p))}</b></div>
                  <Bar value={projectArtQuality(p)} tone="blue" label="Art quality" />
                </div>
                <div className="metric">
                  <div className="head"><span>Story quality</span><b className="num">{Math.round(projectStoryQuality(p))}</b></div>
                  <Bar value={projectStoryQuality(p)} tone="purple" label="Story quality" />
                </div>
                {phase === 'drawing' && <Eta />}
              </div>
            </div>

            {p.kind === 'serial' && ser && <SerialStatus />}

            {phase === 'ready' && (
              <button className="btn primary lg block" onClick={() => openModal('submit')}>
                Pitch to a magazine <span className="kbd">M</span>
              </button>
            )}

            {phase === 'submitted' && p.resultsDay !== null && (
              <div className="metric">
                <div className="head">
                  <span>Poll results</span>
                  <b className="num">{Math.max(0, p.resultsDay - game.day)} day{p.resultsDay - game.day === 1 ? '' : 's'}</b>
                </div>
                <Bar value={game.day - (p.submittedDay ?? game.day)} max={p.resultsDay - (p.submittedDay ?? game.day)} tone="blue" striped label="Waiting for results" />
              </div>
            )}
          </>
        )}

        {!game.trip && (!p || phase === 'submitted') && (
          <div className="activity-block">
            <div className="row between wrap">
              <span className="lbl">Today</span>
              <div className="seg" role="group" aria-label="Activity">
                <button aria-pressed={game.activity !== 'job'} onClick={() => setActivity('rest')} title="Rest (R)"><Icon name="moon" size={16} /> Rest</button>
                <button aria-pressed={game.activity === 'job'} onClick={() => setActivity('job')} title="Part-time job (J)"><Icon name="briefcase" size={16} /> Job</button>
              </div>
            </div>
            {phase === 'submitted' && <p className="tiny muted">Readers are voting. Rest, or pick up part-time work while you wait.</p>}
            {game.activity === 'job' && <p className="tiny muted">No pages today. Part-time work pays {money(JOB_PAY_PER_DAY)} a day at full stamina, half when tired. Assistants rest.</p>}
          </div>
        )}
      </section>

      <QuickNav />
    </aside>
  )
}

const QuickNav = memo(function QuickNav() {
  const openModal = useStore((s) => s.openModal)
  const { discovered, skillPoints, staff, pastSerials, hasSerial } = useStore(useShallow((s) => ({
    discovered: Object.keys(s.game!.notebook.genreTheme).length + Object.keys(s.game!.notebook.themeAudience).length,
    skillPoints: s.game!.player.skillPoints,
    staff: s.game!.assistants.length,
    pastSerials: s.game!.serials.length,
    hasSerial: !!s.game!.serial,
  })))
  return (
    <nav className="quick-nav" aria-label="Studio menus">
      <button className="btn" onClick={() => openModal('notebook')} title="Notebook (B)">
        <Icon name="notebook" />Notebook
        {discovered > 0 && <span className="badge">{discovered}</span>}
      </button>
      <button className="btn" onClick={() => openModal('stats')} title="Stats (S)">
        <Icon name="chart" />Stats
        {skillPoints > 0 && <span className="badge">{skillPoints}</span>}
      </button>
      <button className="btn" onClick={() => openModal('staff')} title="Staff (A)">
        <Icon name="people" />Staff
        {staff > 0 && <span className="badge" style={{ background: 'var(--blue)' }}>{staff}</span>}
      </button>
      <button className="btn" onClick={() => openModal('trips')} title="Trips (T)">
        <Icon name="map" />Trips
      </button>
      <button className="btn" onClick={() => openModal('series')} title="Series" disabled={!hasSerial && pastSerials === 0}>
        <Icon name="book" />Series
      </button>
      <button className="btn" onClick={() => openModal('history')} title="History (H)">
        <Icon name="trophy" />History
      </button>
    </nav>
  )
})

const ActivityControls = memo(function ActivityControls() {
  const { activity, focus, recovering, stamina } = useStore(useShallow((s) => ({
    activity: s.game!.activity, focus: s.game!.focus, recovering: s.game!.recovering, stamina: s.game!.player.stamina,
  })))
  const setActivity = useStore((s) => s.setActivity)
  const setFocus = useStore((s) => s.setFocus)
  const asleep = stamina <= 0
  return (
    <div className="activity-block">
      <div className="row between wrap">
        <span className="lbl">Today</span>
        <div className="seg" role="group" aria-label="Activity">
          <button aria-pressed={activity === 'work'} onClick={() => setActivity('work')} disabled={asleep} title={asleep ? 'Back at the desk when stamina reaches 60%' : 'Work (W)'}><Icon name="pen" size={16} /> Draw</button>
          <button aria-pressed={activity === 'rest'} onClick={() => setActivity('rest')} title="Rest (R)"><Icon name="moon" size={16} /> Rest</button>
          <button aria-pressed={activity === 'job'} onClick={() => setActivity('job')} title="Part-time job (J)"><Icon name="briefcase" size={16} /> Job</button>
        </div>
      </div>
      <div className="row between wrap">
        <span className="lbl">Focus</span>
        <div className="seg sm" role="group" aria-label="Focus">
          <button aria-pressed={focus === 'art'} onClick={() => setFocus('art')} title="Art +25%, story -20%">Art</button>
          <button aria-pressed={focus === 'balanced'} onClick={() => setFocus('balanced')}>Balanced</button>
          <button aria-pressed={focus === 'story'} onClick={() => setFocus('story')} title="Story +25%, art -20%">Story</button>
        </div>
      </div>
      {recovering || (asleep && activity !== 'job')
        ? <p className="small warn-text">Exhausted. Resting until stamina is back to 60%, then back to the desk. No pages today.</p>
        : stamina < LOW_STAMINA_THRESHOLD && activity === 'work'
          ? <p className="small warn-text">Low stamina: pages come at half speed until you rest.</p>
          : null}
      {activity === 'job' && (
        <p className="tiny muted">No pages today. Part-time work pays {money(JOB_PAY_PER_DAY)} a day at full stamina, half when tired. Assistants rest.</p>
      )}
    </div>
  )
})

const SerialStatus = memo(function SerialStatus() {
  const ser = useStore((s) => s.game!.serial)!
  const openModal = useStore((s) => s.openModal)
  const endSerial = useStore((s) => s.endSerial)
  const last = ser.results[ser.results.length - 1]
  const untilVolume = VOLUME_EVERY_CHAPTERS - (ser.results.length % VOLUME_EVERY_CHAPTERS)
  const left = SERIAL_WARNINGS_TO_CANCEL - ser.warnings
  return (
    <div className="col" style={{ gap: 10 }}>
      <p className="small">
        <b>Popularity {ser.popularity}</b>, {last ? `latest poll #${last.rank} of ${last.entrants}` : 'waiting for the first poll'}, volume {ser.volumes + 1} in {untilVolume} chapter{untilVolume === 1 ? '' : 's'}.
      </p>
      <div className="row" style={{ gap: 6 }}>
        <span className="warnings" role="img" aria-label={`${ser.warnings} of ${SERIAL_WARNINGS_TO_CANCEL} warnings`}>
          {Array.from({ length: SERIAL_WARNINGS_TO_CANCEL }, (_, i) => <i key={i} className={i < ser.warnings ? 'on' : ''} />)}
        </span>
        <span className="tiny muted">
          {ser.warnings === 0
            ? 'Safe'
            : ser.warnings === SERIAL_WARNINGS_TO_CANCEL - 1
              ? 'One more weak chapter cancels it'
              : `${ser.warnings} warning${ser.warnings === 1 ? '' : 's'}. ${left} more weak chapters in a row cancel it`}
        </span>
      </div>
      <div className="row wrap">
        <button className="btn sm" onClick={() => openModal('series')}><Icon name="book" size={14} /> Series details</button>
        <ConfirmRow
          className="btn sm ghost"
          label="Wrap up the series"
          confirmLabel="End it here"
          cancelLabel="Keep going"
          hint="Pending chapters still get polled. Wrapping with popularity 50 or higher after a volume has shipped sells a bonus final volume."
          onConfirm={endSerial}
        />
      </div>
    </div>
  )
})

function TripCard() {
  const trip = useStore((s) => s.game!.trip)!
  const day = useStore((s) => s.game!.day)
  const place = placeById(trip.placeId)
  const total = trip.endsDay - trip.startedDay
  const left = trip.endsDay - day
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between wrap">
        <div className="title">{place.name}</div>
        <span className="chip green">Away</span>
      </div>
      <p className="small muted">{place.blurb} You are resting while away, and no pages get drawn.</p>
      <div className="metric">
        <div className="head"><span>Back in</span><b className="num">{left} day{left === 1 ? '' : 's'}</b></div>
        <Bar value={total - left} max={total} tone="green" striped label="Trip progress" />
      </div>
      <p className="small"><b>On return:</b> {place.effect}</p>
    </div>
  )
}

function ProgressRing({ done, target }: { done: number; target: number }) {
  const pct = Math.round((done / target) * 100)
  return (
    <div className="ring" style={{ ['--p' as string]: pct }} role="img" aria-label={`${pct}% of pages drawn`}>
      <div>
        <div className="big num">{Math.floor(done)}<span style={{ fontSize: 14 }}>/{target}</span></div>
        <div className="small">pages</div>
      </div>
    </div>
  )
}

function Eta() {
  const game = useStore((s) => s.game)!
  const p = game.project!
  const remaining = p.pagesTarget - p.pagesDone
  if (game.activity !== 'work') return <p className="tiny muted">No pages will be drawn today.</p>
  const rate = expectedPagesToday(game)
  if (rate <= 0) return <p className="tiny muted">No pages today: exhausted.</p>
  const days = Math.ceil(remaining / rate)
  return (
    <p className="tiny muted">
      About {days} working day{days === 1 ? '' : 's'} left at this pace{game.assistants.length ? ' with your assistants' : ''}.
    </p>
  )
}
