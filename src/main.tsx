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

// Dev-only handles for poking the simulation from the browser console.
if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, { __store: useStore, __sim: sim })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
