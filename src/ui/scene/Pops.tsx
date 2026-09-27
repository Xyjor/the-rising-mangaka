// Pop numbers: money, fans and xp float up from the mangaka when a step of play changes them.
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { GameState } from '../../sim'
import { useStore } from '../../state/store'
import { compact, money } from '../format'
import { sceneToCss } from './sceneAnchor'

export type PopKind = 'money' | 'fans' | 'xp'
export interface Pop { id: number; kind: PopKind; text: string; x: number; y: number }
/** The store fields a pop depends on. */
export interface PopState { game: GameState | null; saveLoads: number; readOnly: boolean }

export const POP_MAX = 6
export const POP_MS = 1200
/** Later pops in one step sit this many scene pixels higher. */
const POP_STACK = 10

/** The pops for one change of state, in order money, fans, xp. Pure; [] for anything that is not a step of play. */
// the brief keeps the pure rule beside its component, so tests import both from one module
// oxlint-disable-next-line react/only-export-components
export function popsFor(prev: PopState, next: PopState, anchor: { x: number; y: number }): Omit<Pop, 'id'>[] {
  const a = prev.game, b = next.game
  if (prev.readOnly || next.readOnly || prev.saveLoads !== next.saveLoads || !a || !b) return []
  if (a.worldSeed !== b.worldSeed) return []
  const gap = b.day - a.day
  if (gap !== 0 && gap !== 1) return []
  const parts: [PopKind, string][] = []
  const dm = b.player.money - a.player.money
  if (dm !== 0) parts.push(['money', dm > 0 ? `+${money(dm)}` : money(dm)])
  const df = b.player.fans - a.player.fans
  if (df > 0) parts.push(['fans', `+${compact(df)} fans`])
  if (b.player.level > a.player.level) parts.push(['xp', `Level ${b.player.level}`])
  else if (b.player.xp > a.player.xp) parts.push(['xp', `+${b.player.xp - a.player.xp} xp`])
  return parts.map(([kind, text], i) => ({ kind, text, x: anchor.x, y: anchor.y - i * POP_STACK }))
}

let nextId = 1

export function Pops({ rect, anchor }: {
  rect: { width: number; height: number }; anchor: () => { x: number; y: number }
}): JSX.Element {
  const [pops, setPops] = useState<Pop[]>([])
  // Keep the latest `anchor` in a ref so the subscription effect below can stay [] and never re-run: a re-run would
  // tear down its timers, which would drop pops that are still animating.
  const anchorRef = useRef(anchor)
  useEffect(() => { anchorRef.current = anchor })
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const unsub = useStore.subscribe((next, prev) => {
      const fresh = popsFor(prev, next, anchorRef.current()).map((p) => ({ ...p, id: nextId++ }))
      if (!fresh.length) return
      setPops((list) => [...list, ...fresh].slice(-POP_MAX))
      for (const p of fresh) {
        const t = setTimeout(() => {
          timers.delete(t)
          setPops((list) => list.filter((q) => q.id !== p.id))
        }, POP_MS)
        timers.add(t)
      }
    })
    return () => { unsub(); timers.forEach(clearTimeout) }
  }, [])
  return (
    <>
      {pops.map((p) => {
        const c = sceneToCss(rect, p.x, p.y)
        return <span key={p.id} className="pop" data-kind={p.kind} style={{ left: c.left, top: c.top }}>{p.text}</span>
      })}
    </>
  )
}
