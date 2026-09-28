import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT, EQUIPMENT_IDS, EQUIPMENT_PRICE_SCALE, MILESTONES, STUDIO_TIERS, TRAITS, WORK_STAMINA_COST, basePagesPerDay,
  buyEquipment, chapterDeadline, createGame, equipmentEffects, equipmentPrice, expectedPagesToday, hireAssistant,
  moveInCost, moveStudio, setActivity, startProject, startTrip, studioLook, studioSlots, tick, tickMany, weeklyCosts,
} from '../index'
import type { Assistant, EquipmentId, GameState, Serial, StudioLook, StudioTierId } from '../index'
import { DRAFT } from '../../test/fixtures'

function withStudio(s: GameState, tier: StudioTierId, owned: EquipmentId[] = []): GameState {
  return { ...s, studio: { tier, owned } }
}

function withMoney(s: GameState, money: number): GameState {
  return { ...s, player: { ...s.player, money } }
}

/** Yen with thousands commas, formatted independently of the sim's own formatter. */
function yen(n: number): string {
  return `¥${n.toLocaleString('en-US')}`
}

/** Seed 42 with a fresh one-shot on the desk, set to draw, owning `owned`. */
function drawing(owned: EquipmentId[] = [], tier: StudioTierId = 'loft'): GameState {
  return withStudio(startProject(createGame('Rin', 42), DRAFT), tier, owned)
}

describe('studio data', () => {
  it('has the three tiers of the brief: desks, weekly rent and move-in', () => {
    expect(STUDIO_TIERS.map((t) => [t.id, t.name, t.desks, t.rent, t.moveIn])).toEqual([
      ['apartment', 'Apartment', 1, 0, 0],
      ['flat', 'Studio flat', 2, 150, 5000],
      ['loft', 'Studio loft', 3, 350, 15000],
    ])
  })

  it('has the six pieces of equipment of the brief, in draw order, with their base prices and effect text', () => {
    expect(EQUIPMENT_IDS).toEqual(['coffee', 'lamp', 'shelf', 'chair', 'drafting-table', 'tablet'])
    expect(EQUIPMENT.map((e) => [e.id, e.name, e.price, e.effect, e.needsTier ?? null])).toEqual([
      ['coffee', 'Coffee machine', 2000, 'Resting restores 3 more stamina a day', null],
      ['lamp', 'Daylight lamp', 2500, 'Art +3 on your pages', null],
      ['shelf', 'Reference shelf', 3000, 'Story +3 on your pages', null],
      ['chair', 'Ergonomic chair', 4000, 'Drawing costs 1 less stamina a day (min 2)', null],
      ['drafting-table', 'Drafting table', 7000, '10% more pages a day', null],
      ['tablet', 'Pen tablet', 12000, '15% more pages a day, art +2', 'flat'],
    ])
  })

  it('sells at 11.25 times the base prices: EQUIPMENT_PRICE_SCALE is S1 / 9000 = 11.17 rounded to 0.25', () => {
    // S1 = ¥100,573 (Task C, 0.7.0): 100,573 / 9000 = 11.17, and 11.17 x 4 = 44.70 rounds to 45 quarters
    expect(EQUIPMENT_PRICE_SCALE).toBe(11.25)
    // x 11.25, to the nearest ¥100 (halves round up): 2,000 -> 22,500; 2,500 -> 28,125 -> 28,100;
    // 3,000 -> 33,750 -> 33,800; 4,000 -> 45,000; 7,000 -> 78,750 -> 78,800; 12,000 -> 135,000
    expect(EQUIPMENT_IDS.map((id) => equipmentPrice(id))).toEqual([22_500, 28_100, 33_800, 45_000, 78_800, 135_000])
    // the apartment is free; 5,000 -> 56,250 -> 56,300 for the flat, 15,000 -> 168,750 -> 168,800 for the loft
    expect(STUDIO_TIERS.map((t) => moveInCost(t.id))).toEqual([0, 56_300, 168_800])
  })

  it('prices are the base price times the price scale, rounded to the nearest ¥100', () => {
    for (const e of EQUIPMENT) {
      expect(equipmentPrice(e.id) % 100).toBe(0)
      expect(Math.abs(equipmentPrice(e.id) - e.price * EQUIPMENT_PRICE_SCALE)).toBeLessThanOrEqual(50)
    }
    for (const t of STUDIO_TIERS) {
      expect(moveInCost(t.id) % 100).toBe(0)
      expect(Math.abs(moveInCost(t.id) - t.moveIn * EQUIPMENT_PRICE_SCALE)).toBeLessThanOrEqual(50)
    }
  })
})

