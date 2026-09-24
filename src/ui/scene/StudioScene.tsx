import { useEffect, useRef } from 'react'
import { getPhase, placeById } from '../../sim'
import { SPEED_MS, useStore } from '../../state/store'

const W = 192
const H = 108

// ---------- palette & sprites ----------

const PAL: Record<string, string> = {
  K: '#2b2140', H: '#f4cfa5', E: '#1b1b1b', R: '#3b6fd6', B: '#2c2c3a', S: '#1b1b1b', M: '#c0392b',
}
const SHIRTS = ['#3b6fd6', '#c94b4b', '#3fa66c', '#7c4dff', '#e07b39', '#2b8a9e']
const HAIRS = ['#2b2140', '#5a3a1e', '#1b1b1b', '#7a2e2e', '#3b3b45', '#8c6a3f']

const HERO = [
  '...KKKKKK...',
  '..KKKKKKKK..',
  '..KKHHHHKK..',
  '..KHHHHHHK..',
  '..KHEHHEHK..',
  '...HHHHHH...',
  '....HMMH....',
  '..RRRRRRRR..',
  '.RRRRRRRRRR.',
  '.HRRRRRRRRH.',
  '..RRRRRRRR..',
  '...BBBBBB...',
  '...BB..BB...',
  '...BB..BB...',
  '..SS....SS..',
]

const HEAD_SLEEP = [
  '...KKKKKK...',
  '..KKKKKKKK..',
  '..KKHHHHKK..',
  '..KHHHHHHK..',
  '..KHEEHEEK..',
  '...HHHHHH...',
  '....HHHH....',
]

function drawSprite(ctx: CanvasRenderingContext2D, map: string[], x: number, y: number, rows = map.length, pal: Record<string, string> = PAL) {
  for (let r = 0; r < rows; r++) {
    const line = map[r]
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (ch === '.') continue
      ctx.fillStyle = pal[ch] ?? '#f0f'
      ctx.fillRect(x + c, y + r, 1, 1)
    }
  }
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

const GLYPH: Record<string, string[]> = {
  Z: ['###', '..#', '.#.', '#..', '###'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '.': ['...', '...', '...', '...', '.#.'],
  '?': ['###', '..#', '.##', '...', '.#.'],
}
function glyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, color: string) {
  const g = GLYPH[ch]
  if (!g) return
  ctx.fillStyle = color
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '#') ctx.fillRect(x + c, y + r, 1, 1)
}

// ---------- sky ----------

const SKY: [number, [number, number, number]][] = [
  [0.0, [246, 166, 160]],
  [0.25, [143, 211, 255]],
  [0.55, [143, 211, 255]],
  [0.7, [242, 163, 90]],
  [0.82, [28, 35, 82]],
  [1.0, [246, 166, 160]],
]
function skyColor(t: number): string {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [t0, c0] = SKY[i]
    const [t1, c1] = SKY[i + 1]
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0)
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k))
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
  }
  return 'rgb(143,211,255)'
}

// ---------- scene ----------

interface Snapshot {
  phase: 'idle' | 'drawing' | 'ready' | 'submitted'
  activity: 'work' | 'rest' | 'job'
  progress: number
  stamina: number
  running: boolean
  speed: number
  away: boolean
  assistants: { look: number; stamina: number }[]
}

