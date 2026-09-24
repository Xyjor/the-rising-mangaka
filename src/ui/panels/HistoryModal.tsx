import { describeDate, genreById, magazineById, themeById } from '../../sim'
import { useStore } from '../../state/store'
import { Modal, money } from '../components'

export function HistoryModal() {
  const history = useStore((s) => s.game!.history)
  const closeModal = useStore((s) => s.closeModal)

  return (
    <Modal title="Published works" sub={`${history.length} so far`} onClose={closeModal}>
      {history.length === 0 ? (
        <p className="muted">Nothing published yet. Your first poll result will show up here.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th><th>Title</th><th>Pairing</th><th>Magazine</th>
              <th className="num">Rank</th><th className="num">Score</th><th className="num">Paid</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((r) => {
              const d = describeDate(r.day)
              return (
                <tr key={r.projectId}>
                  <td className="tiny faint">Y{d.year} M{d.month}</td>
                  <td><b>{r.title}</b></td>
                  <td className="small">{genreById(r.genre).name} × {themeById(r.theme).name}</td>
                  <td className="small">{magazineById(r.magazineId).name}</td>
                  <td className="num"><b>#{r.rank}</b><span className="faint">/{r.entrants}</span></td>
                  <td className="num">{r.score}</td>
                  <td className="num">{money(r.rewards.money)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
