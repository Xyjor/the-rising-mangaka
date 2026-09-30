import { useMemo, useState } from 'react'
import {
  AUDIENCES, GENRES, MAGAZINES, ONE_SHOT_PAGES, RATING_LABEL, STALENESS_PENALTY, THEMES, audienceById, genreById,
  genreThemeKey, previewCombo, stalenessCount, themeAudienceKey, themeById,
} from '../../sim'
import type { AudienceId, GenreId, ThemeId } from '../../sim'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import { GENRE_ART, THEME_ART } from '../art/registry'
import { ArtTile } from '../art/ArtTile'
import { Modal, Pips, RatingText } from '../components'

const STEPS = ['Genre', 'Theme', 'Audience', 'Title'] as const

const ADJ = ['Crimson', 'Silent', 'Eternal', 'Wandering', 'Neon', 'Broken', 'Golden', 'Midnight', 'Rising', 'Hollow', 'Wild', 'Last']
const THEME_NOUN: Record<ThemeId, string[]> = {
  school: ['Classroom', 'Club', 'Festival'], pirates: ['Tide', 'Compass', 'Crew'], ninja: ['Shadow', 'Shuriken', 'Clan'],
  cooking: ['Kitchen', 'Flame', 'Recipe'], music: ['Chord', 'Stage', 'Encore'], robots: ['Gear', 'Circuit', 'Titan'],
  vampires: ['Fang', 'Eclipse', 'Bloodline'], detective: ['Alibi', 'Case', 'Cipher'], space: ['Orbit', 'Nova', 'Voyager'],
  idols: ['Spotlight', 'Debut', 'Encore'], samurai: ['Blade', 'Honour', 'Ronin'], magic: ['Grimoire', 'Spell', 'Academy'],
}

function suggestTitle(theme: ThemeId): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)]
  const nouns = THEME_NOUN[theme]
  const n = nouns[Math.floor(Math.random() * nouns.length)]
  return Math.random() < 0.5 ? `${a} ${n}` : `${n} of the ${a}`
}