describe('studio tiers', () => {
  it('a new career starts in the apartment with no equipment', () => {
    expect(createGame('Rin', 42).studio).toEqual({ tier: 'apartment', owned: [] })
  })

  it('has one desk in the apartment, two in the flat and three in the loft', () => {
    const g = createGame('Rin', 42)
    expect(studioSlots(g)).toBe(1)
    expect(studioSlots(withStudio(g, 'flat'))).toBe(2)
    expect(studioSlots(withStudio(g, 'loft'))).toBe(3)
  })

  it('adds the rent to the weekly costs: 400 + 150 in the flat, 400 + 350 in the loft', () => {
    const g = createGame('Rin', 42)
    expect(weeklyCosts(g)).toBe(400)
    expect(weeklyCosts(withStudio(g, 'flat'))).toBe(550)
    expect(weeklyCosts(withStudio(g, 'loft'))).toBe(750)
  })

  it('charges the rent every week and names it in the weekly log', () => {
    const s = tickMany(withStudio(createGame('Rin', 42), 'flat'), 7)
    expect(s.player.money).toBe(3000 - 550)
    expect(s.log.at(-1)!.text).toBe('Weekly costs: -¥550 (living ¥400, rent ¥150).')
    // no rent: the log line a new career has always had
    expect(tickMany(createGame('Rin', 42), 7).log.at(-1)!.text).toBe('Weekly living costs: -¥400.')
  })

  it('names living, rent and salaries when the studio has all three', () => {
    let s = withStudio(createGame('Rin', 42), 'loft')
    const c = s.candidates[0]
    s = tickMany(hireAssistant(s, c.id), 7)
    expect(s.log.filter((e) => e.kind === 'money').at(-1)!.text)
      .toBe(`Weekly costs: -¥${750 + c.salary} (living ¥400, rent ¥350, salaries ¥${c.salary}).`)
  })

  it('blocks a second hire in the apartment: one desk', () => {
    const s = withMoney(createGame('Rin', 42), 100_000)
    const one = hireAssistant(s, s.candidates[0].id)
    expect(one.assistants).toHaveLength(1)
    expect(hireAssistant(one, one.candidates[0].id)).toBe(one)
  })

  it('lets the flat seat two assistants and the loft three', () => {
    const rich = withMoney(createGame('Rin', 42), 100_000)
    let flat = withStudio(rich, 'flat')
    flat = hireAssistant(flat, flat.candidates[0].id)
    flat = hireAssistant(flat, flat.candidates[0].id)
    expect(flat.assistants).toHaveLength(2)
    expect(hireAssistant(flat, flat.candidates[0].id)).toBe(flat)
    let loft = withStudio(flat, 'loft')
    loft = hireAssistant(loft, loft.candidates[0].id)
    expect(loft.assistants).toHaveLength(3)
  })

  it('keeps the money runway rule: a free desk still needs two weeks of the salary in the bank', () => {
    const g = withStudio(createGame('Rin', 42), 'flat')
    const c = g.candidates[0]
    const short = withMoney(g, c.salary * 2 - 1)
    expect(hireAssistant(short, c.id)).toBe(short)
  })

  it('moves one tier up for its move-in cost, and logs it', () => {
    // amounts read the price helpers, so a new price scale leaves the test standing
    const s = moveStudio(withMoney(createGame('Rin', 42), moveInCost('flat') + 1000), 'flat')
    expect(s.studio.tier).toBe('flat')
    expect(s.player.money).toBe(1000)
    const last = s.log.at(-1)!
    expect(last).toMatchObject({ kind: 'money', toast: true })
    expect(last.text).toBe(`You moved into the studio flat: -${yen(moveInCost('flat'))}. Rent is ¥150 a week, and it has 2 desks for assistants.`)
    const loft = moveStudio(withMoney(s, moveInCost('loft')), 'loft')
    expect(loft.studio.tier).toBe('loft')
    expect(loft.player.money).toBe(0)
    // at today's price scale (11.25) the log reads "-¥168,800"
    expect(loft.log.at(-1)!.text).toBe(`You moved into the studio loft: -${yen(moveInCost('loft'))}. Rent is ¥350 a week, and it has 3 desks for assistants.`)
  })

  it('refuses a move it cannot afford, a skipped tier, and a move sideways or down', () => {
    const g = createGame('Rin', 42)
    const short = withMoney(g, moveInCost('flat') - 1)
    expect(moveStudio(short, 'flat')).toBe(short)
    const rich = withMoney(g, 1_000_000)
    expect(moveStudio(rich, 'loft')).toBe(rich)
    expect(moveStudio(rich, 'apartment')).toBe(rich)
    const loft = withStudio(rich, 'loft')
    expect(moveStudio(loft, 'flat')).toBe(loft)
    expect(moveStudio(loft, 'loft')).toBe(loft)
  })
})

