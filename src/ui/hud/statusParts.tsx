// The status card's moving parts, moved out of the old desk panel with the same markup and strings.
import { memo } from 'react'
import {
  JOB_PAY_PER_DAY, LOW_STAMINA_THRESHOLD, VOLUME_EVERY_CHAPTERS, chapterDeadline, expectedPagesToday, getPhase, placeById } from '../../sim'
import { useStore } from '../../state/store'
import { useShallow } from 'zustand/react/shallow'
import { PixelArt } from '../art/PixelArt'
import { PLACE_ART } from '../art/registry'
import { ConfirmRow } from '../ConfirmRow'
import { Icon } from '../Icon'
import { Metric, WarningPips } from '../components'
import { money, plural } from '../format'
import { GRACE_TEXT, focusHint, inGrace, warningText } from '../labels'
import { DEADLINE_TEXT } from './statusText'

export const ActivityControls = memo(function ActivityControls() {
  const { activity, focus, recovering, stamina, serialMagazine } = useStore(useShallow((s) => ({
    activity: s.game!.activity, focus: s.game!.focus, recovering: s.game!.recovering, stamina: s.game!.player.stamina,
    serialMagazine: s.game!.project?.kind === 'serial' ? s.game!.project.magazineId : null,
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
      <p className="tiny muted">{focusHint(serialMagazine)}</p>
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

/** The idle and submitted "Today" choice: rest or take a job. */
export const RestJobControls = memo(function RestJobControls() {
  const game = useStore((s) => s.game)!
  const setActivity = useStore((s) => s.setActivity)
  const phase = getPhase(game)
  return (
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
  )
})


export const SerialStatus = memo(function SerialStatus() {
  const ser = useStore((s) => s.game!.serial)!
  const chapter = useStore((s) => s.game!.project?.chapter ?? 0)
  const deadline = useStore(useShallow((s) => chapterDeadline(s.game!)))
  const openModal = useStore((s) => s.openModal)
  const endSerial = useStore((s) => s.endSerial)
  const last = ser.results[ser.results.length - 1]
  const untilVolume = VOLUME_EVERY_CHAPTERS - (ser.results.length % VOLUME_EVERY_CHAPTERS)
  return (
    <div className="col" style={{ gap: 10 }}>
      {deadline && (
        <p className={deadline.status === 'late' ? 'small warn-text' : 'small'}>
          Chapter {chapter} due in {plural(deadline.daysLeft, 'day')}. About {plural(deadline.workDaysLeft, 'working day')} left: {DEADLINE_TEXT[deadline.status]}.
        </p>
      )}
      <p className="small">
        <b>Popularity {ser.popularity}</b>, {last ? `latest poll #${last.rank} of ${last.entrants}` : 'waiting for the first poll'}, volume {ser.volumes + 1} in {plural(untilVolume, 'chapter')}.
      </p>
      <div className="row" style={{ gap: 6 }}>
        {inGrace(ser.results.length) ? (
          <span className="tiny muted">{GRACE_TEXT}</span>
        ) : (
          <>
            <WarningPips warnings={ser.warnings} />
            <span className="tiny muted">{warningText(ser.warnings)}</span>
          </>
        )}
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

export function TripCard() {
  const trip = useStore((s) => s.game!.trip)!
  const day = useStore((s) => s.game!.day)
  const place = placeById(trip.placeId)
  const total = trip.endsDay - trip.startedDay
  const left = trip.endsDay - day
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between wrap">
        <span className="row" style={{ gap: 8 }}>
          <span className="postcard" data-place={place.id} aria-hidden="true"><PixelArt art={PLACE_ART[place.id]} /></span>
          <span className="title">{place.name}</span>
        </span>
        <span className="chip green">Away</span>
      </div>
      <p className="small muted">{place.blurb} You are resting while away, and no pages get drawn.</p>
      <Metric
        label="Back in"
        value={plural(left, 'day')}
        bar={total - left}
        max={total}
        tone="green"
        striped
        barLabel="Trip progress"
      />
      <p className="small"><b>On return:</b> {place.effect}</p>
    </div>
  )
}

export function Eta() {
  const game = useStore((s) => s.game)!
  const p = game.project!
  const remaining = p.pagesTarget - p.pagesDone
  if (game.activity !== 'work') return <p className="tiny muted">No pages will be drawn today.</p>
  const rate = expectedPagesToday(game)
  if (rate <= 0) return <p className="tiny muted">No pages today: exhausted.</p>
  const days = Math.ceil(remaining / rate)
  return (
    <p className="tiny muted">
      About {plural(days, 'working day')} left at this pace{game.assistants.length ? ' with your assistants' : ''}.
    </p>
  )
}
