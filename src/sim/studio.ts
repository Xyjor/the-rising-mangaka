// Studio tiers and equipment: where the mangaka works (desks for assistants, weekly rent) and what they bought for it.
// A money sink whose every effect is stated in the Studio panel. The engine reads `studioSlots` (hiring),
// `studioTier` (rent) and `equipmentEffects` (pages, samples, stamina); the scene reads `studioLook`. No RNG.
import { addLog } from './core'
import { STUDIO_TIERS, equipmentById, equipmentPrice, moveInCost, studioTierById } from './data'
import type { EquipmentId, GameState, StudioTier, StudioTierId } from './types'

/** The most volumes the studio shelf shows. */
const SHELF_VOLUMES = 24

/** The tier the studio is in. */
export function studioTier(s: GameState): StudioTier {
  return studioTierById(s.studio.tier)
}

/** Desks for assistants: `hireAssistant` refuses once every desk is taken. */
export function studioSlots(s: GameState): number {
  return studioTier(s).desks
}

/** The effects of everything the studio owns, summed; page multipliers multiply together. */
export interface EquipmentEffects {
  /** added to the player's art sample on a working day */
  art: number
  /** added to the player's story sample on a working day */
  story: number
  /** multiplies the player's pages a day */
  pagesMult: number
  /** added to a working day's stamina cost (the cost never drops below `MIN_WORK_STAMINA_COST`) */
  workCost: number
  /** added to what a rest day restores */
  restBonus: number
}

export function equipmentEffects(s: GameState): EquipmentEffects {
  const fx: EquipmentEffects = { art: 0, story: 0, pagesMult: 1, workCost: 0, restBonus: 0 }
  for (const id of s.studio.owned) {
    const b = equipmentById(id).bonus
    fx.art += b.art ?? 0
    fx.story += b.story ?? 0
    fx.pagesMult *= b.pagesMult ?? 1
    fx.workCost += b.workCost ?? 0
    fx.restBonus += b.restBonus ?? 0
  }
  return fx
}

function tierIndex(id: StudioTierId): number {
  return STUDIO_TIERS.findIndex((t) => t.id === id)
}

/** Is the studio `tier` or bigger? */
export function studioAtLeast(s: GameState, tier: StudioTierId): boolean {
  return tierIndex(s.studio.tier) >= tierIndex(tier)
}

/** Move one tier up, paying its move-in cost. Anything else (a skipped tier, a move down, too little money) is refused. */
export function moveStudio(s: GameState, tier: StudioTierId): GameState {
  if (tierIndex(tier) !== tierIndex(s.studio.tier) + 1) return s
  const cost = moveInCost(tier)
  if (s.player.money < cost) return s
  const t = studioTierById(tier)
  const next: GameState = {
    ...s,
    studio: { ...s.studio, tier },
    player: { ...s.player, money: s.player.money - cost },
  }
  return addLog(
    next, 'money',
    `You moved into the ${t.name.toLowerCase()}: -¥${cost}. Rent is ¥${t.rent} a week, and it has ${t.desks} desks for assistants.`,
    true,
  )
}

/** Buy a piece of equipment. Refused when the studio owns it, the player cannot pay, or the studio is too small. */
export function buyEquipment(s: GameState, id: EquipmentId): GameState {
  if (s.studio.owned.includes(id)) return s
  const e = equipmentById(id)
  if (e.needsTier && !studioAtLeast(s, e.needsTier)) return s
  const price = equipmentPrice(id)
  if (s.player.money < price) return s
  const next: GameState = {
    ...s,
    studio: { ...s.studio, owned: [...s.studio.owned, id] },
    player: { ...s.player, money: s.player.money - price },
  }
  return addLog(next, 'money', `You bought the ${e.name.toLowerCase()}: -¥${price}. ${e.effect}.`, true)
}

/** What the studio scene draws: the room, its desks, the equipment and the volumes on the shelf. */
export interface StudioLook {
  tier: StudioTierId
  desks: number
  /** the studio's own `owned` list, never a copy, so the scene can compare it by reference */
  equipment: readonly EquipmentId[]
  /** volumes shipped across the running serial and every past one, at most 24 */
  volumes: number
}

export function studioLook(s: GameState): StudioLook {
  const shipped = s.serials.reduce((sum, x) => sum + x.volumes, s.serial?.volumes ?? 0)
  return { tier: s.studio.tier, desks: studioSlots(s), equipment: s.studio.owned, volumes: Math.min(SHELF_VOLUMES, shipped) }
}