describe('equipment', () => {
  it('buying deducts the price, adds it to what the studio owns and logs its effect', () => {
    const s = buyEquipment(withMoney(createGame('Rin', 42), equipmentPrice('lamp') + 1000), 'lamp')
    expect(s.player.money).toBe(1000)
    expect(s.studio.owned).toEqual(['lamp'])
    const last = s.log.at(-1)!
    expect(last).toMatchObject({ kind: 'money', toast: true })
    expect(last.text).toBe(`You bought the daylight lamp: -${yen(equipmentPrice('lamp'))}. Art +3 on your pages.`)
    expect(buyEquipment(withMoney(s, equipmentPrice('coffee')), 'coffee').studio.owned).toEqual(['lamp', 'coffee'])
  })

  it('refuses to buy a piece twice', () => {
    const s = withMoney(buyEquipment(withMoney(createGame('Rin', 42), 100_000), 'lamp'), 100_000)
    expect(s.studio.owned).toEqual(['lamp'])
    expect(buyEquipment(s, 'lamp')).toBe(s)
  })

  it('refuses a piece the player cannot afford', () => {
    const short = withMoney(createGame('Rin', 42), equipmentPrice('chair') - 1)
    expect(buyEquipment(short, 'chair')).toBe(short)
    expect(buyEquipment(withMoney(short, equipmentPrice('chair')), 'chair').player.money).toBe(0)
  })

  it('refuses the pen tablet in the apartment, sells it from the flat on', () => {
    // ¥200,000 covers the tablet's ¥135,000 at the price scale 11.25
    const rich = withMoney(createGame('Rin', 42), 200_000)
    expect(buyEquipment(rich, 'tablet')).toBe(rich)
    expect(buyEquipment(withStudio(rich, 'flat'), 'tablet').studio.owned).toEqual(['tablet'])
    expect(buyEquipment(withStudio(rich, 'loft'), 'tablet').studio.owned).toEqual(['tablet'])
  })

  it('sums the effects of what the studio owns; page multipliers compose', () => {
    const g = createGame('Rin', 42)
    expect(equipmentEffects(g)).toEqual({ art: 0, story: 0, pagesMult: 1, workCost: 0, restBonus: 0 })
    const all = equipmentEffects(withStudio(g, 'loft', [...EQUIPMENT_IDS]))
    // art 3 (lamp) + 2 (tablet); pages 1.1 x 1.15 = 1.265
    expect(all).toMatchObject({ art: 5, story: 3, workCost: -1, restBonus: 3 })
    expect(all.pagesMult).toBeCloseTo(1.265, 12)
  })
})

