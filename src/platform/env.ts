// Where the game runs. Kept free of @tauri-apps imports so the browser build can ask without loading any Tauri code.

/** True in the desktop app: Tauri 2 sets `isTauri` on the window before any page script runs. */
export function isDesktop(): boolean {
  return !!(globalThis as { isTauri?: unknown }).isTauri
}
