/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Tauri CLI prints its own output through the dev server's; keep both on screen.
  clearScreen: false,
  // tauri.conf.json devUrl expects exactly this port, and Rust rebuilds must not trigger a page reload.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', 'dist/**', 'src-tauri/**', '.claude/**'],
  },
})
