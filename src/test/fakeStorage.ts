import { vi } from 'vitest'

/** Map-backed stand-in for window.localStorage, installed before the module under test loads. */
export function installFakeStorage() {
  const map = new Map<string, string>()
  const fake = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: vi.fn((k: string, v: string) => { map.set(k, String(v)) }),
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true })
  return fake
}
