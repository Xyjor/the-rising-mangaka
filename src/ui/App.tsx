import { useEffect, useLayoutEffect } from 'react'
import { getPhase } from '../sim'
import { clockRuns } from '../state/clockRuns'
import { SPEED_MS, useStore } from '../state/store'
import { useArrival } from './hooks/useArrival'
import { useClockLoop, useClockSync } from './hooks/useClockLoop'
import { DeskTray } from './hud/DeskTray'
import { DeskButton, LogButton, Rail, SettingsButton } from './hud/Rail'
import { StatusCard } from './hud/StatusCard'
import { TopLeft } from './hud/TopLeft'
import { TopRight } from './hud/TopRight'
import { TabBanner } from './TabBanner'
import { Toasts } from './Toasts'
import { TitleScreen } from './TitleScreen'
import { TutorialGuide } from './TutorialGuide'
import { BadgesModal } from './panels/BadgesModal'
import { CareerModal } from './panels/CareerModal'
import { HistoryModal } from './panels/HistoryModal'
import { LogModal } from './panels/LogModal'
import { NewMangaWizard } from './panels/NewMangaWizard'
import { NotebookModal } from './panels/NotebookModal'
import { OfferModal } from './panels/OfferModal'
import { ResultsModal } from './panels/ResultsModal'
import { SeriesModal } from './panels/SeriesModal'
import { SettingsModal } from './panels/SettingsModal'
import { StaffModal } from './panels/StaffModal'
import { StatsModal } from './panels/StatsModal'
import { StudioModal } from './panels/StudioModal'
import { SubmitModal } from './panels/SubmitModal'
import { TripsModal } from './panels/TripsModal'
import { YearModal } from './panels/YearModal'
import { StudioScene } from './scene/StudioScene'

function useTheme() {
  const theme = useStore((s) => s.theme)
  // Layout effect so the saved theme lands before the first paint (index.html pre-applies it too).
  useLayoutEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
}

/** The clock: ticks the sim while running and nothing needs a decision. */
function useGameClock() {
  const speed = useStore((s) => s.speed)
  const tick = useStore((s) => s.tick)
  const running = useStore((s) => clockRuns(s))
  useEffect(() => {
    if (!running || speed === 0) return
    const id = window.setInterval(tick, SPEED_MS[speed])
    return () => window.clearInterval(id)
  }, [running, speed, tick])
  useClockLoop(running, speed)
  return running
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.repeat) return
      const st = useStore.getState()
      if (!st.game) return
      const phase = getPhase(st.game)
      const blocked = st.modal !== 'none' || !!st.game.pendingResult || !!st.game.pendingOffer
      if (blocked) return
      const trip = !!st.game.trip
      const canPickActivity = !trip && (phase === 'idle' || phase === 'drawing' || phase === 'submitted')
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
        case 'l': st.openModal('log'); break
        case 'g': st.openModal('badges'); break
        case 'd': st.toggleDesk(); break
        case 'w': if (!trip && phase === 'drawing') st.setActivity('work'); break
        case 'r': if (canPickActivity) st.setActivity('rest'); break
        case 'j': if (canPickActivity) st.setActivity('job'); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function App() {
  useTheme()
  useClockSync()
  const hasGame = useStore((s) => !!s.game)
  const modal = useStore((s) => s.modal)
  const hasResult = useStore((s) => !!s.game?.pendingResult)
  const hasOffer = useStore((s) => !!s.game?.pendingOffer)
  const phase = useStore((s) => (s.game ? getPhase(s.game) : 'idle'))
  const trip = useStore((s) => !!s.game?.trip)
  const deskHidden = useStore((s) => s.deskHidden)
  const running = useGameClock()
  // the results and the offer open once the editor has walked in with them (the clock is already paused)
  const arrived = useArrival(hasResult || hasOffer)
  useHotkeys()

  if (!hasGame) return <TitleScreen />

  const free = !hasResult && !hasOffer
  return (
    <div className="app" data-running={running}>
      <TabBanner />
      <div className="stage">
        <div className="scene-band">
          <StudioScene running={running} />
          <TopLeft />
          <TopRight />
          <LogButton />
          <DeskButton />
          <SettingsButton />
        </div>
        <div className="dock" hidden={deskHidden}>
          <StatusCard />
          <DeskTray />
        </div>
        <Rail />
      </div>
      <Toasts />
      <TutorialGuide />
      {arrived && hasResult && <ResultsModal />}
      {arrived && !hasResult && hasOffer && <OfferModal />}
      {free && modal === 'wizard' && phase === 'idle' && !trip && <NewMangaWizard />}
      {free && modal === 'submit' && phase === 'ready' && <SubmitModal />}
      {free && modal === 'notebook' && <NotebookModal />}
      {free && modal === 'stats' && <StatsModal />}
      {free && modal === 'history' && <HistoryModal />}
      {free && modal === 'settings' && <SettingsModal />}
      {free && modal === 'staff' && <StaffModal />}
      {free && modal === 'trips' && <TripsModal />}
      {free && modal === 'series' && <SeriesModal />}
      {free && modal === 'career' && <CareerModal />}
      {free && modal === 'badges' && <BadgesModal />}
      {free && modal === 'studio' && <StudioModal />}
      {free && modal === 'year' && <YearModal />}
      {free && modal === 'log' && <LogModal />}
    </div>
  )
}