function render(ctx: CanvasRenderingContext2D, s: Snapshot, t: number, frame: number) {
  const night = t > 0.72 || t < 0.06
  const absent = s.away || s.activity === 'job'
  const working = !absent && s.phase === 'drawing' && s.activity === 'work' && s.stamina > 0 && s.running
  const resting = !absent && !working && s.phase !== 'idle' && s.phase !== 'ready'

  // wall
  rect(ctx, 0, 0, W, 78, night ? '#8f8272' : '#e8dcc8')
  for (let x = 0; x < W; x += 12) rect(ctx, x, 0, 1, 78, night ? '#847763' : '#ddd0ba')
  rect(ctx, 0, 76, W, 2, night ? '#5a4a3a' : '#8a6a4f')
  // floor
  rect(ctx, 0, 78, W, 30, night ? '#6f5438' : '#b0855b')
  for (let x = 0; x < W; x += 16) rect(ctx, x, 78, 1, 30, night ? '#5c4530' : '#96704a')
  for (let y = 86; y < H; y += 8) rect(ctx, 0, y, W, 1, night ? '#5c4530' : '#a37b52')

  // window
  rect(ctx, 116, 10, 48, 36, '#5a4634')
  rect(ctx, 118, 12, 44, 32, skyColor(t))
  if (night) {
    for (let i = 0; i < 9; i++) rect(ctx, 120 + ((i * 37) % 40), 14 + ((i * 23) % 26), 1, 1, '#fff')
    rect(ctx, 150, 16, 6, 6, '#f5f1c9'); rect(ctx, 152, 16, 4, 4, skyColor(t))
  } else if (t > 0.12 && t < 0.66) {
    const sx = 122 + (t - 0.12) * 70
    const sy = 30 - Math.sin(((t - 0.12) / 0.54) * Math.PI) * 14
    rect(ctx, sx, sy, 5, 5, '#ffe47a')
  }
  const cx = ((frame * 0.15) % 60) - 10
  rect(ctx, 118 + cx, 20, 10, 3, night ? '#3a4470' : '#fff'); rect(ctx, 120 + cx, 18, 6, 2, night ? '#3a4470' : '#fff')
  rect(ctx, 139, 12, 2, 32, '#5a4634'); rect(ctx, 118, 27, 44, 2, '#5a4634')
  rect(ctx, 114, 45, 52, 3, '#4a3828')

  // bookshelf
  rect(ctx, 8, 18, 34, 58, '#6d4c33')
  rect(ctx, 10, 20, 30, 54, '#8b6543')
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 22 + shelf * 13
    rect(ctx, 10, y + 11, 30, 2, '#5a3d28')
    const cols = ['#c94b4b', '#3b6fd6', '#3fa66c', '#f5b700', '#7c4dff', '#e07b39']
    for (let b = 0; b < 7; b++) {
      const bh = 7 + ((b * 3 + shelf) % 4)
      rect(ctx, 11 + b * 4, y + 11 - bh, 3, bh, cols[(b + shelf) % cols.length])
    }
  }

  // poster
  rect(ctx, 52, 14, 22, 28, '#fff'); rect(ctx, 54, 16, 18, 24, '#e5484d'); rect(ctx, 57, 22, 12, 12, '#fff'); rect(ctx, 60, 25, 6, 6, '#16161a')

  // bed
  rect(ctx, 128, 66, 58, 26, '#6d4c33')
  rect(ctx, 130, 68, 54, 20, '#f0ead6')
  rect(ctx, 168, 70, 14, 8, '#ffffff')
  rect(ctx, 130, 74, 40, 14, '#c94b4b')
  rect(ctx, 130, 74, 40, 2, '#a83c3c')
  if (resting) {
    rect(ctx, 138, 72, 30, 4, '#d95d5d')
    drawSprite(ctx, HEAD_SLEEP, 169, 66)
    const zz = Math.floor(frame / 20) % 3
    for (let i = 0; i <= zz; i++) glyph(ctx, 'Z', 178 + i * 3, 58 - i * 4, '#2f5ecf')
  }

  // assistants' desk (front left), only when staff exists
  if (s.assistants.length) {
    const ax = 6
    s.assistants.slice(0, 3).forEach((a, i) => {
      const pal = { ...PAL, R: SHIRTS[a.look % SHIRTS.length], K: HAIRS[a.look % HAIRS.length] }
      const x = ax + 4 + i * 15
      const tired = a.stamina <= 0
      const bob = working && !tired ? (Math.floor((frame + i * 3) / 8) % 2) : 0
      drawSprite(ctx, HERO, x, 70 + bob, 11, pal)
      if (working && !tired) { const armY = 79 + (Math.floor((frame + i * 5) / 4) % 2); rect(ctx, x + 10, armY, 3, 2, PAL.H) }
      if (tired) glyph(ctx, 'Z', x + 12, 62, '#2f5ecf')
    })
    const dw = 12 + s.assistants.length * 15
    rect(ctx, ax, 84, dw, 3, '#8b5a2b'); rect(ctx, ax, 87, dw, 9, '#70461f')
    rect(ctx, ax + 2, 84, 8, 1, '#fdfcf7'); rect(ctx, ax + 2, 83, 8, 1, '#fdfcf7')
  }

  // chair
  rect(ctx, 70, 54, 20, 4, '#4a4a55'); rect(ctx, 71, 58, 2, 14, '#4a4a55'); rect(ctx, 87, 58, 2, 14, '#4a4a55')

  // player at desk
  if (working || (!absent && s.phase === 'drawing' && !resting)) {
    const bob = working ? (Math.floor(frame / 8) % 2) : 0
    drawSprite(ctx, HERO, 74, 48 + bob, 12)
    const armY = working ? 57 + (Math.floor(frame / 4) % 2) : 58
    rect(ctx, 84, armY, 3, 2, PAL.H); rect(ctx, 87, armY - 1, 1, 3, '#1b1b1b')
    if (working && s.stamina < 20) glyph(ctx, '!', 86, 40, '#e5484d')
  }

  // desk
  rect(ctx, 52, 62, 58, 4, '#8b5a2b'); rect(ctx, 52, 66, 58, 14, '#70461f')
  rect(ctx, 54, 66, 2, 16, '#5a3618'); rect(ctx, 106, 66, 2, 16, '#5a3618')
  rect(ctx, 60, 70, 20, 8, '#5a3618'); rect(ctx, 62, 72, 16, 1, '#8b5a2b'); rect(ctx, 62, 75, 16, 1, '#8b5a2b')
  rect(ctx, 100, 50, 1, 12, '#3b3b45'); rect(ctx, 96, 47, 9, 4, '#3fa66c'); if (night || working) rect(ctx, 97, 51, 7, 2, '#fff2a8')
  const stack = Math.round(1 + s.progress * 8)
  rect(ctx, 57, 62 - stack, 14, stack, '#fdfcf7'); for (let i = 0; i < stack; i += 2) rect(ctx, 57, 62 - stack + i, 14, 1, '#e9e5da')
  rect(ctx, 59, 60 - stack, 10, 1, '#b8b2a5'); rect(ctx, 59, 58 - stack, 7, 1, '#b8b2a5')
  rect(ctx, 90, 58, 4, 4, '#1b1b1b'); rect(ctx, 91, 57, 2, 1, '#1b1b1b')
  rect(ctx, 76, 58, 5, 4, '#fff'); rect(ctx, 81, 59, 1, 2, '#fff'); if (working) { const st = Math.floor(frame / 10) % 2; rect(ctx, 77 + st, 55, 1, 2, '#d9d3c5') }
  if (absent) { rect(ctx, 96, 58, 8, 5, '#fff7c2'); rect(ctx, 97, 59, 6, 1, '#b8b2a5'); rect(ctx, 97, 61, 4, 1, '#b8b2a5') }

  // standing idle / ready character
  if (!absent && (s.phase === 'idle' || s.phase === 'ready')) {
    const bob = Math.floor(frame / 16) % 2
    drawSprite(ctx, HERO, 112, 62 + bob)
    if (s.phase === 'ready') { rect(ctx, 104, 70, 8, 10, '#fdfcf7'); rect(ctx, 105, 72, 6, 1, '#b8b2a5'); rect(ctx, 105, 74, 6, 1, '#b8b2a5'); glyph(ctx, '!', 117, 52, '#e5484d') }
    else if (frame % 120 < 40) glyph(ctx, '?', 117, 52, '#2f5ecf')
  }
  if (!absent && s.phase === 'submitted') {
    const d = Math.floor(frame / 12) % 4
    for (let i = 0; i < d; i++) glyph(ctx, '.', 150 + i * 3, 56, '#16161a')
  }

  if (night) { ctx.fillStyle = 'rgba(20, 24, 60, 0.28)'; ctx.fillRect(0, 0, W, H); if (working) { ctx.fillStyle = 'rgba(255, 240, 180, 0.12)'; ctx.fillRect(60, 46, 50, 34) } }
}

