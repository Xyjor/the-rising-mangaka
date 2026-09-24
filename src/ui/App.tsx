import { useEffect } from 'react'
import { getPhase } from '../sim'
import { SPEED_MS, useStore } from '../state/store'
import { EventLog } from './EventLog'
import { Hud } from './Hud'
import { Toasts } from './Toasts'
import { TitleScreen } from './TitleScreen'
import { DeskPanel } from './panels/DeskPanel'
import { HistoryModal } from './panels/HistoryModal'
import { NewMangaWizard } from './panels/NewMangaWizard'
import { NotebookModal } from './panels/NotebookModal'
import { OfferModal } from './panels/OfferModal'
import { ResultsModal } from './panels/ResultsModal'
import { SeriesModal } from './panels/SeriesModal'
import { SettingsModal } from './panels/SettingsModal'
import { StaffModal } from './panels/StaffModal'
import { StatsModal } from './panels/StatsModal'
import { SubmitModal } from './panels/SubmitModal'
import { TripsModal } from './panels/TripsModal'
import { StudioScene } from './scene/StudioScene'

function useTheme() {
  const theme = useStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
}

/** The clock: ticks the sim while running and nothing needs a decision. */
function useGameClock() {
  const speed = useStore((s) => s.speed)
  const modal = useStore((s) => s.modal)
  const blocked = useStore((s) => !!s.game?.pendingResult || !!s.game?.pendingOffer)
  const hasGame = useStore((s) => !!s.game)
  const tick = useStore((s) => s.tick)
  const running = hasGame && speed > 0 && modal === 'none' && !blocked
  useEffect(() => {
    if (!running || speed === 0) return
    const id = window.setInterval(tick, SPEED_MS[speed])
    return () => window.clearInterval(id)
  }, [running, speed, tick])
  return running
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const st = useStore.getState()
      if (!st.game) return
      const phase = getPhase(st.game)
      const blocked = st.modal !== 'none' || !!st.game.pendingResult || !!st.game.pendingOffer
      if (blocked) return
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); st.togglePause(); break
        case '1': case '2': case '3': st.setSpeed(Number(e.key) as 1 | 2 | 3); break
        case 'n': if (phase === 'idle' && !st.game.trip) st.openModal('wizard'); break
        case 'm': if (phase === 'ready') st.openModal('submit'); break
        case 'b': st.openModal('notebook'); break
        case 's': st.openModal('stats'); break
        case 'h': st.openModal('history'); break
        case 'a': st.openModal('staff'); break
        case 't': st.openModal('trips'); break
        case 'w': if (phase === 'drawing') st.setActivity('work'); break
        case 'r': st.setActivity('rest'); break
        case 'j': st.setActivity('job'); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function App() {
  useTheme()
  const hasGame = useStore((s) => !!s.game)
  const modal = useStore((s) => s.modal)
  const hasResult = useStore((s) => !!s.game?.pendingResult)
  const hasOffer = useStore((s) => !!s.game?.pendingOffer)
  const running = useGameClock()
  useHotkeys()

  if (!hasGame) return <TitleScreen />

  const free = !hasResult && !hasOffer
  return (
    <div className="app">
      <Hud />
      <div className="main">
        <div className="studio">
          <StudioScene running={running} />
        </div>
        <DeskPanel />
      </div>
      <EventLog />
      <Toasts />
      {hasResult && <ResultsModal />}
      {!hasResult && hasOffer && <OfferModal />}
      {free && modal === 'wizard' && <NewMangaWizard />}
      {free && modal === 'submit' && <SubmitModal />}
      {free && modal === 'notebook' && <NotebookModal />}
      {free && modal === 'stats' && <StatsModal />}
      {free && modal === 'history' && <HistoryModal />}
      {free && modal === 'settings' && <SettingsModal />}
      {free && modal === 'staff' && <StaffModal />}
      {free && modal === 'trips' && <TripsModal />}
      {free && modal === 'series' && <SeriesModal />}
    </div>
  )
}
