import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (fontsource declares 'Nunito' and 'Bangers', matching tokens.css).
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/nunito/900.css'
import '@fontsource/silkscreen/400.css'
import '@fontsource/silkscreen/700.css'
import './styles/base.css'
import './styles/app.css'
import './styles/stage.css'
import './styles/hud.css'
import { App } from './ui/App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { useStore } from './state/store'
import * as sim from './sim'
import { connectSound } from './audio/bridge'
import { createSoundEngine } from './audio/engine'
import { installSound, nullEngine } from './audio/instance'
import { isTrackId } from './audio/music/tracks'
import { isDesktop } from './platform/env'

// One sound engine for the app, following the store. A browser without Web Audio, or one that refuses a context,
// stays silent.
function newAudioContext(): AudioContext | null {
  try {
    return new AudioContext()
  } catch {
    return null
  }
}
const engine = typeof AudioContext === 'undefined' ? nullEngine : createSoundEngine({ createContext: newAudioContext })
installSound(engine)
connectSound(useStore, engine)

// The desktop app's window behaviour, in its own chunk so the browser never loads the Tauri API.
if (isDesktop()) void import('./platform/desktop').then((m) => m.installDesktopShell())

// Dev-only handles for poking the simulation and the sound from the browser console, and `?music=<id>` to pin one
// track for listening (an unknown id is ignored). A production build never reads either.
if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, { __store: useStore, __sim: sim, __sound: engine })
  const music = new URLSearchParams(location.search).get('music')
  if (music !== null && isTrackId(music)) engine.pinMusicTrack(music)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