export function NewMangaWizard() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const startProject = useStore((s) => s.startProject)

  const [step, setStep] = useState(0)
  const [genre, setGenre] = useState<GenreId | null>(null)
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [audience, setAudience] = useState<AudienceId | null>(null)
  const [title, setTitle] = useState('')

  const ready = !!genre && !!theme && !!audience

  const combo = useMemo(
    () => (genre && theme && audience ? previewCombo(game, genre, theme, audience) : null),
    [game, genre, theme, audience],
  )

  const start = () => {
    if (ready) startProject({ title: title.trim() || suggestTitle(theme!), genre: genre!, theme: theme!, audience: audience! })
  }

  /** What each step tab shows once it has been answered. */
  const picks: (string | null)[] = [
    genre ? genreById(genre).name : null,
    theme ? themeById(theme).name : null,
    audience ? audienceById(audience).name : null,
    title.trim() || null,
  ]

  return (
    <Modal
      title="Plan a new manga"
      sub={`One-shot, ${ONE_SHOT_PAGES} pages. Pick a genre, a theme, and who it is for.`}
      onClose={closeModal}
      footer={
        <>
          <button className="btn ghost" onClick={() => (step > 0 ? setStep(step - 1) : closeModal())}>
            {step > 0 ? 'Back' : 'Cancel'}
          </button>
          {step === 3 && (
            <div className="row">
              <button className="btn" onClick={() => setTitle(suggestTitle(theme!))}><Icon name="dice" size={16} /> Suggest a title</button>
              <button className="btn primary" disabled={!ready} onClick={start}>Start drawing</button>
            </div>
          )}
        </>
      }
    >
      <div className="wizard">
        <nav className="steps" aria-label="Steps">
          {STEPS.map((s, i) => {
            const reachable = i <= step || [genre, theme, audience].slice(0, i).every(Boolean)
            return (
              <button
                key={s}
                type="button"
                aria-current={i === step ? 'step' : undefined}
                aria-disabled={reachable ? undefined : true}
                data-done={i < step && [genre, theme, audience][i] ? 'true' : undefined}
                onClick={() => { if (reachable) setStep(i) }}
              >
                {s}
                {picks[i] && <span className="pick">{picks[i]}</span>}
              </button>
            )
          })}
        </nav>

        {step === 0 && (
          <div className="choice-grid">
            {GENRES.map((g) => (
              <button key={g.id} className="choice" aria-pressed={genre === g.id} onClick={() => { setGenre(g.id); setStep(1) }}>
                <ArtTile art={GENRE_ART[g.id]} fallback="sun" scale={2} className="choice-art" />
                <span className="name">{g.name}</span>
                <span className="blurb">{g.blurb}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="choice-grid">
            {genre && <span className="sr-only">Hints show how this theme pairs with {genreById(genre).name}</span>}
            {THEMES.map((t) => {
              const known = genre ? game.notebook.genreTheme[genreThemeKey(genre, t.id)] : undefined
              const stale = genre ? stalenessCount(game, genre, t.id) : 0
              return (
                <button key={t.id} className="choice" aria-pressed={theme === t.id} onClick={() => { setTheme(t.id); setStep(2) }}>
                  <ArtTile art={THEME_ART[t.id]} fallback="sparkle" scale={2} className="choice-art" />
                  <span className="name">{t.name}</span>
                  <span className="blurb">{t.blurb}</span>
                  <span className="hint">
                    <Pips rating={known ?? null} />
                    <span className={known === undefined ? 'faint' : ''}>
                      {known === undefined ? 'Untested' : RATING_LABEL[known]}
                    </span>
                    {stale > 0 && <span style={{ color: 'var(--accent)', fontWeight: 800, marginLeft: 6 }}>Seen before</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="choice-grid">
            {AUDIENCES.map((a) => {
              const known = theme ? game.notebook.themeAudience[themeAudienceKey(theme, a.id)] : undefined
              return (
                <button key={a.id} className="choice" aria-pressed={audience === a.id} onClick={() => { setAudience(a.id); setStep(3) }}>
                  <span className="name">{a.name}</span>
                  <span className="blurb">{a.blurb}</span>
                  {MAGAZINES.filter((m) => m.audience === a.id).map((m) => (
                    <span className="blurb" key={m.id}>Read by {m.name}: {m.tasteLine}</span>
                  ))}
                  <span className="hint">
                    <Pips rating={known ?? null} />
                    <span className={known === undefined ? 'faint' : ''}>
                      {known === undefined ? 'Untested' : RATING_LABEL[known]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {step === 3 && (
          <div className="title-step">
            <div className="col" style={{ gap: 14 }}>
              <label className="col" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 800 }}>Title</span>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Leave blank for a surprise"
                  maxLength={40}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') start() }}
                />
              </label>
              <p className="small muted">
                The title is flavour. What matters is the combination, and how well you draw it.
              </p>
            </div>
            <div className="know card flat" style={{ padding: 12 }}>
              <div className="lbl">What you know</div>
              <div className="k">
                <span className="l">Freshness</span>
                <span className="row"><Pips rating={combo?.genreTheme ?? null} /><RatingText rating={combo?.genreTheme ?? null} /></span>
              </div>
              <div className="k">
                <span className="l">Audience fit</span>
                <span className="row"><Pips rating={combo?.themeAudience ?? null} /><RatingText rating={combo?.themeAudience ?? null} /></span>
              </div>
              {combo && combo.staleness > 0 && (
                <p className="tiny" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                  You used this pairing {combo.staleness}× recently: −{combo.staleness * STALENESS_PENALTY} freshness.
                </p>
              )}
              {(!combo || combo.genreTheme === null || combo.themeAudience === null) && (
                <p className="tiny faint">Untested pairings are recorded in your Notebook after the poll.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
