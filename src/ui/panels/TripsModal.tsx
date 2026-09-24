import { PLACES, getPhase } from '../../sim'
import { useStore } from '../../state/store'
import { Modal, money } from '../components'

export function TripsModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const startTrip = useStore((s) => s.startTrip)
  const phase = getPhase(game)
  const busy = !!game.trip

  return (
    <Modal title="Trips and training" sub="Leave the desk for a few days. Nothing gets drawn while you are away." onClose={closeModal} narrow>
      <div className="col" style={{ gap: 14 }}>
        {phase === 'drawing' && <p className="small warn-text">You are mid-manuscript. The pages will wait, but the calendar will not.</p>}
        <div className="place-list">
          {PLACES.map((pl) => {
            const canAfford = game.player.money >= pl.cost
            return (
              <div className="place" key={pl.id}>
                <div className="name">{pl.name}</div>
                <button className="btn sm primary" disabled={busy || !canAfford} onClick={() => startTrip(pl.id)}>
                  {busy ? 'Away' : canAfford ? `Go, ${money(pl.cost)}` : `Need ${money(pl.cost - game.player.money)} more`}
                </button>
                <div className="meta">{pl.days} days. {pl.blurb}</div>
                <div className="effect">{pl.effect}</div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