describe('equipment in a working day', () => {
  it('daylight lamp: the day adds exactly 3 art for every page the player drew, and nothing else changes', () => {
    const without = tick(drawing())
    const lamp = tick(drawing(['lamp']))
    const pages = without.project!.pagesDone
    expect(pages).toBeGreaterThan(0)
    expect(lamp.project!.pagesDone).toBe(pages)
    expect(lamp.project!.artSum - without.project!.artSum).toBeCloseTo(3 * pages, 9)
    expect(lamp.project!.storySum).toBe(without.project!.storySum)
    // the same three draws: the RNG stream is where it would have been
    expect(lamp.seed).toBe(without.seed)
  })

  it('reference shelf: exactly 3 story for every page the player drew', () => {
    const without = tick(drawing())
    const shelf = tick(drawing(['shelf']))
    expect(shelf.project!.storySum - without.project!.storySum).toBeCloseTo(3 * without.project!.pagesDone, 9)
    expect(shelf.project!.artSum).toBe(without.project!.artSum)
  })

  it('the bonus is on the player\'s pages only, not the assistants\'', () => {
    const solo = tick(drawing())
    const helped = (owned: EquipmentId[]) => {
      const s = drawing(owned)
      return tick(hireAssistant(s, s.candidates[0].id))
    }
    const without = helped([])
    const lamp = helped(['lamp'])
    // the player's pages come from the day's first draw, which does not depend on how many assistants draw after it
    expect(without.project!.pagesDone).toBeGreaterThan(solo.project!.pagesDone)
    expect(lamp.project!.artSum - without.project!.artSum).toBeCloseTo(3 * solo.project!.pagesDone, 9)
  })

  it('caps a sample that the bonus would push past 100', () => {
    const at = (owned: EquipmentId[]) => {
      const s = drawing(owned)
      return tick({ ...s, focus: 'art', player: { ...s.player, stats: { ...s.player.stats, art: 100 } } })
    }
    // art 100 x 1.25 (art focus) + noise in [-8, 8) is at least 117: every sample is clamped to 100, lamp or not
    const perPage = (g: GameState) => g.project!.artSum / g.project!.pagesDone
    expect(perPage(at([]))).toBeCloseTo(100, 9)
    expect(perPage(at(['lamp']))).toBeCloseTo(100, 9)
  })

  it('drafting table: exactly 1.1 times the pages', () => {
    const without = tick(drawing())
    const table = tick(drawing(['drafting-table']))
    expect(table.project!.pagesDone / without.project!.pagesDone).toBeCloseTo(1.1, 12)
    expect(table.seed).toBe(without.seed)
  })

  it('pen tablet: 1.15 times the pages and 2 more art a page; with the drafting table 1.265 times', () => {
    const without = tick(drawing())
    const tablet = tick(drawing(['tablet']))
    expect(tablet.project!.pagesDone / without.project!.pagesDone).toBeCloseTo(1.15, 12)
    const artPerPage = (g: GameState) => g.project!.artSum / g.project!.pagesDone
    expect(artPerPage(tablet) - artPerPage(without)).toBeCloseTo(2, 9)
    const both = tick(drawing(['tablet', 'drafting-table']))
    expect(both.project!.pagesDone / without.project!.pagesDone).toBeCloseTo(1.265, 12)
  })

  it('the page multiplier reaches every pace the desk and the deadline read', () => {
    const g = drawing()
    const table = drawing(['drafting-table'])
    // stats 40/34: 0.5 + 37 x 0.02 = 1.24 pages a day, x 1.1 = 1.364
    expect(basePagesPerDay(g)).toBeCloseTo(1.24, 12)
    expect(basePagesPerDay(table)).toBeCloseTo(1.364, 12)
    expect(expectedPagesToday(table)).toBeCloseTo(1.364, 12)
  })

  it('the drafting table turns a late chapter tight: 16 pages at 1.24 a day is 13 days, at 1.364 it is 12', () => {
    const serial = (owned: EquipmentId[]): GameState => {
      const g = createGame('Rin', 42)
      const project = { ...startProject(g, DRAFT).project!, kind: 'serial' as const, chapter: 1, pagesTarget: 16 }
      const ser = { id: 1, status: 'running', nextDueDay: 12 } as Serial
      return withStudio({ ...g, project, serial: ser }, 'loft', owned)
    }
    expect(chapterDeadline(serial([]))).toMatchObject({ workDaysLeft: 13, status: 'late' })
    expect(chapterDeadline(serial(['drafting-table']))).toMatchObject({ workDaysLeft: 12, status: 'tight' })
  })

  it('ergonomic chair: a working day costs 4 stamina instead of 5 (100 -> 96)', () => {
    expect(tick(drawing()).player.stamina).toBe(95)
    expect(tick(drawing(['chair'])).player.stamina).toBe(96)
  })

  it('ergonomic chair with an inspiring assistant: 3 a day, and never below 2', () => {
    const inspiring: Assistant = {
      id: 900, name: 'Ivy', art: 30, story: 30, salary: 360, stamina: 80, maxStamina: 80, trait: 'inspiring', look: 0,
    }
    const withIvy = (owned: EquipmentId[]) => ({ ...drawing(owned), assistants: [inspiring] })
    expect(tick(withIvy(['chair'])).player.stamina).toBe(97)
    // a studio cannot own two chairs; this guards the floor: 5 - 1 - 3 would be 1, the floor keeps it at 2
    expect(tick(withIvy(['chair', 'chair', 'chair'])).player.stamina).toBe(98)
  })

  it('coffee machine: a rest day restores 17 instead of 14 (50 -> 67)', () => {
    const resting = (owned: EquipmentId[]) => {
      const g = withStudio(createGame('Rin', 42), 'apartment', owned)
      return setActivity({ ...g, player: { ...g.player, stamina: 50 } }, 'rest')
    }
    expect(tick(resting([])).player.stamina).toBe(64)
    expect(tick(resting(['coffee'])).player.stamina).toBe(67)
  })

  it('coffee machine: a day away on a trip still restores 8 (the machine is at the studio)', () => {
    const g = withStudio(createGame('Rin', 42), 'apartment', ['coffee'])
    const away = startTrip({ ...g, player: { ...g.player, stamina: 50 } }, 'library')
    expect(tick(away).player.stamina).toBe(58)
  })
})

