import {
  JOB_PAY_PER_DAY, VOLUME_EVERY_CHAPTERS, audienceById, genreById, getPhase, magazineById, placeById,
  projectArtQuality, projectStoryQuality, staminaFactor, studioPagesPerDay, themeById,
} from '../../sim'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import { NextGoal } from '../NextGoal'
import { Bar, RankChart, money } from '../components'

const COACH: Record<string, string> = {
  idle: 'Every career starts with one page. Plan your first manga: pick a genre, a theme, and who it is for.',
  drawing: 'Time is ticking. Working drains stamina, resting refills it. Use the speed controls up top, and press Space to pause.',
  ready: 'The manuscript is done. Pitch it to a magazine. Matching the magazine\'s readers matters, and the pitch screen shows exactly what you know.',
  submitted: 'Readers are voting. Results land in a week. Rest up, or look at your Notebook and Stats.',
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
  const discovered =
    Object.keys(game.notebook.genreTheme).length + Object.keys(game.notebook.themeAudience).length

  return (
    <aside className="desk">
      <NextGoal />
      {tutorialStep !== -1 && !game.trip && (
        <div className="coach" role="note">
          <Icon name="sparkle" />
          <div className="grow">
            <div className="who">Editor's tip</div>
            <div>{COACH[phase]}</div>
          </div>
          <button className="btn ghost sm" onClick={finishTutorial} aria-label="Hide tips"><Icon name="close" size={14} /></button>
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
                    {phase === 'drawing' ? 'Drawing' : phase === 'ready' ? 'Complete' : 'In the poll'}
                  </span>}
            </div>
            <div className="tag-row">
              <span className="chip">{genreById(p.genre).name}</span>
              <span className="chip">{themeById(p.theme).name}</span>
              <span className="chip">{audienceById(p.audience).name}</span>
              {p.kind === 'serial' && ser && <span className="chip">{magazineById(ser.magazineId).name}</span>}
            </div>

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

            {phase === 'drawing' && <ActivityControls />}

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

        {!game.trip && !p && (
          <div className="activity-block">
            <div className="row between wrap">
              <span className="lbl">Today</span>
              <div className="seg" role="group" aria-label="Activity">
                <button aria-pressed={game.activity !== 'job'} onClick={() => setActivity('rest')} title="Rest (R)"><Icon name="moon" size={16} /> Rest</button>
                <button aria-pressed={game.activity === 'job'} onClick={() => setActivity('job')} title="Part-time job (J)"><Icon name="briefcase" size={16} /> Job</button>
              </div>
            </div>
            {game.activity === 'job' && <p className="tiny muted">Part-time work pays {money(JOB_PAY_PER_DAY)} a day and costs a little stamina.</p>}
          </div>
        )}
      </section>

      <nav className="quick-nav" aria-label="Studio menus">
        <button className="btn" onClick={() => openModal('notebook')} title="Notebook (B)">
          <Icon name="notebook" />Notebook
          {discovered > 0 && <span className="badge">{discovered}</span>}
        </button>
        <button className="btn" onClick={() => openModal('stats')} title="Stats (S)">
          <Icon name="chart" />Stats
          {game.player.skillPoints > 0 && <span className="badge">{game.player.skillPoints}</span>}
        </button>
        <button className="btn" onClick={() => openModal('staff')} title="Staff (A)">
          <Icon name="people" />Staff
          {game.assistants.length > 0 && <span className="badge" style={{ background: 'var(--blue)' }}>{game.assistants.length}</span>}
        </button>
        <button className="btn" onClick={() => openModal('trips')} title="Trips (T)">
          <Icon name="map" />Trips
        </button>
        <button className="btn" onClick={() => openModal('series')} title="Series" disabled={!ser && game.serials.length === 0}>
          <Icon name="book" />Series
        </button>
        <button className="btn" onClick={() => openModal('history')} title="History (H)">
          <Icon name="trophy" />History
        </button>
      </nav>
    </aside>
  )
}

function ActivityControls() {
  const game = useStore((s) => s.game)!
  const setActivity = useStore((s) => s.setActivity)
  const setFocus = useStore((s) => s.setFocus)
  return (
    <>
      <div className="divider" />
      <div className="activity-block">
        <div className="row between wrap">
          <span className="lbl">Today</span>
          <div className="seg" role="group" aria-label="Activity">
            <button aria-pressed={game.activity === 'work'} onClick={() => setActivity('work')} title="Work (W)"><Icon name="pen" size={16} /> Draw</button>
            <button aria-pressed={game.activity === 'rest'} onClick={() => setActivity('rest')} title="Rest (R)"><Icon name="moon" size={16} /> Rest</button>
            <button aria-pressed={game.activity === 'job'} onClick={() => setActivity('job')} title="Part-time job (J)"><Icon name="briefcase" size={16} /> Job</button>
          </div>
        </div>
        <div className="row between wrap">
          <span className="lbl">Focus</span>
          <div className="seg sm" role="group" aria-label="Focus">
            <button aria-pressed={game.focus === 'art'} onClick={() => setFocus('art')} title="Art +25%, story -20%">Art</button>
            <button aria-pressed={game.focus === 'balanced'} onClick={() => setFocus('balanced')}>Balanced</button>
            <button aria-pressed={game.focus === 'story'} onClick={() => setFocus('story')} title="Story +25%, art -20%">Story</button>
          </div>
        </div>
        {game.player.stamina < 20 && game.activity === 'work' && (
          <p className="small warn-text">Low stamina: progress is halved. Consider resting.</p>
        )}
        {game.activity === 'job' && (
          <p className="tiny muted">No pages today. Part-time work pays {money(JOB_PAY_PER_DAY)} a day. Assistants rest.</p>
        )}
      </div>
    </>
  )
}

function SerialStatus() {
  const ser = useStore((s) => s.game!.serial)!
  const openModal = useStore((s) => s.openModal)
  const endSerial = useStore((s) => s.endSerial)
  const mag = magazineById(ser.magazineId)
  const last = ser.results[ser.results.length - 1]
  const untilVolume = VOLUME_EVERY_CHAPTERS - (ser.results.length % VOLUME_EVERY_CHAPTERS)
  return (
    <>
      <div className="divider" />
      <div className="col" style={{ gap: 10 }}>
        <div className="metric">
          <div className="head"><span>Popularity</span><b className="num">{ser.popularity}</b></div>
          <Bar value={ser.popularity} tone={ser.popularity >= 60 ? 'green' : ser.popularity >= 40 ? 'gold' : 'accent'} thick label="Popularity" />
        </div>
        {ser.results.length > 0 && <RankChart results={ser.results.slice(-12)} entrants={mag.entrants + 1} height={70} mini />}
        <div className="serial-status">
          <div><div className="k">Latest poll</div><div className="v">{last ? `#${last.rank} of ${last.entrants}` : 'Waiting'}</div></div>
          <div><div className="k">Chapters sent</div><div className="v">{ser.chaptersSent}{ser.pending.length ? ` (${ser.pending.length} in the poll)` : ''}</div></div>
          <div><div className="k">Next volume</div><div className="v">in {untilVolume} chapter{untilVolume === 1 ? '' : 's'}</div></div>
          <div>
            <div className="k">Cancellation risk</div>
            <div className="v row" style={{ gap: 6 }}>
              <span className="warnings" aria-label={`${ser.warnings} of 3 warnings`}>{[0, 1, 2].map((i) => <i key={i} className={i < ser.warnings ? 'on' : ''} />)}</span>
              <span className="tiny muted">{ser.warnings === 0 ? 'safe' : ser.warnings === 2 ? 'one more weak chapter ends it' : 'one warning'}</span>
            </div>
          </div>
        </div>
        <div className="row wrap">
          <button className="btn sm" onClick={() => openModal('series')}><Icon name="book" size={14} /> Series details</button>
          <button className="btn sm ghost" onClick={() => { if (window.confirm(`End "${ser.title}" here? Pending chapters still get polled, and loyal readers become fans.`)) endSerial() }}>
            Wrap up the series
          </button>
        </div>
      </div>
    </>
  )
}

function TripCard() {
  const game = useStore((s) => s.game)!
  const trip = game.trip!
  const place = placeById(trip.placeId)
  const total = trip.endsDay - trip.startedDay
  const left = trip.endsDay - game.day
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
  const rate = studioPagesPerDay(game) * Math.max(staminaFactor(game), 0.5)
  const days = Math.ceil(remaining / rate)
  if (game.activity !== 'work') return <p className="tiny muted">No pages will be drawn today.</p>
  return (
    <p className="tiny muted">
      About {days} working day{days === 1 ? '' : 's'} left at this pace{game.assistants.length ? ' with your assistants' : ''}.
    </p>
  )
}
