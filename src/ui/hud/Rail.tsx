// The left rail of studio menus, plus the log and settings buttons in the stage's bottom corners.
import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { unreadLogCount, useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { plural } from '../format'

interface RailBadge { n: number; label: string; tone?: 'accent' | 'blue' }

function BadgeCount({ badge }: { badge?: RailBadge }) {
  if (!badge || badge.n <= 0) return null
  return <span className={`badge${badge.tone === 'blue' ? ' blue' : ''}`} aria-label={badge.label}>{badge.n}</span>
}

export function RailButton({ icon, label, title, onClick, disabled, badge }: {
  icon: IconName; label: string; title: string; onClick: () => void; disabled?: boolean; badge?: RailBadge
}) {
  return (
    <button className="btn rail-btn" onClick={onClick} title={title} disabled={disabled}>
      <Icon name={icon} /><span className="rail-lbl">{label}</span><BadgeCount badge={badge} />
    </button>
  )
}

export const Rail = memo(function Rail() {
  const openModal = useStore((s) => s.openModal)
  const { discovered, skillPoints, staff, pastSerials, hasSerial } = useStore(useShallow((s) => ({
    discovered: Object.keys(s.game!.notebook.genreTheme).length + Object.keys(s.game!.notebook.themeAudience).length,
    skillPoints: s.game!.player.skillPoints,
    staff: s.game!.assistants.length,
    pastSerials: s.game!.serials.length,
    hasSerial: !!s.game!.serial,
  })))
  return (
    <nav className="rail" aria-label="Studio menus">
      <RailButton icon="notebook" label="Notebook" title="Notebook (B)" onClick={() => openModal('notebook')}
        badge={{ n: discovered, label: `${discovered} pairs discovered` }} />
      <RailButton icon="chart" label="Stats" title="Stats (S)" onClick={() => openModal('stats')}
        badge={{ n: skillPoints, label: `${skillPoints} points to spend` }} />
      <RailButton icon="people" label="Staff" title="Staff (A)" onClick={() => openModal('staff')}
        badge={{ n: staff, label: plural(staff, 'assistant'), tone: 'blue' }} />
      <RailButton icon="home" label="Studio" title="Studio" onClick={() => openModal('studio')} />
      <RailButton icon="map" label="Trips" title="Trips (T)" onClick={() => openModal('trips')} />
      <RailButton icon="series" label="Series" title="Series" onClick={() => openModal('series')}
        disabled={!hasSerial && pastSerials === 0} />
      <RailButton icon="history" label="History" title="History (H)" onClick={() => openModal('history')} />
      <RailButton icon="trophy" label="Career" title="Career" onClick={() => openModal('career')} />
      <RailButton icon="star" label="Badges" title="Badges (G)" onClick={() => openModal('badges')} />
    </nav>
  )
})

export function LogButton() {
  const openModal = useStore((s) => s.openModal)
  const log = useStore((s) => s.game!.log)
  const seen = useClock((c) => c.logSeenId)
  const n = Math.min(99, unreadLogCount(log, seen))
  return (
    <button className="btn rail-btn rail-log" onClick={() => openModal('log')} title="Studio log (L)">
      <Icon name="log" /><span className="rail-lbl">Log</span><BadgeCount badge={{ n, label: `${n} unread` }} />
    </button>
  )
}

/** Tucks the desk (the status card and the desk tray) away to look at the studio, and brings it back (D). */
export function DeskButton() {
  const hidden = useStore((s) => s.deskHidden)
  const toggleDesk = useStore((s) => s.toggleDesk)
  const label = hidden ? 'Show the desk' : 'Hide the desk'
  return (
    <button className="btn ghost icon rail-desk" onClick={toggleDesk} aria-label={label} aria-pressed={hidden} title={`${label} (D)`}>
      <Icon name="eye" />
    </button>
  )
}

export function SettingsButton() {
  const openModal = useStore((s) => s.openModal)
  return (
    <button className="btn ghost icon rail-settings" onClick={() => openModal('settings')} aria-label="Settings" title="Settings">
      <Icon name="gear" />
    </button>
  )
}
