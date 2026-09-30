import type { ReactNode } from 'react'
import { EQUIPMENT, STUDIO_TIERS, equipmentPrice, moveInCost, studioAtLeast, studioTierById } from '../../sim'
import type { Equipment, GameState, StudioTier } from '../../sim'
import { useStore } from '../../state/store'
import { ConfirmRow } from '../ConfirmRow'
import { Modal } from '../components'
import { money } from '../format'
import { PixelArt } from '../art/PixelArt'
import { EQUIPMENT_ART_ICON, TIER_ART_THUMB } from '../art/registry'

function deskText(desks: number): string {
  return desks === 1 ? '1 desk for an assistant' : `${desks} desks for assistants`
}

function TierRow({ game, tier, index }: { game: GameState; tier: StudioTier; index: number }) {
  const moveStudio = useStore((s) => s.moveStudio)
  const current = STUDIO_TIERS.findIndex((t) => t.id === game.studio.tier)
  const cost = moveInCost(tier.id)
  const short = cost - game.player.money
  let action: ReactNode
  if (index < current) action = <span className="chip">Moved out</span>
  else if (index === current) action = <span className="chip green">You are here</span>
  else if (index === current + 1) {
    // Moving is for good (and adds rent), so it asks once more; equipment is a single click.
    action = short > 0
      ? <button className="btn sm" disabled>{`Need ${money(short)} more`}</button>
      : (
        <ConfirmRow
          className="btn sm primary"
          label={`Move in, ${money(cost)}`}
          confirmLabel={`Yes, move in for ${money(cost)}`}
          cancelLabel="Stay here"
          onConfirm={() => moveStudio(tier.id)}
        />
      )
  } else {
    action = <button className="btn sm" disabled>{`Move to the ${STUDIO_TIERS[index - 1].name.toLowerCase()} first`}</button>
  }
  const rent = tier.rent ? `Rent ${money(tier.rent)} a week.` : 'No rent.'
  return (
    <div className="place has-thumb" role="group" aria-label={tier.name}>
      <span className="postcard has-art tier-thumb" aria-hidden="true"><PixelArt art={TIER_ART_THUMB[tier.id]} /></span>
      <div className="name">{tier.name}</div>
      {action}
      {/* The next tier's button names its move-in cost; any tier after it states it here. */}
      <div className="meta">
        {index === current + 1 ? `${rent} You cannot move back down.` : index > current + 1 ? `${rent} Move-in ${money(cost)}.` : rent}
      </div>
      <div className="effect">{deskText(tier.desks)}</div>
    </div>
  )
}

function EquipmentRow({ game, item }: { game: GameState; item: Equipment }) {
  const buyEquipment = useStore((s) => s.buyEquipment)
  const price = equipmentPrice(item.id)
  const short = price - game.player.money
  const owned = game.studio.owned.includes(item.id)
  const tooSmall = !!item.needsTier && !studioAtLeast(game, item.needsTier)
  const buyable = !owned && !tooSmall && short <= 0
  const label = owned
    ? 'Owned'
    : tooSmall
      ? `Needs a ${studioTierById(item.needsTier!).name.toLowerCase()}`
      : short > 0 ? `Need ${money(short)} more` : `Buy, ${money(price)}`
  return (
    <div className="place has-art" role="group" aria-label={item.name}>
      <span className="art-frame place-art"><PixelArt art={EQUIPMENT_ART_ICON[item.id]} scale={2} /></span>
      <div className="name">{item.name}</div>
      <button className={`btn sm ${buyable ? 'primary' : ''}`} disabled={!buyable} onClick={() => buyEquipment(item.id)}>
        {label}
      </button>
      <div className="effect">{item.effect}</div>
    </div>
  )
}

export function StudioModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  return (
    <Modal
      title="Studio"
      sub="A bigger studio has desks for more assistants, and weekly rent. Equipment is bought once and helps every day."
      onClose={closeModal}
    >
      <div className="studio-grid">
        <section className="col" style={{ gap: 10 }} aria-label="Where you work">
          <div className="panel-title">Where you work</div>
          <div className="place-list">
            {STUDIO_TIERS.map((t, i) => <TierRow key={t.id} game={game} tier={t} index={i} />)}
          </div>
        </section>
        <section className="col" style={{ gap: 10 }} aria-label="Equipment">
          <div className="panel-title">Equipment</div>
          <div className="place-list">
            {EQUIPMENT.map((e) => <EquipmentRow key={e.id} game={game} item={e} />)}
          </div>
        </section>
      </div>
    </Modal>
  )
}