export function StudioScene({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const phaseT = useRef(0.2)
  const frame = useRef(0)

  const phase = useStore((s) => (s.game ? getPhase(s.game) : 'idle'))
  const activity = useStore((s) => s.game?.activity ?? 'rest')
  const progress = useStore((s) => (s.game?.project ? s.game.project.pagesDone / s.game.project.pagesTarget : 0))
  const stamina = useStore((s) => s.game?.player.stamina ?? 100)
  const speed = useStore((s) => s.speed)
  const trip = useStore((s) => s.game?.trip ?? null)
  const assistants = useStore((s) => s.game?.assistants ?? [])
  const snap = useRef<Snapshot>({ phase, activity, progress, stamina, running, speed, away: !!trip, assistants: [] })
  useEffect(() => {
    snap.current = {
      phase, activity, progress, stamina, running, speed, away: !!trip,
      assistants: assistants.map((a) => ({ look: a.look, stamina: a.stamina })),
    }
  }, [phase, activity, progress, stamina, running, speed, trip, assistants])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const s = snap.current
      if (s.running && s.speed > 0) {
        phaseT.current = (phaseT.current + dt / SPEED_MS[s.speed as 1 | 2 | 3]) % 1
        frame.current += 1
      } else {
        frame.current += 0.5
      }
      render(ctx, s, phaseT.current, Math.floor(frame.current))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const status =
    trip ? `Away at the ${placeById(trip.placeId).name}` :
    activity === 'job' ? 'At the part-time job' :
    phase === 'idle' ? 'Free' :
    phase === 'ready' ? 'Manuscript ready' :
    phase === 'submitted' ? 'Waiting for the poll' :
    activity === 'work' ? (stamina <= 0 ? 'Exhausted' : 'Drawing') : 'Resting'
  const showPaused = !running && (phase === 'drawing' || phase === 'submitted' || activity === 'job' || !!trip)

  return (
    <div className="scene-wrap" aria-label="Studio">
      <canvas ref={ref} width={W} height={H} />
      <div className="scene-overlay">
        <span className="chip">{status}</span>
      </div>
      {showPaused && (
        <div className="scene-paused"><span>Paused</span></div>
      )}
    </div>
  )
}
