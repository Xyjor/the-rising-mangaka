import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
