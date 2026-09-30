import { useMemo } from 'react'
import { BADGES, earnedBadges, shortDate } from '../../sim'
import type { Badge } from '../../sim'
import { readProfile } from '../../state/profile'
import { useStore } from '../../state/store'
import { PixelArt } from '../art/PixelArt'
import { BADGE_ART, BADGE_LOCKED } from '../art/registry'
import { Modal } from '../components'
import '../../styles/career.css'

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

type TileState = 'earned' | 'earlier' | 'locked'

function BadgeTile({ badge, state, day }: { badge: Badge; state: TileState; day?: number }) {
  const secret = state === 'locked' && badge.hidden
  const art = state === 'locked' ? BADGE_LOCKED : BADGE_ART[badge.id]
  const title = secret ? '???' : badge.title
  return (
    <li className={`badge-tile ${state}`} data-state={state}>
      <span className="badge-art" aria-hidden="true">
        <PixelArt art={art} />
      </span>
      <div className="grow">
        <div><b>{title}</b></div>
        <div className="small">{secret ? badge.category : badge.hint}</div>
        {state === 'earned' && day !== undefined && <div className="small">Earned {shortDate(day, { week: true })}</div>}
        {state === 'earlier' && <div className="small">Earned in an earlier career</div>}
      </div>
    </li>
  )
}

/** The badge gallery: this career's badges, those earned in an earlier career on this device, and the rest. */
export function BadgesModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const earned = earnedBadges(game)
  const profile = useMemo(() => readProfile(storage()), [])
  return (
    <Modal title="Badges" sub={`${earned.length} of ${BADGES.length} badges`} onClose={closeModal} narrow>
      <ul className="badge-grid" aria-label="Badges">
        {BADGES.map((b) => {
          const mine = earned.find((e) => e.id === b.id)
          const state: TileState = mine ? 'earned' : profile.badges.some((p) => p.id === b.id) ? 'earlier' : 'locked'
          return <BadgeTile key={b.id} badge={b} state={state} day={mine?.day} />
        })}
      </ul>
    </Modal>
  )
}
