import { useState } from 'react'
import { AUDIENCES, GENRES, RATING_LABEL, THEMES, genreThemeKey, themeAudienceKey } from '../../sim'
import { useStore } from '../../state/store'
import { Modal } from '../components'

const LETTER = ['B', 'M', 'G', 'G+', 'P']

export function NotebookModal() {
  const nb = useStore((s) => s.game!.notebook)
  const closeModal = useStore((s) => s.closeModal)
  const [tab, setTab] = useState<'gt' | 'ta'>('gt')

  const gtCount = Object.keys(nb.genreTheme).length
  const taCount = Object.keys(nb.themeAudience).length

  return (
    <Modal title="Notebook" sub="Everything you have learned about what readers like." onClose={closeModal}>
      <div className="col" style={{ gap: 14 }}>
        <div className="row between wrap">
          <div className="seg">
            <button aria-pressed={tab === 'gt'} onClick={() => setTab('gt')}>Genre × Theme <span className="faint">({gtCount}/{GENRES.length * THEMES.length})</span></button>
            <button aria-pressed={tab === 'ta'} onClick={() => setTab('ta')}>Theme × Audience <span className="faint">({taCount}/{THEMES.length * AUDIENCES.length})</span></button>
          </div>
          <div className="legend">
            {[0, 1, 2, 3, 4].map((r) => (
              <span key={r}><i style={{ background: `var(--rating-${r})` }} />{RATING_LABEL[r]}</span>
            ))}
            <span><i style={{ border: '1.5px dashed var(--line)' }} />Unknown</span>
          </div>
        </div>

        {tab === 'gt' ? (
          <div className="nb-grid" style={{ gridTemplateColumns: `110px repeat(${THEMES.length}, minmax(34px, 1fr))` }}>
            <div />
            {THEMES.map((t) => <div key={t.id} className="hdr" style={{ textAlign: 'center' }}>{t.name}</div>)}
            {GENRES.map((g) => (
              <Row key={g.id} label={g.name} cells={THEMES.map((t) => ({ key: t.id, r: nb.genreTheme[genreThemeKey(g.id, t.id)], title: `${g.name} × ${t.name}` }))} />
            ))}
          </div>
        ) : (
          <div className="nb-grid" style={{ gridTemplateColumns: `110px repeat(${AUDIENCES.length}, minmax(60px, 1fr))` }}>
            <div />
            {AUDIENCES.map((a) => <div key={a.id} className="hdr" style={{ textAlign: 'center' }}>{a.name}</div>)}
            {THEMES.map((t) => (
              <Row key={t.id} label={t.name} cells={AUDIENCES.map((a) => ({ key: a.id, r: nb.themeAudience[themeAudienceKey(t.id, a.id)], title: `${t.name} × ${a.name}` }))} />
            ))}
          </div>
        )}
        <p className="tiny faint">
          Pairings are revealed the first time you publish them. Perfect pairings score 100 on that component, bad ones score 20.
        </p>
      </div>
    </Modal>
  )
}

function Row({ label, cells }: { label: string; cells: { key: string; r: number | undefined; title: string }[] }) {
  return (
    <>
      <div className="hdr row">{label}</div>
      {cells.map((c) => (
        <div key={c.key} className="nb-cell" data-r={c.r} title={`${c.title}: ${c.r === undefined ? 'Unknown' : RATING_LABEL[c.r]}`}>
          {c.r === undefined ? '?' : LETTER[c.r]}
        </div>
      ))}
    </>
  )
}
