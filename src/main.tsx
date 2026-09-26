import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (fontsource declares 'Nunito' and 'Bangers', matching tokens.css).
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/nunito/900.css'
import '@fontsource/bangers/400.css'
import './styles/base.css'
import './styles/app.css'
import { App } from './ui/App'
import { useStore } from './state/store'
import * as sim from './sim'
import { connectSound } from './audio/bridge'
import { createSoundEngine } from './audio/engine'
import { installSound, nullEngine } from './audio/instance'
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

// Dev-only handles for poking the simulation and the sound from the browser console.
if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, { __store: useStore, __sim: sim, __sound: engine })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
