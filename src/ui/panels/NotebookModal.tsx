import { useState } from 'react'
import { AUDIENCES, GENRES, RATING_LABEL, THEMES, genreThemeKey, themeAudienceKey } from '../../sim'
import { useStore } from '../../state/store'
import { Modal } from '../components'

const LETTER = ['B', 'M', 'G', 'G+', 'P']

export function NotebookModal() {
  const nb = useStore((s) => s.game!.notebook)
  const closeModal = useStore((s) => s.closeModal)
  const [tab, setTab] = useState('genre-theme')

  const gtCount = Object.keys(nb.genreTheme).length
  const taCount = Object.keys(nb.themeAudience).length

  return (
    <Modal title="Notebook" sub="Everything you have learned about what readers like." onClose={closeModal}
      tabs={[
        { id: 'genre-theme', label: `Genre × Theme (${gtCount}/${GENRES.length * THEMES.length})` },
        { id: 'theme-audience', label: `Theme × Audience (${taCount}/${THEMES.length * AUDIENCES.length})` },
      ]}
      tab={tab} onTab={setTab}>
      <div className="col" style={{ gap: 14 }}>
        <div className="row between wrap">
          <div className="legend">
            {[0, 1, 2, 3, 4].map((r) => (
              <span key={r}><i style={{ background: `var(--rating-${r})` }} />{LETTER[r]} {RATING_LABEL[r]}</span>
            ))}
            <span><i style={{ border: '1px dashed var(--ink-3)' }} />Untested</span>
          </div>
        </div>

        {tab === 'genre-theme' ? (
          <div className="nb-grid" style={{ gridTemplateColumns: `96px repeat(${THEMES.length}, 24px)` }}>
            <div />
            {THEMES.map((t) => <div key={t.id} className="hdr col">{t.name}</div>)}
            {GENRES.map((g) => (
              <Row key={g.id} label={g.name} cells={THEMES.map((t) => ({ key: t.id, r: nb.genreTheme[genreThemeKey(g.id, t.id)], title: `${g.name} × ${t.name}` }))} />
            ))}
          </div>
        ) : (
          <div className="nb-grid" style={{ gridTemplateColumns: `96px repeat(${AUDIENCES.length}, 24px)` }}>
            <div />
            {AUDIENCES.map((a) => <div key={a.id} className="hdr col">{a.name}</div>)}
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
        <div key={c.key} className="nb-cell" data-r={c.r} title={`${c.title}: ${c.r === undefined ? 'Untested' : RATING_LABEL[c.r]}`}>
          <span aria-hidden="true">{c.r === undefined ? '?' : LETTER[c.r]}</span>
          <span className="sr-only">{c.title}: {c.r === undefined ? 'Untested' : RATING_LABEL[c.r]}</span>
        </div>
      ))}
    </>
  )
}
