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
  build: {
    // Keep every generated art PNG as its own file (never base64-inlined), so PixelArt.tsx's <img src>
    // stays a real URL the browser can lazily load and cache.
    assetsInlineLimit: (filePath) => (filePath.includes('/assets/art/') ? false : undefined),
    // The cast's hand-drawn string maps load with the first frame, so they stay in the main chunk: 497 kB at 0.10.2,
    // about 541 kB at 0.11.0, over Vite's 500 kB default; 600 still flags real growth.
    chunkSizeWarningLimit: 600,
  },
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', 'dist/**', 'src-tauri/**', '.claude/**'],
  },
})
