/**
 * Loudness meter for the music. `loudness` is the pure part (RMS and peak of rendered channels, in dB). `measurePlayer`
 * is browser-only: it renders a music player offline through the real mixer graph and reports its plain RMS, its peak
 * and its K-weighted RMS, so the new tracks can be compared with the old loop (design doc, "Budgets and loudness").
 * Nothing in the app imports this file; it is run by hand from the dev preview.
 */
import { MUSIC_LEVEL } from '../engine'
import type { Timers } from '../music'
import { buildGraph } from '../synth'

const RATE = 44100
const TICK_SECONDS = 0.05

/** RMS and peak in dB re full scale; channels are averaged by power. Silence is -Infinity. */
export function loudness(channels: Float32Array[]): { rmsDb: number; peakDb: number } {
  let sum = 0
  let count = 0
  let peak = 0
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i]
      sum += v * v
      const a = Math.abs(v)
      if (a > peak) peak = a
    }
    count += ch.length
  }
  const rms = count === 0 ? 0 : Math.sqrt(sum / count)
  return { rmsDb: 20 * Math.log10(rms), peakDb: 20 * Math.log10(peak) }
}

async function render(
  make: (ctx: BaseAudioContext, dest: AudioNode, timers: Timers) => { start(): void },
  seconds: number,
  kWeighted: boolean,
): Promise<Float32Array[]> {
  const offline = new OfflineAudioContext(2, Math.ceil(RATE * seconds), RATE)
  const graph = buildGraph(offline, { master: 1, fx: 0, music: MUSIC_LEVEL })
  if (kWeighted) {
    // The compressor is private to buildGraph, so the K-weighted pass replaces it: the master's output (the
    // compressor's input) goes through the K filters to the destination. Below its -12 dB threshold the compressor
    // is transparent, so this reads the same level the listener hears.
    graph.master.disconnect()
    const high = offline.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 38
    const shelf = offline.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 1500
    shelf.gain.value = 4
    graph.master.connect(high)
    high.connect(shelf)
    shelf.connect(offline.destination)
  }
  let tick: (() => void) | null = null
  const timers: Timers = {
    setInterval(fn) {
      tick = fn
      return 1
    },
    clearInterval() {
      tick = null
    },
  }
  make(offline, graph.music, timers).start()
  for (let t = TICK_SECONDS; t < seconds; t += TICK_SECONDS) {
    void offline.suspend(t).then(() => {
      tick?.()
      void offline.resume()
    })
  }
  const buffer = await offline.startRendering()
  return [buffer.getChannelData(0), buffer.getChannelData(1)]
}

/**
 * Renders `seconds` of a player through the real mixer and measures it. Two passes: the plain one (after the master
 * compressor) gives `rmsDb` and `peakDb`; the K-weighted one (highpass 38 Hz, high shelf +4 dB at 1500 Hz) gives
 * `kRmsDb`. The player's interval timer is driven by suspending the context every 50 ms.
 */
export async function measurePlayer(
  make: (ctx: BaseAudioContext, dest: AudioNode, timers: Timers) => { start(): void },
  seconds: number,
): Promise<{ rmsDb: number; peakDb: number; kRmsDb: number }> {
  const plain = loudness(await render(make, seconds, false))
  const k = loudness(await render(make, seconds, true))
  return { rmsDb: plain.rmsDb, peakDb: plain.peakDb, kRmsDb: k.rmsDb }
}
