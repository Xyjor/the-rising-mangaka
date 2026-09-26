/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite would otherwise clear the terminal and hide the Tauri CLI's Rust output.
  clearScreen: false,
  // tauri.conf.json devUrl expects exactly this port, and Rust rebuilds must not trigger a page reload.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', 'dist/**', 'src-tauri/**', '.claude/**'],
  },
})
