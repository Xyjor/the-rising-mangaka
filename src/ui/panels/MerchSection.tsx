import { MERCH_ITEMS, activeMerchRuns, merchForecast, merchItemById, merchRefusal } from '../../sim'
import type { MerchItem, Serial } from '../../sim'
import { useStore } from '../../state/store'
import { MERCH_ART, MERCH_LICENCE_ART } from '../art/registry'
import { PixelArt } from '../art/PixelArt'
import { Bar } from '../components'
import { money, plural } from '../format'

const LOCKED = 'A goods maker licenses series from year two, once a volume has shipped.'

function MerchRow({ item, ser }: { item: MerchItem; ser: Serial }) {
  const game = useStore((s) => s.game)!
  const readOnly = useStore((s) => s.readOnly)
  const orderMerch = useStore((s) => s.orderMerch)
  const f = merchForecast(game, item.id, ser.id)
  const refusal = merchRefusal(game, item.id, ser.id)
  const net = f.net >= 0 ? `net +${money(f.net)}` : `net ${money(f.net)}`
  return (
    <li className="merch-row" data-item={item.id}>
      <span className="merch-art" aria-hidden="true">
        <PixelArt art={MERCH_ART[item.id]} />
      </span>
      <div className="grow">
        <div><b>{item.name}</b> <span className="small muted">{money(item.cost)}, {plural(item.weeks, 'week')}</span></div>
        <div className="small">
          About {money(f.total)} back over {plural(f.weeks, 'week')} if popularity holds (<span className={f.net < 0 ? 'merch-net neg' : 'merch-net'}>{net}</span>).
        </div>
        {refusal && <div className="small muted merch-refusal">{refusal}</div>}
      </div>
      <button className="btn" disabled={!!refusal || readOnly} onClick={() => orderMerch(item.id, ser.id)}>
        Order a run for {money(item.cost)}
      </button>
    </li>
  )
}

/** The Series panel's Goods section: the licence rule, then a row per item and the runs selling for this series. */
export function MerchSection({ ser }: { ser: Serial }) {
  const game = useStore((s) => s.game)!
  const runs = activeMerchRuns(game).filter((r) => r.serialId === ser.id)
  return (
    <section className="card flat merch" aria-labelledby={`merch-${ser.id}`}>
      <div className="row merch-head" style={{ gap: 8 }}>
        <span className="merch-art" aria-hidden="true"><PixelArt art={MERCH_LICENCE_ART} /></span>
        <div className="lbl" id={`merch-${ser.id}`}>Goods</div>
      </div>
      {game.merch.licensedDay === null ? (
        <p className="small merch-locked">{LOCKED}</p>
      ) : (
        <>
          {runs.length > 0 && (
            <ul className="plain merch-runs">
              {runs.map((r) => {
                const m = merchItemById(r.item)
                const weeksLeft = Math.ceil((r.endsDay - game.day) / 7)
                return (
                  <li key={r.id} className="merch-run small">
                    <div className="row between">
                      <span><b>{m.name}</b>: {plural(weeksLeft, 'week')} left</span>
                      <span>{money(r.money)} so far</span>
                    </div>
                    <Bar value={m.weeks - weeksLeft} max={m.weeks} tone="gold" label={`${m.name} weeks sold`} />
                  </li>
                )
              })}
            </ul>
          )}
          <ul className="plain merch-list">
            {MERCH_ITEMS.map((m) => <MerchRow key={m.id} item={m} ser={ser} />)}
          </ul>
          <p className="tiny muted">Each week a run sells a share of this series' average volume copies, times its popularity (half its final popularity once it has ended). Goods never change fans or copies.</p>
        </>
      )}
    </section>
  )
}
