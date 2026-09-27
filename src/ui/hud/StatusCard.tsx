// The current project, bottom centre over the studio: what is on the desk and what today is for.
import { audienceById, genreById, getPhase, magazineById, projectArtQuality, projectStoryQuality, themeById } from '../../sim'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import { Metric } from '../components'
import { plural } from '../format'
import { ActivityControls, Eta, RestJobControls, SerialStatus, TripCard } from './statusParts'
import { COACH } from './statusText'

export function CoachNote() {
  const tutorialStep = useStore((s) => s.tutorialStep)
  const finishTutorial = useStore((s) => s.finishTutorial)
  const trip = useStore((s) => !!s.game?.trip)
  const phase = useStore((s) => getPhase(s.game!))
  if (tutorialStep === -1 || trip) return null
  return (
    <div className="coach speech" role="note">
      <Icon name="sparkle" />
      <div className="grow">
        <div className="who">Getting started</div>
        <div>{COACH[phase]}</div>
      </div>
      <button className="btn ghost sm" onClick={finishTutorial} aria-label="Hide getting-started notes"><Icon name="close" size={14} /></button>
    </div>
  )
}

export function StatusCard() {
  const game = useStore((s) => s.game)!
  const openModal = useStore((s) => s.openModal)
  const phase = getPhase(game)
  const p = game.project
  const ser = game.serial

  return (
    <div className="status-stack">
      <CoachNote />
      <section className="card status-card" aria-label="Current project">
        {game.trip && <div className="span"><TripCard /></div>}

        {!game.trip && phase === 'idle' && !ser && (
          <>
            <div className="empty-desk span">
              <div className="doodle"><Icon name="pen" size={40} /></div>
              <div className="panel-title">Your desk is clear</div>
              <p className="muted small">No manga in progress. Start one when you are ready, or pick up part-time work.</p>
              <button className="btn primary lg" onClick={() => openModal('wizard')}>
                Plan a new manga <span className="kbd">N</span>
              </button>
            </div>
            <div className="status-right span"><RestJobControls /></div>
          </>
        )}

        {!game.trip && phase === 'idle' && ser && (
          <>
            <div className="status-left">
              <div className="row between wrap">
                <div className="title">{ser.title}</div>
                <span className="chip blue">{ser.status === 'ended' ? 'Final chapters in the poll' : 'Cancelled'}</span>
              </div>
              <p className="small muted">
                {plural(ser.pending.length, 'chapter')} still waiting for reader votes. You can start a new one-shot meanwhile.
              </p>
              <button className="btn primary" onClick={() => openModal('wizard')}>Plan a new manga</button>
            </div>
            <div className="status-right"><RestJobControls /></div>
          </>
        )}

        {!game.trip && p && (
          <>
            <div className="status-left">
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
              <Metric
                label="Pages"
                value={`${Math.floor(p.pagesDone)}/${p.pagesTarget}, ${Math.round((p.pagesDone / p.pagesTarget) * 100)}%`}
                bar={p.pagesDone}
                max={p.pagesTarget}
                tone="accent"
                barLabel="Pages drawn"
              />
              <Metric label="Art quality" bar={projectArtQuality(p)} tone="blue" />
              <Metric label="Story quality" bar={projectStoryQuality(p)} tone="purple" />
              {phase === 'drawing' && <Eta />}
            </div>
            <div className="status-right">
              {phase === 'drawing' && <ActivityControls />}
              {phase === 'submitted' && <RestJobControls />}
              {p.kind === 'serial' && ser && <SerialStatus />}
              {phase === 'ready' && (
                <button className="btn primary lg block" onClick={() => openModal('submit')}>
                  Pitch to a magazine <span className="kbd">M</span>
                </button>
              )}
              {phase === 'submitted' && p.resultsDay !== null && (
                <Metric
                  label="Poll results"
                  value={plural(Math.max(0, p.resultsDay - game.day), 'day')}
                  bar={game.day - (p.submittedDay ?? game.day)}
                  max={p.resultsDay - (p.submittedDay ?? game.day)}
                  tone="blue"
                  striped
                  barLabel="Waiting for results"
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