describe('copy that stays true with a studio', () => {
  it('the Inspiring trait names the stamina it saves, never the cost the chair also changes', () => {
    // "instead of 5" would be false with the chair (3 instead of 4); the saving stays true with any equipment
    expect(TRAITS.inspiring.blurb).not.toContain('instead of')
    expect(TRAITS.inspiring.blurb).not.toContain(String(WORK_STAMINA_COST))
    expect(TRAITS.inspiring.blurb).toContain('1 less stamina a day')
  })

  it('the Full studio milestone says three assistants need the loft', () => {
    expect(MILESTONES.find((m) => m.id === 'three-assistants')!.hint)
      .toBe('Employ three assistants (the studio loft seats three)')
  })
})

describe('studioLook', () => {
  it('reads the tier, its desks, the owned list itself (not a copy) and the volumes on the shelf', () => {
    const g = withStudio(createGame('Rin', 42), 'flat', ['lamp', 'coffee'])
    const look = studioLook(g)
    expect(look).toEqual({ tier: 'flat', desks: 2, equipment: ['lamp', 'coffee'], volumes: 0, animePoster: false, trophies: [] })
    expect(look.equipment).toBe(g.studio.owned)
    expect(look.trophies).toBe(g.awards)
  })

  it('gives the same value or reference for every field on every call, so a shallow compare holds', () => {
    const g = { ...withStudio(createGame('Rin', 42), 'flat', ['lamp']), awards: [{ id: 'critics', year: 1 }] } as GameState
    const a = studioLook(g)
    const b = studioLook(g)
    for (const k of Object.keys(a) as (keyof StudioLook)[]) expect(b[k]).toBe(a[k])
  })

  it('counts the volumes of the running serial and every past one, at most 24', () => {
    const vols = (n: number) => ({ volumes: n }) as Serial
    const g = createGame('Rin', 42)
    expect(studioLook({ ...g, serial: vols(3), serials: [vols(4), vols(6)] }).volumes).toBe(13)
    expect(studioLook({ ...g, serial: null, serials: [vols(4), vols(6)] }).volumes).toBe(10)
    expect(studioLook({ ...g, serial: vols(9), serials: [vols(10), vols(6)] }).volumes).toBe(24)
  })
})
