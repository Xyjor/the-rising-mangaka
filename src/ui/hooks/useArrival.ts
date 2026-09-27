import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../motion'
import { EDITOR_WALK_MS } from '../scene/actors'

/**
 * True once the editor has walked in with something pending: EDITOR_WALK_MS after `pending` became true, at once under
 * reduced motion or when it was already true on mount (a loaded save), and false whenever `pending` is false.
 */
export function useArrival(pending: boolean): boolean {
  const [arrived, setArrived] = useState(pending)
  const [prev, setPrev] = useState(pending)
  // the flag changed: start over (React's adjust-state-while-rendering pattern, no effect round trip)
  if (pending !== prev) {
    setPrev(pending)
    setArrived(pending && prefersReducedMotion())
  }
  useEffect(() => {
    if (!pending || arrived) return
    const id = window.setTimeout(() => setArrived(true), EDITOR_WALK_MS)
    return () => window.clearTimeout(id)
  }, [pending, arrived])
  return pending && arrived
}
